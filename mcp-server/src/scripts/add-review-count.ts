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

const tablesAndColumns = [
  {
    table: 'VocabularyReviews',
    columns: [
      {
        id: 'correctCount',
        fields: {
          label: 'Correct Count',
          type: 'Int'
        }
      }
    ]
  }
];

async function addColumn(table: string, column: any) {
  console.log(`Adding column "${column.id}" to table "${table}"...`);
  const res = await fetch(`${base}/tables/${table}/columns`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      columns: [column],
    }),
  });

  if (res.status === 400) {
    const text = await res.text();
    if (text.includes('already exists')) {
      console.log(`Column "${column.id}" already exists in table "${table}". Success.`);
      return;
    }
    throw new Error(`Failed to add column: 400 ${text}`);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to add column: ${res.status} ${text}`);
  }

  console.log(`Column "${column.id}" added successfully to table "${table}".`);
}

async function run() {
  for (const entry of tablesAndColumns) {
    for (const column of entry.columns) {
      try {
        await addColumn(entry.table, column);
      } catch (err) {
        console.error(`Error adding column ${column.id} to table ${entry.table}:`, err);
        process.exit(1);
      }
    }
  }
  console.log('Vocabulary review count column created/verified in Grist.');
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
