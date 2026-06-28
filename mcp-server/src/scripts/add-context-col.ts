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

async function addContextColumn() {
  console.log('Adding column "context" to table "Vocabulary"...');
  const res = await fetch(`${base}/tables/Vocabulary/columns`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      columns: [
        {
          id: 'context',
          fields: {
            label: 'Context',
            type: 'Text',
          },
        },
      ],
    }),
  });

  if (res.status === 400) {
    const text = await res.text();
    if (text.includes('already exists')) {
      console.log('Column "context" already exists. Success.');
      return;
    }
    throw new Error(`Failed to add column: 400 ${text}`);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to add column: ${res.status} ${text}`);
  }

  console.log('Column "context" added successfully.');
}

addContextColumn().catch(err => {
  console.error(err);
  process.exit(1);
});
