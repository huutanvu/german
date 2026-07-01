import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

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
function getGeminiApiKeys(): string[] {
  return [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4
  ].filter((key): key is string => !!key && key.trim() !== "");
}

const keys = getGeminiApiKeys();
if (keys.length === 0) {
  console.error('Error: No GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3, or GEMINI_API_KEY_4 found in environment variables. Please get a free key from https://aistudio.google.com and add it to your .env file.');
  process.exit(1);
}

if (!GRIST_DOC || !GRIST_KEY) {
  console.error('Error: Grist credentials not found.');
  process.exit(1);
}

const base = `${GRIST_URL}/docs/${GRIST_DOC}`;
const headers = {
  Authorization: `Bearer ${GRIST_KEY}`,
  'Content-Type': 'application/json',
};

const PUBLITIO_KEY = process.env.PUBLITIO_API_KEY ?? '';
const PUBLITIO_SECRET = process.env.PUBLITIO_API_SECRET ?? '';
const PUBLITIO_FOLDER_ID = process.env.PUBLITIO_FOLDER_ID ?? '';

function getAuthParams(): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2, 10);
  const signature = createHash('sha1')
    .update(timestamp + nonce + PUBLITIO_SECRET)
    .digest('hex');
  return {
    api_key: PUBLITIO_KEY,
    api_timestamp: timestamp,
    api_nonce: nonce,
    api_signature: signature,
  };
}

async function uploadFileToPublitio(file: Buffer, filename: string, mimeType = 'audio/wav'): Promise<string | null> {
  if (!PUBLITIO_KEY || !PUBLITIO_SECRET) {
    console.warn("Publit.io credentials not found, skipping audio upload.");
    return null;
  }
  try {
    const authParams = getAuthParams();
    const query = new URLSearchParams(authParams).toString();
    const form = new FormData();
    form.append('file', new Blob([file], { type: mimeType }), filename);
    if (PUBLITIO_FOLDER_ID) {
      form.append('folder', PUBLITIO_FOLDER_ID);
    }
    form.append('privacy', '1');

    const res = await fetch(`https://api.publit.io/v1/files/create?${query}`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn(`Publit.io upload failed: ${res.status} ${text}`);
      return null;
    }
    const json = await res.json() as any;
    return json.id || null;
  } catch (err) {
    console.error("Error uploading audio to Publitio:", err);
    return null;
  }
}

interface WavConversionOptions {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
}

function parseMimeType(mimeType: string): WavConversionOptions {
  const [fileType, ...params] = mimeType.split(";").map((s) => s.trim());
  const [_, format] = fileType.split("/");

  const options: Partial<WavConversionOptions> = {
    numChannels: 1,
  };

  if (format && format.startsWith("L")) {
    const bits = parseInt(format.slice(1), 10);
    if (!isNaN(bits)) {
      options.bitsPerSample = bits;
    }
  }

  for (const param of params) {
    const [key, value] = param.split("=").map((s) => s.trim());
    if (key === "rate") {
      options.sampleRate = parseInt(value, 10);
    }
  }

  return options as WavConversionOptions;
}

function createWavHeader(dataLength: number, options: WavConversionOptions): Buffer {
  const { numChannels, sampleRate, bitsPerSample } = options;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const buffer = Buffer.alloc(44);

  buffer.write("RIFF", 0); // ChunkID
  buffer.writeUInt32LE(36 + dataLength, 4); // ChunkSize
  buffer.write("WAVE", 8); // Format
  buffer.write("fmt ", 12); // Subchunk1ID
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22); // NumChannels
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(byteRate, 28); // ByteRate
  buffer.writeUInt16LE(blockAlign, 32); // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34); // BitsPerSample
  buffer.write("data", 36); // Subchunk2ID
  buffer.writeUInt32LE(dataLength, 40); // Subchunk2Size

  return buffer;
}

function convertToWav(rawData: string, mimeType: string): Buffer {
  const options = parseMimeType(mimeType);
  const wavHeader = createWavHeader(rawData.length, options);
  const buffer = Buffer.from(rawData, "base64");

  return Buffer.concat([wavHeader, buffer]);
}

async function generateVoiceOver(apiKey: string | undefined, word: string): Promise<Buffer | null> {
  const activeKeys = getGeminiApiKeys();
  if (apiKey && !activeKeys.includes(apiKey)) {
    activeKeys.unshift(apiKey);
  }
  if (activeKeys.length === 0) {
    console.warn("No Gemini API keys configured in environment variables.");
    return null;
  }

  const prompt = `Read the following transcript based on the audio profile and director's note.

# Audio Profile
A clear and authoritative corporate trainer.

# Director's note
Style: Professional, authoritative, clear articulation with standard broadcast cadence. Pace: Natural conversational pace. Accent: Neutral.

## Scene:
The Corporate Studio.

## Sample Context:
Instructional E-learning. Measured pacing with clear pauses for clarity. Tone is authoritative, accessible, and articulate.

## Transcript:
${word}`;

  let lastError: Error | null = null;
  for (const currentKey of activeKeys) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=${currentKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseModalities: ["audio"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: "Leda",
                  },
                },
              },
            },
          }),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`TTS generation API returned status ${res.status}: ${errText}`);
        lastError = new Error(`TTS status ${res.status}: ${errText}`);
        continue;
      }

      const data = await res.json() as any;
      const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!inlineData || !inlineData.data) {
        console.warn("No inline audio data in Gemini response");
        lastError = new Error("No inline audio data in Gemini response");
        continue;
      }

      const mimeType = inlineData.mimeType || "audio/L16;rate=24000";
      return convertToWav(inlineData.data, mimeType);
    } catch (err: any) {
      console.error(`Error generating TTS voice over with key starting with ${currentKey.substring(0, 5)}:`, err);
      lastError = err;
    }
  }
  return null;
}

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
Reconstruct the correct base form (infinitive for verbs, nominative singular with gender article for nouns, base form for adjectives). Pay special attention to German separable verbs. For articles (e.g. der/die/das/dem/den/des, ein/eine/einem/einen/einer), always map them to exactly the clean clicked word form (e.g. if the input is 'dem', return exactly 'dem' as the resolved word, do not map it to 'der'). Do not add any parenthetical information, suffixes, or explanations to the resolved word name (e.g. return 'dem' instead of 'dem (dative)'). Instead, explain the grammatical function, case, and context (e.g. Dativ form of der/das) inside the grammar notes field.

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
  const activeKeys = getGeminiApiKeys();
  for (const currentKey of activeKeys) {
    for (const model of models) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${currentKey}`, {
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
          console.warn(`Gemini model ${model} failed with key starting with ${currentKey.substring(0, 5)}... (${res.status}): ${errText}`);
          lastError = new Error(`${model}: ${res.status} ${errText}`);
        }
      } catch (e: any) {
        console.warn(`Error calling ${model} with key starting with ${currentKey.substring(0, 5)}...:`, e);
        lastError = e;
      }
    }
  }

  throw lastError ?? new Error('All Gemini API keys and models failed');
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

      let audioFileId = '';
      try {
        console.log(`Generating TTS voice over for "${result.word}"...`);
        const audioBuffer = await generateVoiceOver(undefined, result.word);
        if (audioBuffer) {
          const cleanWord = result.word.trim();
          const fileId = await uploadFileToPublitio(audioBuffer, `${cleanWord}.wav`, 'audio/wav');
          if (fileId) {
            audioFileId = fileId;
            console.log(`Uploaded voice over to Publitio. File ID: ${audioFileId}`);
          }
        }
      } catch (audioErr) {
        console.error(`Failed to generate/upload voice over for "${result.word}":`, audioErr);
      }

      const updatePayload = {
        word: result.word,
        meanings: result.meanings,
        meanings_vn: result.meanings_vn,
        level: result.level || "B1",
        grammar: result.grammar,
        grammar_vn: result.grammar_vn,
        partOfSpeech: result.partOfSpeech,
        audioFileId,
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
