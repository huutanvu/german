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

async function clearTable(tableName: string) {
  console.log(`Clearing table ${tableName}...`);
  // Get all records
  const res = await fetch(`${base}/tables/${tableName}/records`, { headers });
  if (!res.ok) {
    throw new Error(`Failed to list: ${res.status}`);
  }
  const data = await res.json() as { records: { id: number }[] };
  const ids = data.records.map(r => r.id);

  if (ids.length > 0) {
    const delRes = await fetch(`${base}/tables/${tableName}/records/delete`, {
      method: 'POST',
      headers,
      body: JSON.stringify(ids),
    });
    if (!delRes.ok) {
      throw new Error(`Failed to delete: ${delRes.status}`);
    }
    console.log(`Deleted ${ids.length} records from ${tableName}.`);
  } else {
    console.log(`Table ${tableName} is already empty.`);
  }
}

async function main() {
  await clearTable('ReadingPractice');
  await clearTable('SpeakingPractice');
  // Also clean vocabulary to prevent duplicates
  await clearTable('Vocabulary');
  console.log('Clean complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
