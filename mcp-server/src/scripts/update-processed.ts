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

if (!GRIST_DOC || !GRIST_KEY) {
  console.error('Error: Grist credentials not found.');
  process.exit(1);
}

const base = `${GRIST_URL}/docs/${GRIST_DOC}`;
const headers = {
  Authorization: `Bearer ${GRIST_KEY}`,
  'Content-Type': 'application/json',
};

async function updateProcessed(id: number, fields: any) {
  console.log(`Updating vocabulary ID ${id} to processed...`);
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
    throw new Error(`Failed to update vocabulary: ${res.status} ${text}`);
  }

  console.log(`Vocabulary ID ${id} successfully updated.`);
}

// Main fields for the word "treffen"
const fields = {
  word: 'Treffen',
  meanings: 'meeting, gathering',
  grammar: 'Noun, neuter (das Treffen), plural: die Treffen',
  dailyUse: 'Wir haben am Sonntag ein Treffen mit Freunden.',
  professionalUse: 'Das tägliche Treffen der Entwickler heißt Daily Stand-up.',
  tips: 'Derived from the verb \'treffen\' (to meet).',
  caution: 'Capitalize nouns in German (Treffen, not treffen).',
};

updateProcessed(10, fields).catch(err => {
  console.error(err);
  process.exit(1);
});
