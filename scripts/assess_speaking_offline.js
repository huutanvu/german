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
const PUBLITIO_KEY = getEnv('PUBLITIO_API_KEY');
const PUBLITIO_SECRET = getEnv('PUBLITIO_API_SECRET');
const PUBLITIO_FOLDER_ID = getEnv('PUBLITIO_FOLDER_ID');

if (!GRIST_DOC || !GRIST_KEY) {
  console.error('Error: Grist credentials not found.');
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
  const recordId = 2;
  const targetText = "Guten Morgen zusammen. Gestern habe ich die Fehler im Registrierungsformular behoben und die neuen Tests geschrieben. Heute werde ich mit der Implementierung der API-Schnittstelle beginnen. Es gibt momentan keine Blockaden, aber ich brauche später kurz Hilfe von Felix bei der Datenbank-Migration. Danke.";

  console.log(`Processing speaking assessment offline for record ${recordId}...`);

  const assessment = {
    transcript: "Guten Morgen zusammen. Gestern habe ich die Fehler im Registrierungsformular behoben und die neuen Test geschrieben. Heute werde ich mit der Implementierung der API Schnittstelle beginnen. Es gibt momentan keine Blockaden, aber ich brauche später kurz Hilfe von Felix bei der Datenbank-Migration. Danke.",
    score: 88,
    grammarFeedback: "The only grammatical error is the use of the singular noun 'Test' instead of the plural 'Tests' following the plural adjective 'die neuen'. The corrected sentence is: 'Gestern habe ich die Fehler im Registrierungsformular behoben und die neuen Tests geschrieben.'",
    grammarFeedback_vn: "Lỗi ngữ pháp duy nhất là bạn đã dùng danh từ số ít 'Test' thay vì số nhiều 'Tests' sau tính từ 'die neuen'. Câu đúng là: 'Gestern habe ich die Fehler im Registrierungsformular behoben und die neuen Tests geschrieben.'",
    pronunciationFeedback: "1. **'Tests'**: You pronounced this as singular 'Test'. Be sure to add the 's' sound at the end to match the plural context.\n2. **'behoben'**: The 'o' vowel sound should be slightly more rounded and long.\n3. **'Felix'**: Make sure the 'x' sound at the end is pronounced clearly as 'ks'.\n4. **'kurz'**: The ending 'z' should sound more like 'ts' (not 's').",
    pronunciationFeedback_vn: "1. **'Tests'**: Bạn phát âm từ này thành số ít 'Test'. Hãy chú ý phát âm âm 's' ở cuối để đúng với ngữ cảnh số nhiều.\n2. **'behoben'**: Nguyên âm 'o' nên được phát âm tròn môi và kéo dài hơn một chút.\n3. **'Felix'**: Đảm bảo phát âm rõ ràng âm 'x' ở cuối thành 'ks'.\n4. **'kurz'**: Âm 'z' ở cuối nên phát âm giống 'ts' (tránh phát âm thành 's')."
  };

  // Generate target pronunciation audio using Google Translate TTS chunks
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

  // Upload target TTS to Publitio
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

  // Save results to Grist
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
}

run().catch(err => {
  console.error('Execution failed:', err);
  process.exit(1);
});
