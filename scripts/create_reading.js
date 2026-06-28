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

const prompt = `You are a German language teacher for software engineers.
Create a new German reading practice for level B1 on the topic "Code-Reviews im Team" (General Software Engineering).

The response must be a JSON object with:
1. "topic": "A short, engaging title in German, e.g., 'Die Kunst des Code-Reviews' or similar"
2. "germanText": "An adapted German text of exactly 250-350 words. The language must be natural, B1 level, explaining what code reviews are, why they are useful in software engineering, and best practices (e.g. constructive feedback, small pull requests, continuous learning). Use bold markdown (**word**) for 4-5 interesting key vocabulary terms inside the text."
3. "questions": A JSON array of exactly 5 comprehension questions in German (e.g., ["Warum sind Code-Reviews wichtig?", ...])

Response format: ONLY return the JSON object matching this schema. No markdown formatting blocks around JSON.
{
  "topic": "...",
  "germanText": "...",
  "questions": ["...", "...", "...", "...", "..."]
}`;

async function main() {
  console.log("Generating reading practice from Gemini...");
  const reply = await callGemini({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" },
  });

  const parsed = JSON.parse(reply);
  console.log("Topic:", parsed.topic);
  console.log("Text length:", parsed.germanText.split(/\s+/).length, "words");
  console.log("Questions:", parsed.questions);

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
            questionsJson: JSON.stringify(parsed.questions),
            status: "pending_user",
            date: today,
            audioFileId: "",
            userAnswersJson: "[]",
            correctionsJson: ""
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
