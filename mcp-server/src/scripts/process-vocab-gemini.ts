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

// ─── Process single word via Gemini ────────────────────────────────
async function askGemini(rawWord: string, contextSentence: string): Promise<any> {
  const prompt = `You are a German language teacher fluent in both English and Vietnamese.
Analyze the German word "${rawWord}" captured in this sentence context: "${contextSentence}".
Reconstruct the correct base form (infinitive for verbs, nominative singular with gender article for nouns, base form for adjectives). Pay special attention to German separable verbs.

Format guidelines:
- For "dailyUse", provide a natural German example sentence showing daily context use of the resolved word, followed by its English translation in brackets. Format: "German sentence [English translation]"
- For "dailyUse_vn", provide the EXACT same German example sentence as dailyUse, but followed by its Vietnamese translation in brackets. Format: "German sentence [Vietnamese translation]"
- For "professionalUse", provide a German example sentence showing professional software engineering/agile context use, followed by its English translation in brackets. Format: "German sentence [English translation]"
- For "professionalUse_vn", provide the EXACT same German example sentence as professionalUse, but followed by its Vietnamese translation in brackets. Format: "German sentence [Vietnamese translation]"

CRITICAL: The sentence before the brackets MUST be the original German sentence in all four columns. Do NOT translate the German sentence itself to English or Vietnamese outside of the brackets. Only the translation inside the brackets [...] should be English or Vietnamese.

Example:
If German sentence is "Ich gehe heute einkaufen.", then:
- dailyUse: "Ich gehe heute einkaufen. [I am going shopping today.]"
- dailyUse_vn: "Ich gehe heute einkaufen. [Hôm nay tôi đi mua sắm.]"

Provide the response as a JSON object matching this schema:
{
  "word": "resolved base word/phrase (e.g. 'abholen' or 'das Treffen')",
  "meanings": "English translations/meanings separated by commas",
  "meanings_vn": "Vietnamese translations/meanings separated by commas",
  "level": "German CEFR Level (Choice: A1, A2, B1, B2, C1, C2)",
  "grammar": "Article, plural form (for nouns), aux verb + past participle (for verbs), prepositions (for adjectives), etc. in English",
  "grammar_vn": "Grammatical notes (articles, plurals, auxiliary verbs, etc.) explained in Vietnamese",
  "dailyUse": "German sentence [English translation]",
  "dailyUse_vn": "German sentence [Vietnamese translation]",
  "professionalUse": "German sentence [English translation]",
  "professionalUse_vn": "German sentence [Vietnamese translation]",
  "tips": "Grammatical cases, prepositions, or tips in English",
  "tips_vn": "Grammatical cases, prepositions, or tips explained in Vietnamese",
  "caution": "Common pitfalls or false friends in English",
  "caution_vn": "Common pitfalls or false friends explained in Vietnamese"
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
          return JSON.parse(replyText);
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

      await updateGrist(record.id, result);
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
