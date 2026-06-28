import fs from 'fs';
import path from 'path';

// Helper to load env variables from various files if not in process.env
function loadEnv() {
  const envPaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../frontend/.env.local'),
    path.resolve(process.cwd(), '../frontend/.env'),
    path.resolve('/home/tvu/work/resume_generator/scripts/.env'),
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
  console.error('Error: Grist credentials not found. Make sure GRIST_DOC and GRIST_KEY are configured.');
  process.exit(1);
}

const base = `${GRIST_URL}/docs/${GRIST_DOC}`;
const headers = {
  Authorization: `Bearer ${GRIST_KEY}`,
  'Content-Type': 'application/json',
};

async function checkTableExists(tableId: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}/tables`, { headers });
    if (!res.ok) throw new Error(`Fetch tables failed: ${res.statusText}`);
    const data = await res.json() as { tables: { id: string }[] };
    return data.tables.some((t) => t.id === tableId);
  } catch (err) {
    console.error('Error checking tables:', err);
    return false;
  }
}

async function createTable(tableData: any) {
  console.log(`Creating table ${tableData.tables[0].id}...`);
  const res = await fetch(`${base}/tables`, {
    method: 'POST',
    headers,
    body: JSON.stringify(tableData),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to create table: ${res.status} ${body}`);
  }
  console.log(`Table ${tableData.tables[0].id} created successfully.`);
}

const tablesToCreate = [
  {
    tables: [
      {
        id: 'LearningContext',
        columns: [
          { id: 'targetLevel', fields: { type: 'Choice', label: 'Target Level', widgetOptions: JSON.stringify({ choices: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] }) } },
          { id: 'currentTopic', fields: { type: 'Text', label: 'Current Topic' } },
          { id: 'professionalEnvironment', fields: { type: 'Text', label: 'Professional Environment' } },
          { id: 'updatedAt', fields: { type: 'DateTime', label: 'Updated At' } },
        ],
      },
    ],
  },
  {
    tables: [
      {
        id: 'Vocabulary',
        columns: [
          { id: 'word', fields: { type: 'Text', label: 'Word' } },
          { id: 'meanings', fields: { type: 'Text', label: 'Meanings' } },
          { id: 'meanings_vn', fields: { type: 'Text', label: 'Meanings (VN)' } },
          { id: 'level', fields: { type: 'Choice', label: 'Level', widgetOptions: JSON.stringify({ choices: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] }) } },
          { id: 'type', fields: { type: 'Choice', label: 'Type', widgetOptions: JSON.stringify({ choices: ['new', 'revised', 'permanent', 'complicated'] }) } },
          { id: 'correctCount', fields: { type: 'Int', label: 'Correct Count' } },
          { id: 'grammar', fields: { type: 'Text', label: 'Grammar' } },
          { id: 'grammar_vn', fields: { type: 'Text', label: 'Grammar (VN)' } },
          { id: 'dailyUse', fields: { type: 'Text', label: 'Daily Use' } },
          { id: 'dailyUse_vn', fields: { type: 'Text', label: 'Daily Use (VN)' } },
          { id: 'professionalUse', fields: { type: 'Text', label: 'Professional Use' } },
          { id: 'professionalUse_vn', fields: { type: 'Text', label: 'Professional Use (VN)' } },
          { id: 'tips', fields: { type: 'Text', label: 'Tips' } },
          { id: 'tips_vn', fields: { type: 'Text', label: 'Tips (VN)' } },
          { id: 'caution', fields: { type: 'Text', label: 'Caution' } },
          { id: 'caution_vn', fields: { type: 'Text', label: 'Caution (VN)' } },
          { id: 'updatedAt', fields: { type: 'DateTime', label: 'Updated At' } },
        ],
      },
    ],
  },
  {
    tables: [
      {
        id: 'VocabularyReviews',
        columns: [
          { id: 'vocabId', fields: { type: 'Ref:Vocabulary', label: 'Vocabulary' } },
          { id: 'userSentence', fields: { type: 'Text', label: 'User Sentence' } },
          { id: 'correctedSentence', fields: { type: 'Text', label: 'Corrected Sentence' } },
          { id: 'correctionFeedback', fields: { type: 'Text', label: 'Correction Feedback' } },
          { id: 'correctionFeedback_vn', fields: { type: 'Text', label: 'Correction Feedback (VN)' } },
          { id: 'status', fields: { type: 'Choice', label: 'Status', widgetOptions: JSON.stringify({ choices: ['pending_correction', 'corrected', 'failed'] }) } },
          { id: 'reviewedAt', fields: { type: 'DateTime', label: 'Reviewed At' } },
        ],
      },
    ],
  },
  {
    tables: [
      {
        id: 'WritingPractice',
        columns: [
          { id: 'topic', fields: { type: 'Text', label: 'Topic' } },
          { id: 'description', fields: { type: 'Text', label: 'Description' } },
          { id: 'userParagraph', fields: { type: 'Text', label: 'User Paragraph' } },
          { id: 'correctedParagraph', fields: { type: 'Text', label: 'Corrected Paragraph' } },
          { id: 'correctionsJson', fields: { type: 'Text', label: 'Corrections JSON' } },
          { id: 'correctionsJson_vn', fields: { type: 'Text', label: 'Corrections JSON (VN)' } },
          { id: 'status', fields: { type: 'Choice', label: 'Status', widgetOptions: JSON.stringify({ choices: ['pending_user', 'pending_correction', 'corrected'] }) } },
          { id: 'date', fields: { type: 'Text', label: 'Date' } },
        ],
      },
    ],
  },
  {
    tables: [
      {
        id: 'ReadingPractice',
        columns: [
          { id: 'topic', fields: { type: 'Text', label: 'Topic' } },
          { id: 'germanText', fields: { type: 'Text', label: 'German Text' } },
          { id: 'audioFileId', fields: { type: 'Text', label: 'Audio File ID' } },
          { id: 'questionsJson', fields: { type: 'Text', label: 'Questions JSON' } },
          { id: 'userAnswersJson', fields: { type: 'Text', label: 'User Answers JSON' } },
          { id: 'correctionsJson', fields: { type: 'Text', label: 'Corrections JSON' } },
          { id: 'correctionsJson_vn', fields: { type: 'Text', label: 'Corrections JSON (VN)' } },
          { id: 'status', fields: { type: 'Choice', label: 'Status', widgetOptions: JSON.stringify({ choices: ['pending_user', 'pending_evaluation', 'evaluated'] }) } },
          { id: 'date', fields: { type: 'Text', label: 'Date' } },
        ],
      },
    ],
  },
  {
    tables: [
      {
        id: 'SpeakingPractice',
        columns: [
          { id: 'topic', fields: { type: 'Text', label: 'Topic' } },
          { id: 'targetText', fields: { type: 'Text', label: 'Target Text' } },
          { id: 'userAudioFileId', fields: { type: 'Text', label: 'User Audio File ID' } },
          { id: 'transcript', fields: { type: 'Text', label: 'Transcript' } },
          { id: 'grammarFeedback', fields: { type: 'Text', label: 'Grammar Feedback' } },
          { id: 'grammarFeedback_vn', fields: { type: 'Text', label: 'Grammar Feedback (VN)' } },
          { id: 'pronunciationFeedback', fields: { type: 'Text', label: 'Pronunciation Feedback' } },
          { id: 'pronunciationFeedback_vn', fields: { type: 'Text', label: 'Pronunciation Feedback (VN)' } },
          { id: 'targetAudioFileId', fields: { type: 'Text', label: 'Target Audio File ID' } },
          { id: 'score', fields: { type: 'Int', label: 'Score' } },
          { id: 'status', fields: { type: 'Choice', label: 'Status', widgetOptions: JSON.stringify({ choices: ['pending_recording', 'pending_assessment', 'assessed'] }) } },
          { id: 'date', fields: { type: 'Text', label: 'Date' } },
        ],
      },
    ],
  },
  {
    tables: [
      {
        id: 'GrammarPractice',
        columns: [
          { id: 'topic', fields: { type: 'Text', label: 'Topic' } },
          { id: 'description', fields: { type: 'Text', label: 'Description' } },
          { id: 'questionsJson', fields: { type: 'Text', label: 'Questions JSON' } },
          { id: 'userAnswersJson', fields: { type: 'Text', label: 'User Answers JSON' } },
          { id: 'correctionsJson', fields: { type: 'Text', label: 'Corrections JSON' } },
          { id: 'correctionsJson_vn', fields: { type: 'Text', label: 'Corrections JSON (VN)' } },
          { id: 'status', fields: { type: 'Choice', label: 'Status', widgetOptions: JSON.stringify({ choices: ['pending_user', 'evaluated'] }) } },
          { id: 'date', fields: { type: 'Text', label: 'Date' } },
        ],
      },
    ],
  },
];

async function main() {
  console.log(`Connecting to Grist Doc: ${GRIST_DOC}`);
  for (const tableData of tablesToCreate) {
    const tableId = tableData.tables[0].id;
    const exists = await checkTableExists(tableId);
    if (exists) {
      console.log(`Table ${tableId} already exists. Skipping.`);
    } else {
      await createTable(tableData);
    }
  }
  console.log('Database initialization complete.');
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
