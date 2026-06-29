#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables manually
const envPath = path.resolve(__dirname, '../frontend/.env.local');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (err) {
  console.error(`Error: Could not read env file at ${envPath}`);
  process.exit(1);
}

const getEnv = (key) => {
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
};

const GRIST_URL = getEnv('GRIST_URL') || 'https://docs.getgrist.com/api';
const GRIST_DOC = getEnv('GRIST_DOC');
const GRIST_KEY = getEnv('GRIST_KEY');
const PUBLITIO_KEY = getEnv('PUBLITIO_API_KEY');
const PUBLITIO_SECRET = getEnv('PUBLITIO_API_SECRET');
const PUBLITIO_FOLDER_ID = getEnv('PUBLITIO_FOLDER_ID');

if (!GRIST_DOC || !GRIST_KEY) {
  console.error('Error: Grist credentials not found in env config.');
  process.exit(1);
}

if (!PUBLITIO_KEY || !PUBLITIO_SECRET) {
  console.error('Error: Publitio api key/secret credentials not found in env config.');
  process.exit(1);
}

const base = `${GRIST_URL}/docs/${GRIST_DOC}`;
const headers = {
  Authorization: `Bearer ${GRIST_KEY}`,
  'Content-Type': 'application/json',
};

function getAuthParams(key, secret) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2, 10);
  const signature = crypto.createHash("sha1")
    .update(timestamp + nonce + secret)
    .digest("hex");
  return {
    api_key: key,
    api_timestamp: timestamp,
    api_nonce: nonce,
    api_signature: signature,
  };
}

function authQuery(key, secret) {
  return new URLSearchParams(getAuthParams(key, secret)).toString();
}

// Splits long text into small chunks to avoid Google TTS HTTP 400 errors for long strings
function splitTextIntoTTSChunks(text, maxLen = 150) {
  const sentencePattern = /[^.!?\n]+[.!?\n]*/g;
  const matches = text.match(sentencePattern) || [text];
  const chunks = [];
  
  for (const s of matches) {
    let trimmed = s.trim();
    if (!trimmed) continue;
    
    if (trimmed.length <= maxLen) {
      chunks.push(trimmed);
    } else {
      const words = trimmed.split(/\s+/);
      let currentChunk = "";
      for (const w of words) {
        if ((currentChunk + " " + w).length <= maxLen) {
          currentChunk = currentChunk ? currentChunk + " " + w : w;
        } else {
          if (currentChunk) chunks.push(currentChunk);
          currentChunk = w;
        }
      }
      if (currentChunk) chunks.push(currentChunk);
    }
  }
  return chunks;
}

// Synthesizes target text using Google Translate TTS
async function synthesizeTTS(text) {
  const chunks = splitTextIntoTTSChunks(text, 150);
  const ttsBuffers = [];

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=de&client=tw-ob&q=${encodeURIComponent(trimmed)}`;
    const ttsRes = await fetch(ttsUrl);
    
    if (ttsRes.ok) {
      const arr = await ttsRes.arrayBuffer();
      ttsBuffers.push(Buffer.from(arr));
    } else {
      console.warn(`Warning: Failed to synthesize chunk: "${trimmed}". Status: ${ttsRes.status}`);
    }
  }

  if (ttsBuffers.length === 0) {
    throw new Error("Failed to synthesize any TTS audio chunks.");
  }
  
  return Buffer.concat(ttsBuffers);
}

// Uploads synthesized audio buffer to Publitio and returns public_id
async function uploadToPublitio(buffer, filename) {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "audio/mp3" }), filename);
  if (PUBLITIO_FOLDER_ID) form.append("folder", PUBLITIO_FOLDER_ID);
  form.append("privacy", "1"); // Public

  const uploadRes = await fetch(`https://api.publit.io/v1/files/create?${authQuery(PUBLITIO_KEY, PUBLITIO_SECRET)}`, {
    method: "POST",
    body: form
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Publit.io upload failed: ${text}`);
  }

  const uploadData = await uploadRes.json();
  return uploadData.public_id;
}

async function processReadingPractices() {
  console.log('\n--- Checking ReadingPractice for missing voice overs ---');
  const res = await fetch(`${base}/tables/ReadingPractice/records`, { headers });
  if (!res.ok) {
    console.error(`Failed to fetch ReadingPractice records: ${res.status}`);
    return;
  }
  const data = await res.json();
  const records = data.records || [];
  
  const missing = records.filter(r => !r.fields.audioFileId);
  console.log(`Found ${missing.length} reading exercises missing audio.`);

  for (const r of missing) {
    console.log(`Processing Reading ID ${r.id}: "${r.fields.topic}"...`);
    try {
      const textToSpeak = r.fields.germanText;
      if (!textToSpeak) {
        console.warn(`Skipping ID ${r.id}: germanText is empty.`);
        continue;
      }
      
      const buffer = await synthesizeTTS(textToSpeak);
      const audioFileId = await uploadToPublitio(buffer, `reading_${r.id}.mp3`);
      
      // Update Grist
      const patchRes = await fetch(`${base}/tables/ReadingPractice/records`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          records: [{ id: r.id, fields: { audioFileId } }]
        })
      });
      
      if (patchRes.ok) {
        console.log(`Successfully updated Reading ID ${r.id} with audio file: ${audioFileId}`);
      } else {
        console.error(`Failed to save audioFileId for Reading ID ${r.id}: ${patchRes.status}`);
      }
    } catch (err) {
      console.error(`Failed to generate audio for Reading ID ${r.id}:`, err);
    }
  }
}

async function processSpeakingPractices() {
  console.log('\n--- Checking SpeakingPractice for missing target pronunciation audio ---');
  const res = await fetch(`${base}/tables/SpeakingPractice/records`, { headers });
  if (!res.ok) {
    console.error(`Failed to fetch SpeakingPractice records: ${res.status}`);
    return;
  }
  const data = await res.json();
  const records = data.records || [];
  
  const missing = records.filter(r => !r.fields.targetAudioFileId);
  console.log(`Found ${missing.length} speaking exercises missing target pronunciation.`);

  for (const r of missing) {
    console.log(`Processing Speaking ID ${r.id}: "${r.fields.topic}"...`);
    try {
      const textToSpeak = r.fields.targetText;
      if (!textToSpeak) {
        console.warn(`Skipping ID ${r.id}: targetText is empty.`);
        continue;
      }
      
      const buffer = await synthesizeTTS(textToSpeak);
      const targetAudioFileId = await uploadToPublitio(buffer, `speaking_target_${r.id}.mp3`);
      
      // Update Grist
      const patchRes = await fetch(`${base}/tables/SpeakingPractice/records`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          records: [{ id: r.id, fields: { targetAudioFileId } }]
        })
      });
      
      if (patchRes.ok) {
        console.log(`Successfully updated Speaking ID ${r.id} with target audio: ${targetAudioFileId}`);
      } else {
        console.error(`Failed to save targetAudioFileId for Speaking ID ${r.id}: ${patchRes.status}`);
      }
    } catch (err) {
      console.error(`Failed to generate audio for Speaking ID ${r.id}:`, err);
    }
  }
}

async function run() {
  await processReadingPractices();
  await processSpeakingPractices();
  console.log('\nTTS voice over checks finished.');
}

run().catch(console.error);
