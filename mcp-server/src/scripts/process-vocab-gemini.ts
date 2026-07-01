import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../frontend/.env.local'),
    path.resolve(process.cwd(), '../frontend/.env'),
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...parts] = trimmed.split('=');
          const val = parts.join('=').trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const GRIST_URL = process.env.GRIST_URL || process.env.NEXT_PUBLIC_GRIST_URL || 'https://docs.getgrist.com/api';
const GRIST_DOC = process.env.GRIST_DOC || process.env.NEXT_PUBLIC_GRIST_DOC;
const GRIST_KEY = process.env.GRIST_KEY || process.env.NEXT_PUBLIC_GRIST_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GRIST_DOC || !GRIST_KEY) {
  console.error('Error: Grist credentials not found.');
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.error('Error: GEMINI_API_KEY not found in environment variables. Please get a free key from https://aistudio.google.com and add it to your .env file.');
  process.exit(1);
}

const base = `${GRIST_URL}/docs/${GRIST_DOC}`;
const headers = {
  Authorization: `Bearer ${GRIST_KEY}`,
  'Content-Type': 'application/json',
};

// ─── Fetch Unprocessed Words ──────────────────────────────────────
async function fetchUnprocessed() {
  const query = `?filter=${encodeURIComponent(JSON.stringify({ isProcessed: [false] }))}`;
  const res = await fetch(`${base}/tables/Vocabulary/records${query}`, { headers });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch vocabulary: ${res.status}`);
  }

  const data = await res.json() as { records: { id: number; fields: any }[] };
  return data.records;
}

function findMatchingBraceIndex(str: string, startIdx: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < str.length; i++) {
    const char = str[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }
  }

  return -1;
}

function findMatchingBracketIndex(str: string, startIdx: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < str.length; i++) {
    const char = str[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '[') {
        depth++;
      } else if (char === ']') {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }
  }

  return -1;
}

function cleanJsonString(str: string): string {
  let cleaned = str.trim();
  
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIdx = -1;
  let endIdx = -1;
  
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = findMatchingBraceIndex(cleaned, startIdx);
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = findMatchingBracketIndex(cleaned, startIdx);
  }
  
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1);
  }
  
  cleaned = cleaned.trim();
  // Remove trailing commas in arrays/objects
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
  return cleaned;
}

function safeJsonParse<T = any>(str: string): T {
  const cleaned = cleanJsonString(str);
  try {
    return JSON.parse(cleaned) as T;
  } catch (err: any) {
    console.error("Failed to parse JSON string. Raw input was:\n", str);
    console.error("Cleaned input was:\n", cleaned);
    throw err;
  }
}

// ─── Process single word via Gemini ────────────────────────────────
async function askGemini(rawWord: string, contextSentence: string): Promise<any> {
  const prompt = `You are a German language teacher fluent in both English and Vietnamese.
Analyze the German word "${rawWord}" captured in this sentence context: "${contextSentence}".
Reconstruct the correct base form (infinitive for verbs, nominative singular with gender article for nouns, base form for adjectives). Pay special attention to German separable verbs. For articles (e.g. der/die/das/dem/den/des), always map them to exactly the clean base form ("der", "die", "das", or "ein", "eine") without any parenthetical information, suffixes, or explanations (e.g. return "der" instead of "der (masculine definitiver Artikel)").

You must generate vocabulary context examples, translation, tips, and cautions for ALL of the following 7 professions:
1. software_engineer
2. healthcare_professional
3. nurse
4. teacher
5. legal_professional
6. finance_professional
7. general

For each profession:
- dailyUse: German sentence [English translation]
- dailyUse_vn: Same German sentence [Vietnamese translation]
- professionalUse: German sentence [English translation] tailored to the profession
- professionalUse_vn: Same German sentence [Vietnamese translation] tailored to the profession
- tips: Grammatical cases, prepositions, or tips in English
- tips_vn: Grammatical cases, prepositions, or tips explained in Vietnamese
- caution: Common pitfalls or false friends in English
- caution_vn: Common pitfalls or false friends explained in Vietnamese

CRITICAL: The sentence before the brackets [...] MUST be the original German sentence. Do NOT translate the German sentence itself to English or Vietnamese outside of the brackets. Only the translation inside the brackets [...] should be English or Vietnamese.
CRITICAL: The output must be pure, valid JSON matching the exact schema below. Do not include any JSON comments, ellipsis (...), or placeholders. The "usages" array must contain exactly 7 complete object entries, one for each of the 7 professions.

Provide the response as a JSON object matching this schema:
{
  "word": "resolved base word/phrase (e.g. 'abholen' or 'das Treffen')",
  "meanings": "English translations/meanings separated by commas",
  "meanings_vn": "Vietnamese translations/meanings separated by commas",
  "level": "German CEFR Level (Choice: A1, A2, B1, B2, C1, C2)",
  "partOfSpeech": "Word type (Choice: 'noun', 'verb', 'adjective', 'adverb', 'preposition', 'pronoun', 'conjunction', 'phrase')",
  "grammar": "Article, plural form (for nouns), aux verb + past participle (for verbs), prepositions (for adjectives), etc. in English",
  "grammar_vn": "Grammatical notes explained in Vietnamese",
  "usages": [
    {
      "profession": "one of the 7 professions above",
      "dailyUse": "German sentence [English translation]",
      "dailyUse_vn": "German sentence [Vietnamese translation]",
      "professionalUse": "German sentence [English translation]",
      "professionalUse_vn": "German sentence [Vietnamese translation]",
      "tips": "Tips in English",
      "tips_vn": "Tips in Vietnamese",
      "caution": "Caution in English",
      "caution_vn": "Caution in Vietnamese"
    }
  ]
}`;

  const models = [
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
  ];

  let lastError: Error | null = null;
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      });

      if (res.ok) {
        const data = await res.json() as any;
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (replyText) {
          return safeJsonParse(replyText);
        }
        lastError = new Error(`Empty response from ${model}`);
      } else {
        const errText = await res.text();
        console.warn(`Gemini model ${model} failed (${res.status}): ${errText}`);
        lastError = new Error(`${model}: ${res.status} ${errText}`);
      }
    } catch (e: any) {
      console.warn(`Error calling ${model}:`, e);
      lastError = e;
    }
  }

  throw lastError ?? new Error('All Gemini models failed');
}

// ─── Update Grist ──────────────────────────────────────────────────
async function updateGrist(id: number, fields: any) {
  const res = await fetch(`${base}/tables/Vocabulary/records`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      records: [
        {
          id,
          fields: {
            ...fields,
            isProcessed: true,
            updatedAt: new Date().toISOString(),
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update Grist record: ${res.status} ${text}`);
  }
}

async function insertVocabularyUsages(vocabId: number, usages: any[], userId?: string) {
  const records = usages.map(u => ({
    fields: {
      vocabId,
      profession: u.profession,
      dailyUse: u.dailyUse,
      dailyUse_vn: u.dailyUse_vn,
      professionalUse: u.professionalUse,
      professionalUse_vn: u.professionalUse_vn,
      tips: u.tips,
      tips_vn: u.tips_vn,
      caution: u.caution,
      caution_vn: u.caution_vn,
      createdAt: new Date().toISOString(),
      ...(userId ? { userId } : {})
    }
  }));

  const res = await fetch(`${base}/tables/VocabularyUsage/records`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ records })
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Warning: Failed to save vocabulary usages: ${res.status} ${text}`);
  }
}

async function main() {
  console.log('Scanning Grist for unprocessed vocabulary words...');
  const records = await fetchUnprocessed();
  console.log(`Found ${records.length} unprocessed words.`);

  for (const record of records) {
    const rawWord = record.fields.word;
    const context = record.fields.context || '';
    console.log(`Processing "${rawWord}" in context: "${context}"...`);

    try {
      const result = await askGemini(rawWord, context);
      console.log(`Gemini resolved "${rawWord}" -> "${result.word}"`);

      const updatePayload = {
        word: result.word,
        meanings: result.meanings,
        meanings_vn: result.meanings_vn,
        level: result.level || "B1",
        grammar: result.grammar,
        grammar_vn: result.grammar_vn,
        partOfSpeech: result.partOfSpeech,
      };

      await updateGrist(record.id, updatePayload);
      await insertVocabularyUsages(record.id, result.usages, record.fields.userId);
      console.log(`Successfully processed and saved "${result.word}".`);
    } catch (err) {
      console.error(`Failed to process "${rawWord}":`, err);
    }
  }

  console.log('Vocabulary processing complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
