const fs = require('fs');
const path = require('path');

// Load environment variables manually
const envPath = '/home/tvu/work/german/frontend/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnv = (key) => {
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : '';
};

const GRIST_URL = getEnv('GRIST_URL') || 'https://docs.getgrist.com/api';
const GRIST_DOC = getEnv('GRIST_DOC');
const GRIST_KEY = getEnv('GRIST_KEY');
const GEMINI_API_KEY = getEnv('GEMINI_API_KEY');

const GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

async function callGemini(body) {
  let lastError = null;
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
        lastError = new Error(`Empty response from ${model}`);
      } else {
        const errText = await res.text();
        console.warn(`Gemini model ${model} failed: ${errText}`);
        lastError = new Error(`${model}: ${res.status} ${errText}`);
      }
    } catch (e) {
      console.warn(`Error calling ${model}:`, e);
      lastError = e;
    }
  }
  throw lastError || new Error("All Gemini models failed");
}

async function getLearningContext() {
  const res = await fetch(`${GRIST_URL}/docs/${GRIST_DOC}/tables/LearningContext/records`, {
    headers: { Authorization: `Bearer ${GRIST_KEY}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.records?.[0] || null;
}

async function main() {
  console.log("Fetching learning context...");
  const context = await getLearningContext();
  const level = context?.fields?.targetLevel || 'B1';
  const currentTopic = context?.fields?.currentTopic || 'Code-Reviews im Team';

  console.log(`Generating reading practice from Gemini for Level ${level}, Topic: "${currentTopic}"...`);

  const prompt = `You are a German language teacher for software engineers.
Create a new German reading practice for level ${level} on the topic "${currentTopic}".

The response must be a JSON object with:
1. "topic": "A short, engaging title in German, e.g., 'Die Kunst des Code-Reviews' or similar"
2. "germanText": "An adapted German text of exactly 250-350 words. The language must be natural, CEFR level ${level}, focusing on the topic ${currentTopic} in a professional software engineering environment. Use bold markdown (**word**) for 4-5 interesting key vocabulary terms inside the text."
3. "tokens": A JSON array of token objects covering the entire "germanText" string without gaps, matching this schema:
   {
     "index": number (0-based sequential index),
     "spans": [[start, end], ...] (character offsets; for separable verbs, use exactly 2 spans [stem_span, prefix_span], for all other tokens use exactly 1 span),
     "type": "word" | "verb" | "separable" | "name" | "space" | "punctuation",
     "lemma": "canonical dictionary form of the token" (omitted for name, space, and punctuation. Nouns must include their definite article, e.g. "der Hund"; verbs must be bare infinitive, e.g. "abholen"; adjectives uninflected base form, e.g. "schnell")
   }
4. "questions": A JSON array of exactly 10 comprehension questions in German. The difficulties must be increasing from 1 to 10.
   Each question in the array must be an object with this schema:
   {
     "id": number (1 to 10),
     "type": "single_selection" | "multi_selection" | "yes_no" | "fill_in_gap",
     "question": "question text in German. For 'fill_in_gap', use '____' for the gap (do NOT include the option list inside the question string itself)",
     "options": ["Option 1", "Option 2", ...] (For 'yes_no', options MUST be exactly ["Ja", "Nein"]. For 'fill_in_gap', this field is REQUIRED and must contain the candidate words to fill the gap),
     "correct_answer": "correct option string" (or array of option strings for 'multi_selection'),
     "difficulty": number (1 to 10),
     "explanation": "Brief explanation of why this answer is correct in English",
     "explanation_vn": "Brief explanation of why this answer is correct in Vietnamese"
   }

Response format: ONLY return the JSON object matching this schema. No markdown formatting blocks around JSON.
{
  "topic": "...",
  "germanText": "...",
  "tokens": [...],
  "questions": [...]
}`;

  const reply = await callGemini({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" },
  });

  const parsed = JSON.parse(reply);
  console.log("Topic:", parsed.topic);
  console.log("Text length:", parsed.germanText.split(/\s+/).length, "words");
  console.log("Questions count:", parsed.questions.length);

  const gristUrl = `${GRIST_URL}/docs/${GRIST_DOC}/tables/ReadingPractice/records`;
  const today = new Date().toISOString().split("T")[0];

  console.log("Upserting into Grist...");
  const gristRes = await fetch(gristUrl, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${GRIST_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      records: [
        {
          require: { topic: parsed.topic },
          fields: {
            germanText: parsed.germanText,
            tokensJson: JSON.stringify({
              text: parsed.germanText,
              tokens: parsed.tokens
            }),
            questionsJson: JSON.stringify(parsed.questions),
            status: "pending_user",
            date: today,
            audioFileId: "",
            userAnswersJson: "[]",
            correctionsJson: "",
            correctionsJson_vn: ""
          }
        }
      ]
    })
  });

  if (!gristRes.ok) {
    const text = await gristRes.text();
    throw new Error(`Grist failed: ${gristRes.status} ${text}`);
  }

  const gristData = await gristRes.json();
  console.log("Grist success!", JSON.stringify(gristData, null, 2));
}

main().catch(err => {
  console.error("Failed:", err);
  process.exit(1);
});
