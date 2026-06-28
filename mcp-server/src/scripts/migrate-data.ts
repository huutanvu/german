import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

// Load environment variables
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

const PUBLITIO_KEY = process.env.PUBLITIO_API_KEY;
const PUBLITIO_SECRET = process.env.PUBLITIO_API_SECRET;
const PUBLITIO_FOLDER_ID = process.env.PUBLITIO_FOLDER_ID || '';

if (!GRIST_DOC || !GRIST_KEY) {
  console.error('Error: Grist credentials not found.');
  process.exit(1);
}

const base = `${GRIST_URL}/docs/${GRIST_DOC}`;
const gristHeaders = {
  Authorization: `Bearer ${GRIST_KEY}`,
  'Content-Type': 'application/json',
};

// ─── Publitio upload function ──────────────────────────────────
function getPublitioAuthParams(): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2, 10);
  const signature = createHash('sha1')
    .update(timestamp + nonce + (PUBLITIO_SECRET || ''))
    .digest('hex');
  return {
    api_key: PUBLITIO_KEY || '',
    api_timestamp: timestamp,
    api_nonce: nonce,
    api_signature: signature,
  };
}

async function uploadToPublitio(filePath: string, mimeType: string): Promise<string> {
  if (!PUBLITIO_KEY || !PUBLITIO_SECRET) {
    console.warn('Publitio credentials missing, skipping file upload.');
    return 'demo-audio-file-id';
  }

  console.log(`Uploading ${path.basename(filePath)} to Publitio...`);
  const fileBuffer = fs.readFileSync(filePath);
  const authParams = new URLSearchParams(getPublitioAuthParams()).toString();
  
  const form = new FormData();
  form.append('file', new Blob([fileBuffer], { type: mimeType }), path.basename(filePath));
  if (PUBLITIO_FOLDER_ID) form.append('folder', PUBLITIO_FOLDER_ID);
  form.append('privacy', '1');

  const res = await fetch(`https://api.publit.io/v1/files/create?${authParams}`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Publit.io upload failed: ${res.status} ${text}`);
  }

  const data = await res.json() as { id: string };
  console.log(`Uploaded successfully. File ID: ${data.id}`);
  return data.id;
}

// ─── Parsers ────────────────────────────────────────────────────

function parseFrontmatterAndContent(fileContent: string) {
  const fmMatch = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) return { metadata: {}, content: fileContent };

  const fmText = fmMatch[1];
  const body = fmMatch[2];
  const metadata: Record<string, any> = {};

  for (const line of fmText.split('\n')) {
    const parts = line.split(':');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join(':').trim().replace(/^["']|["']$/g, '');
      metadata[key] = val;
    }
  }

  return { metadata, content: body };
}

function extractSection(content: string, heading: string): string {
  const regex = new RegExp(`## ${heading}\\r?\\n([\\s\\S]*?)(?:\\r?\\n## |$)`);
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

// ─── Migrate Vocabulary ──────────────────────────────────────────
async function migrateVocabulary() {
  const inboxDir = path.resolve('../inbox');
  if (!fs.existsSync(inboxDir)) {
    console.log('Inbox directory does not exist. Skipping vocabulary migration.');
    return;
  }

  const files = fs.readdirSync(inboxDir).filter(f => f.endsWith('.md'));
  console.log(`Found ${files.length} vocabulary files to migrate.`);

  const records = [];
  for (const file of files) {
    const filePath = path.join(inboxDir, file);
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const { metadata, content } = parseFrontmatterAndContent(rawContent);

    const word = file.replace('.md', '');
    const meanings = extractSection(content, 'Meanings');
    const grammar = extractSection(content, 'Grammar');
    const dailyUse = extractSection(content, 'Daily Use Case');
    const professionalUse = extractSection(content, 'Professional Use Case');
    const tips = extractSection(content, 'Tips');
    const caution = extractSection(content, 'Caution');

    records.push({
      fields: {
        word,
        meanings,
        level: metadata.level || 'B1',
        type: metadata.type || 'new',
        correctCount: parseInt(metadata.correct_count || '0', 10),
        grammar,
        dailyUse,
        professionalUse,
        tips,
        caution,
        isProcessed: true,
        updatedAt: new Date().toISOString(),
      }
    });
  }

  if (records.length > 0) {
    const res = await fetch(`${base}/tables/Vocabulary/records`, {
      method: 'POST',
      headers: gristHeaders,
      body: JSON.stringify({ records }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to save vocabulary: ${res.status} ${text}`);
    }
    console.log(`Successfully migrated ${records.length} vocabulary words.`);
  }
}

// ─── Migrate Reading and Speaking ─────────────────────────────────
async function migrateReadingAndSpeaking() {
  const readingFile = path.resolve('../reading/20260626_alltag-und-trends-im-software-engineering.md');
  const audioFile = path.resolve('../speaking/20260626_alltag-und-trends-im-software-engineering.mp3');
  const speakingFile = path.resolve('../speaking/20260626_alltag-und-trends-im-software-engineering.md');

  if (!fs.existsSync(readingFile)) {
    console.log('Reading practice file not found. Skipping reading migration.');
    return;
  }

  // 1. Upload audio to Publitio
  let audioFileId = 'demo-audio-id';
  if (fs.existsSync(audioFile)) {
    audioFileId = await uploadToPublitio(audioFile, 'audio/mp3');
  }

  // 2. Parse Reading Practice
  const readingRaw = fs.readFileSync(readingFile, 'utf-8');
  const { metadata: rMeta, content: rContent } = parseFrontmatterAndContent(readingRaw);
  
  // Extract German text (from beginning of content to "## Fragen zum Text")
  const textEndIndex = rContent.indexOf('## Fragen zum Text');
  const germanText = textEndIndex !== -1 ? rContent.substring(0, textEndIndex).trim() : rContent;

  // Parse questions, user answers, and corrections
  const questions: string[] = [];
  const userAnswers: string[] = [];
  const correctionsArray: {
    question: string;
    userAnswer: string;
    evaluation: string;
    correction: string;
    explanation: string;
  }[] = [];

  const qaSection = textEndIndex !== -1 ? rContent.substring(textEndIndex) : '';
  const qMatches = qaSection.matchAll(/\d+\.\s+(.*?)\r?\n\s+-\s+\*\*Ihre Antwort:\*\*\s*(.*?)\r?\n([\s\S]*?)(?=\d+\.\s+|$)/g);
  
  for (const match of qMatches) {
    const question = match[1].trim();
    const answer = match[2].trim();
    const blockText = match[3].trim();

    questions.push(question);
    userAnswers.push(answer);

    // Extract sub-fields
    const evalMatch = blockText.match(/\*\*Inhaltliche Bewertung:\*\*\s*(.*)/);
    const evaluation = evalMatch ? evalMatch[1].trim().replace(/\*\*/g, "") : "";

    const corrMatch = blockText.match(/\*\*Korrektur:\*\*\s*(.*)/);
    const correction = corrMatch 
      ? corrMatch[1].trim().replace(/^[„"“']|[„"“']$/g, "").replace(/\*\*/g, "") 
      : "";

    const explIndex = blockText.indexOf("**Erklärung:**");
    let explanation = "";
    if (explIndex !== -1) {
      explanation = blockText.substring(explIndex + 14).trim();
      explanation = explanation
        .replace(/\*\*/g, "")
        .replace(/\t/g, "")
        .replace(/^\s*-\s*/gm, "")
        .replace(/^\s*/gm, "");
    }

    correctionsArray.push({
      question,
      userAnswer: answer,
      evaluation,
      correction,
      explanation,
    });
  }

  const topic = 'Alltag und Trends im Software Engineering';

  // Save to ReadingPractice
  console.log('Saving ReadingPractice record to Grist...');
  const rRes = await fetch(`${base}/tables/ReadingPractice/records`, {
    method: 'POST',
    headers: gristHeaders,
    body: JSON.stringify({
      records: [
        {
          fields: {
            topic,
            germanText,
            audioFileId,
            questionsJson: JSON.stringify(questions),
            userAnswersJson: JSON.stringify(userAnswers),
            correctionsJson: JSON.stringify(correctionsArray),
            status: 'evaluated',
            date: rMeta.date || '2026-06-26',
          }
        }
      ]
    }),
  });
  if (!rRes.ok) {
    const text = await rRes.text();
    throw new Error(`Failed to save reading practice: ${rRes.status} ${text}`);
  }
  console.log('ReadingPractice record saved.');

  // 3. Parse Speaking Practice
  if (fs.existsSync(speakingFile)) {
    console.log('Parsing and migrating SpeakingPractice...');
    const speakingRaw = fs.readFileSync(speakingFile, 'utf-8');
    const { metadata: sMeta, content: sContent } = parseFrontmatterAndContent(speakingRaw);

    // Extract target text (using the same German text as reading)
    const targetText = germanText.replace(/!\[\[.*?\]\]/g, '').trim();

    // Extract first and second attempt feedback
    const transcript = sContent.match(/## Ihr Transkript \(Spoken Text\)\r?\n\r?\n> ([\s\S]*?)\r?\n\r?\n---/)?.[1].replace(/> /g, '').trim() || '';
    
    // Construct evaluation feedbacks
    const pronunciationFeedback = extractSection(sContent, 'Detailliertes Feedback zur Aussprache und Lesegenauigkeit');
    const grammarFeedback = 'See details under Adjectival endings and skipping words feedback.';
    const score = 95; // Second attempt evaluation

    // Save to SpeakingPractice
    const sRes = await fetch(`${base}/tables/SpeakingPractice/records`, {
      method: 'POST',
      headers: gristHeaders,
      body: JSON.stringify({
        records: [
          {
            fields: {
              topic,
              targetText,
              userAudioFileId: audioFileId, // Using same uploaded file for demo/historical continuity
              transcript,
              grammarFeedback,
              pronunciationFeedback,
              targetAudioFileId: audioFileId,
              score,
              status: 'assessed',
              date: sMeta.date || '2026-06-26',
            }
          }
        ]
      }),
    });
    if (!sRes.ok) {
      const text = await sRes.text();
      throw new Error(`Failed to save speaking practice: ${sRes.status} ${text}`);
    }
    console.log('SpeakingPractice record saved.');
  }
}

async function main() {
  await migrateVocabulary();
  await migrateReadingAndSpeaking();
  console.log('Migration complete.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
