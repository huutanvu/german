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
  const prompt = `You are a German language teacher. Analyze the German word "${rawWord}" captured in this sentence context: "${contextSentence}".
Reconstruct the correct base form (infinitive for verbs, nominative singular with gender article for nouns, base form for adjectives). Pay special attention to German separable verbs (e.g. if the clicked word is "hole" and context is "Ich hole dich ab", the resolved word must be "abholen").

Provide the response as a JSON object matching this schema:
{
  "word": "resolved base word/phrase (e.g. 'abholen' or 'das Treffen')",
  "meanings": "English translations/meanings separated by commas",
  "level": "German CEFR Level (Choice: A1, A2, B1, B2, C1, C2)",
  "grammar": "Article, plural form (for nouns), aux verb + past participle (for verbs), prepositions (for adjectives), etc.",
  "dailyUse": "A natural German example sentence showing daily context use of the resolved word, accompanied by its English translation in brackets",
  "professionalUse": "A German example sentence showing professional software engineering/agile context use, accompanied by its English translation in brackets",
  "tips": "Grammatical cases, associated prepositions, or study tips",
  "caution": "Pitfalls, false friends, capitalization rules, or common errors"
}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API call failed: ${res.status} ${text}`);
  }

  const data = await res.json() as any;
  const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!replyText) {
    throw new Error('Empty response from Gemini API');
  }

  return JSON.parse(replyText);
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
