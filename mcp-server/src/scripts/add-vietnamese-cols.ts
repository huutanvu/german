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
    table: 'Vocabulary',
    columns: [
      { id: 'meanings_vn', fields: { label: 'Meanings (VN)', type: 'Text' } },
      { id: 'grammar_vn', fields: { label: 'Grammar (VN)', type: 'Text' } },
      { id: 'dailyUse_vn', fields: { label: 'Daily Use (VN)', type: 'Text' } },
      { id: 'professionalUse_vn', fields: { label: 'Professional Use (VN)', type: 'Text' } },
      { id: 'tips_vn', fields: { label: 'Tips (VN)', type: 'Text' } },
      { id: 'caution_vn', fields: { label: 'Caution (VN)', type: 'Text' } }
    ]
  },
  {
    table: 'VocabularyReviews',
    columns: [
      { id: 'correctionFeedback_vn', fields: { label: 'Correction Feedback (VN)', type: 'Text' } }
    ]
  },
  {
    table: 'WritingPractice',
    columns: [
      { id: 'correctionsJson_vn', fields: { label: 'Corrections JSON (VN)', type: 'Text' } }
    ]
  },
  {
    table: 'ReadingPractice',
    columns: [
      { id: 'correctionsJson_vn', fields: { label: 'Corrections JSON (VN)', type: 'Text' } }
    ]
  },
  {
    table: 'SpeakingPractice',
    columns: [
      { id: 'grammarFeedback_vn', fields: { label: 'Grammar Feedback (VN)', type: 'Text' } },
      { id: 'pronunciationFeedback_vn', fields: { label: 'Pronunciation Feedback (VN)', type: 'Text' } }
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
  console.log('All Vietnamese columns created/verified in Grist tables.');
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
