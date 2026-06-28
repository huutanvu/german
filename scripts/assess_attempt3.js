const fs = require('fs');
const path = require('path');

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

if (!GRIST_DOC || !GRIST_KEY) {
  console.error('Error: Grist credentials not found.');
  process.exit(1);
}

const base = `${GRIST_URL}/docs/${GRIST_DOC}`;
const headers = {
  Authorization: `Bearer ${GRIST_KEY}`,
  'Content-Type': 'application/json',
};

async function run() {
  const recordId = 3;
  console.log(`Processing speaking assessment offline for record ${recordId}...`);

  const assessment = {
    transcript: "Guten Morgen zusammen. Gestern habe ich die Fehler im Registrierungsformular behoben und die neuen Tests geschrieben. Heute werde ich mit der Implementierung der API-Schnittstelle beginnen. Es gibt momentan keine Blockaden, aber ich brauche später kurz Hilfe von Felix bei der Datenbank-Migration. Danke.",
    score: 96,
    grammarFeedback: "Perfect! The sentence is grammatically flawless, and you capitalized all nouns and the start of sentences correctly in your speech.",
    grammarFeedback_vn: "Hoàn hảo! Các câu nói hoàn toàn chính xác về mặt ngữ pháp, việc phát âm của bạn đã thể hiện đúng cấu trúc ngữ pháp.",
    pronunciationFeedback: "Great job! You corrected the previous mistakes:\n1. **'Tests'**: You pronounced the plural 's' correctly this time.\n2. **'behoben'**: Vowel sound 'o' is much better rounded and pronounced.\n3. **'Felix'** and **'kurz'**: The ending sounds were pronounced clearly and accurately.\nOverall, a very fluent and clear pronunciation.",
    pronunciationFeedback_vn: "Làm tốt lắm! Bạn đã khắc phục các lỗi trước đó:\n1. **'Tests'**: Lần này bạn đã phát âm chính xác âm 's' số nhiều.\n2. **'behoben'**: Nguyên âm 'o' đã được phát âm tròn môi và tự nhiên hơn nhiều.\n3. **'Felix'** và **'kurz'**: Các âm cuối được phát âm rất rõ ràng và chính xác.\nNhìn chung, phát âm rất trôi chảy và rõ ràng."
  };

  // Save results to Grist (keeping targetAudioFileId intact)
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
