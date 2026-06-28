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

async function updateReview(reviewId, fields) {
  const res = await fetch(`${base}/tables/VocabularyReviews/records`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      records: [
        {
          id: reviewId,
          fields
        }
      ]
    })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update review ${reviewId}: ${text}`);
  }
}

async function updateVocabCount(vocabId, newCount) {
  const res = await fetch(`${base}/tables/Vocabulary/records`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      records: [
        {
          id: vocabId,
          fields: {
            correctCount: newCount
          }
        }
      ]
    })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update vocabulary ${vocabId}: ${text}`);
  }
}

async function run() {
  console.log('Correcting review 1 (werden)...');
  // Review 1: werden (correct, but capitalize)
  await updateReview(1, {
    correctedSentence: "Ich werde morgen ins Kino gehen.",
    correctionFeedback: "Very good! The sentence is grammatically correct. Remember to capitalize the first letter of the sentence ('Ich') and nouns ('Kino').",
    correctionFeedback_vn: "Rất tốt! Câu đúng ngữ pháp. Hãy nhớ viết hoa chữ cái đầu câu ('Ich') và viết hoa danh từ ('Kino').",
    status: "corrected",
    reviewedAt: Date.now() / 1000
  });
  await updateVocabCount(3, 1);

  console.log('Correcting review 2 (verbringen)...');
  // Review 2: verbringen (incorrect)
  await updateReview(2, {
    correctedSentence: "Ich verbringe das Wochenende damit, über KI zu lernen.",
    correctionFeedback: "Incorrect grammar. In German, you cannot stack verbs like 'verbringe ... lernen' directly. Use a 'damit, ... zu + infinitive' clause: 'Ich verbringe das Wochenende damit, über KI zu lernen.' (I spend the weekend learning about AI). Also, remember to capitalize the first letter and nouns.",
    correctionFeedback_vn: "Sai ngữ pháp. Trong tiếng Đức, bạn không thể ghép trực tiếp hai động từ như 'verbringe ... lernen'. Hãy sử dụng cấu trúc 'damit, ... zu + nguyên thể': 'Ich verbringe das Wochenende damit, über KI zu học.' (Tôi dành cuối tuần để học về AI). Đồng thời, hãy nhớ viết hoa đầu câu và danh từ.",
    status: "failed",
    reviewedAt: Date.now() / 1000
  });
  await updateVocabCount(4, 0);

  console.log('Correction workflow completed successfully!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
