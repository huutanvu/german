const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables manually
const envPath = '/home/tvu/work/german/frontend/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnv = (key) => {
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
};

const GRIST_URL = getEnv('GRIST_URL') || 'https://docs.getgrist.com/api';
const GRIST_DOC = getEnv('GRIST_DOC');
const GRIST_KEY = getEnv('GRIST_KEY');
const getGeminiApiKeys = () => {
  return [
    getEnv('GEMINI_API_KEY'),
    getEnv('GEMINI_API_KEY_2'),
    getEnv('GEMINI_API_KEY_3'),
    getEnv('GEMINI_API_KEY_4')
  ].filter(key => !!key && key.trim() !== "");
};

const keys = getGeminiApiKeys();
const PUBLITIO_KEY = getEnv('PUBLITIO_API_KEY');
const PUBLITIO_SECRET = getEnv('PUBLITIO_API_SECRET');
const PUBLITIO_FOLDER_ID = getEnv('PUBLITIO_FOLDER_ID');

if (!GRIST_DOC || !GRIST_KEY || keys.length === 0) {
  console.error('Error: Grist or Gemini credentials not found.');
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

async function run() {
  // 1. Fetch pending SpeakingPractice records
  const listRes = await fetch(`${base}/tables/SpeakingPractice/records`, { headers });
  if (!listRes.ok) {
    throw new Error(`Failed to fetch speaking practice: ${listRes.statusText}`);
  }
  const listData = await listRes.json();
  const pending = listData.records.find(r => r.fields.status === 'pending_assessment');

  if (!pending) {
    console.log('No pending speaking practice reviews found.');
    return;
  }

  const recordId = pending.id;
  const targetText = pending.fields.targetText;
  const userAudioFileId = pending.fields.userAudioFileId;

  console.log(`Processing record ${recordId}. User audio: ${userAudioFileId}`);

  // 2. Fetch user's recorded audio file
  const userAudioUrl = `https://media.publit.io/file/${userAudioFileId}.webm`;
  console.log(`Downloading user audio from ${userAudioUrl}...`);
  const audioRes = await fetch(userAudioUrl);
  if (!audioRes.ok) {
    throw new Error(`Failed to download user audio: ${audioRes.status}`);
  }
  const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
  const audioBase64 = audioBuffer.toString('base64');

  // 3. Send to Gemini for transcription and assessment
  const prompt = `You are a German speaking instructor.
Analyze the user's recorded audio (audio/webm) and compare it against the reference text:
"${targetText}"

Perform the following:
1. Transcribe the audio precisely as the user said it.
2. Rate the pronunciation score out of 100.
3. Provide grammar feedback and corrections in English.
4. Provide grammar feedback and corrections in Vietnamese.
5. Provide pronunciation feedback, listing any mispronounced words and how to correct them, in English.
6. Provide pronunciation feedback, listing any mispronounced words and how to correct them, in Vietnamese.

Respond strictly with a JSON object in this format:
{
  "transcript": "precisely transcribed text",
  "score": 85,
  "grammarFeedback": "Grammar and sentence feedback in English.",
  "grammarFeedback_vn": "Grammar and sentence feedback in Vietnamese.",
  "pronunciationFeedback": "Pronunciation feedback and corrections in English.",
  "pronunciationFeedback_vn": "Pronunciation feedback and corrections in Vietnamese."
}`;

  console.log('Calling Gemini for assessment...');
  const models = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.0-flash"];
  let geminiReply = null;
  let lastError = null;

  for (const currentKey of keys) {
    for (const model of models) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${currentKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: "audio/webm",
                      data: audioBase64
                    }
                  },
                  {
                    text: prompt
                  }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: 'application/json',
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          geminiReply = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (geminiReply) break;
        } else {
          const errText = await res.text();
          console.warn(`Model ${model} failed with key starting with ${currentKey.substring(0, 5)}...: ${res.status} ${errText}`);
          lastError = new Error(`${model} failed: ${res.status}`);
        }
      } catch (err) {
        console.warn(`Fetch error for model ${model} with key starting with ${currentKey.substring(0, 5)}...:`, err);
        lastError = err;
      }
    }
    if (geminiReply) break;
  }


  if (!geminiReply) {
    throw new Error('Gemini assessment failed across all models.');
  }

  console.log('Gemini assessment succeeded.');
  const assessment = JSON.parse(geminiReply);

  // 4. Generate target pronunciation audio using Google Translate TTS chunks
  console.log('Synthesizing target German pronunciation...');
  const sentences = targetText.match(/[^.!?]+[.!?]+/g) || [targetText];
  const ttsBuffers = [];

  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=de&client=tw-ob&q=${encodeURIComponent(trimmed)}`;
    const ttsRes = await fetch(ttsUrl);
    if (ttsRes.ok) {
      const arr = await ttsRes.arrayBuffer();
      ttsBuffers.push(Buffer.from(arr));
    }
  }

  const ttsBuffer = Buffer.concat(ttsBuffers);

  // 5. Upload target TTS to Publitio
  console.log('Uploading target TTS to Publitio...');
  const form = new FormData();
  form.append("file", new Blob([ttsBuffer], { type: "audio/mp3" }), "target_tts.mp3");
  if (PUBLITIO_FOLDER_ID) form.append("folder", PUBLITIO_FOLDER_ID);
  form.append("privacy", "1"); // public

  const uploadRes = await fetch(`https://api.publit.io/v1/files/create?${authQuery(PUBLITIO_KEY, PUBLITIO_SECRET)}`, {
    method: "POST",
    body: form
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Publit.io upload failed: ${text}`);
  }

  const uploadData = await uploadRes.json();
  const targetAudioFileId = uploadData.public_id;
  console.log(`Target TTS uploaded successfully. ID: ${targetAudioFileId}`);

  // 6. Save results to Grist
  console.log('Saving results to Grist...');
  const updateRes = await fetch(`${base}/tables/SpeakingPractice/records`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      records: [
        {
          id: recordId,
          fields: {
            transcript: assessment.transcript,
            score: assessment.score,
            grammarFeedback: assessment.grammarFeedback,
            grammarFeedback_vn: assessment.grammarFeedback_vn,
            pronunciationFeedback: assessment.pronunciationFeedback,
            pronunciationFeedback_vn: assessment.pronunciationFeedback_vn,
            targetAudioFileId: targetAudioFileId,
            status: 'assessed'
          }
        }
      ]
    })
  });

  if (!updateRes.ok) {
    const text = await updateRes.text();
    throw new Error(`Failed to save Grist record: ${text}`);
  }

  console.log('Assessment complete and saved successfully!');
  console.log(JSON.stringify(assessment, null, 2));
}

run().catch(err => {
  console.error('Execution failed:', err);
  process.exit(1);
});
