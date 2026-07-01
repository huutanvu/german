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
const getGeminiApiKeys = () => {
  return [
    getEnv('GEMINI_API_KEY'),
    getEnv('GEMINI_API_KEY_2'),
    getEnv('GEMINI_API_KEY_3'),
    getEnv('GEMINI_API_KEY_4')
  ].filter(key => !!key && key.trim() !== "");
};

const keys = getGeminiApiKeys();

if (!GRIST_DOC || !GRIST_KEY || keys.length === 0) {
  console.error('Error: Grist or Gemini credentials not found.');
  process.exit(1);
}

const GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

async function callGemini(body) {
  let lastError = null;
  for (const currentKey of keys) {
    for (const model of GEMINI_MODELS) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${currentKey}`,
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
          console.warn(`Gemini model ${model} failed with key starting with ${currentKey.substring(0, 5)}...: ${errText}`);
          lastError = new Error(`${model}: ${res.status} ${errText}`);
        }
      } catch (e) {
        console.warn(`Error calling ${model} with key starting with ${currentKey.substring(0, 5)}...:`, e);
        lastError = e;
      }
    }
  }
  throw lastError ?? new Error("All Gemini models and API keys failed");
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

  console.log(`Generating grammar practice from Gemini for Level ${level}, Topic: "${currentTopic}"...`);

  const prompt = `You are a German grammar expert and teacher for software engineers.
Create a new German grammar drill session for level ${level} on the topic "${currentTopic}".

The response must be a JSON object with:
1. "topic": "A short, descriptive grammar focus title in German, e.g., 'Akkusativ- vs. Dativ-Präpositionen im Scrum' or 'Adjektivendungen in Code-Reviews'"
2. "description": "Brief guidelines/tips on this grammar topic in English (2-3 sentences max)"
3. "questions": A JSON array of exactly 15 quick-fire grammar drill questions. The difficulties must be increasing from 1 to 15.
   Each question in the array must be an object with this schema:
   {
     "id": number (1 to 15),
     "type": "single_selection" | "multi_selection" | "yes_no" | "fill_in_gap",
     "question": "The question in German. For 'fill_in_gap', use '____' for the missing grammar element (e.g., article, ending, preposition). Do NOT include options in brackets in the question string.",
     "options": ["Option 1", "Option 2", ...] (For 'yes_no', options MUST be exactly ["Ja", "Nein"]. For 'fill_in_gap', this field is REQUIRED and must list 3 or 4 candidate options like noun suffixes, articles, or preposition forms),
     "correct_answer": "correct option string" (or array of option strings for 'multi_selection'),
     "difficulty": number (1 to 15),
     "explanation": "Brief explanation of the grammatical rule in English",
     "explanation_vn": "Brief explanation of the grammatical rule in Vietnamese"
   }

Response format: ONLY return the JSON object matching this schema. No markdown formatting blocks around JSON.
{
  "topic": "...",
  "description": "...",
  "questions": [...]
}`;

  const reply = await callGemini({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" },
  });

  const parsed = JSON.parse(reply);
  console.log("Topic:", parsed.topic);
  console.log("Description:", parsed.description);
  console.log("Questions count:", parsed.questions.length);

  const gristUrl = `${GRIST_URL}/docs/${GRIST_DOC}/tables/GrammarPractice/records`;
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
            description: parsed.description,
            questionsJson: JSON.stringify(parsed.questions),
            status: "pending_user",
            date: today,
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
