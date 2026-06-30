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

function compileAnnotatedText(seqTokens) {
  let text = "";
  let currentPos = 0;
  
  const tempTokens = seqTokens.map((st, idx) => {
    const start = currentPos;
    const end = currentPos + st.t.length;
    text += st.t;
    currentPos = end;
    
    return {
      index: idx,
      text: st.t,
      spans: [[start, end]],
      type: st.type || (st.t.trim() ? "word" : "space"),
      lemma: st.lemma,
      sepId: st.sepId
    };
  });
  
  const sepMap = new Map();
  tempTokens.forEach((t) => {
    if (t.sepId !== undefined) {
      if (t.type === "separable" || t.type === "verb" || (t.lemma && !t.type?.includes("prefix"))) {
        sepMap.set(t.sepId, t.index);
      }
    }
  });
  
  const finalTokens = [];
  tempTokens.forEach((t) => {
    if (t.sepId !== undefined) {
      const primaryIdx = sepMap.get(t.sepId);
      if (primaryIdx !== undefined && primaryIdx !== t.index) {
        const primaryToken = tempTokens[primaryIdx];
        if (primaryToken) {
          primaryToken.spans.push(t.spans[0]);
          primaryToken.type = "separable";
        }
        return;
      }
    }
    finalTokens.push({
      index: finalTokens.length,
      spans: t.spans,
      type: t.type,
      lemma: t.lemma
    });
  });
  
  finalTokens.forEach((t, idx) => {
    t.index = idx;
  });
  
  return {
    text,
    tokens: finalTokens
  };
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
3. "tokens": A JSON array of sequential token objects covering the entire "germanText" string without gaps. Do NOT calculate absolute character offsets yourself. Simply list every single token in sequential order (including spaces and punctuation) so that concatenating their "t" fields exactly reconstructs the "germanText" string.
   Each object in the tokens array must match:
   {
     "t": "token text (e.g. 'Im', ' ', 'Jahr', '.', 'ab')",
     "type": "word" | "verb" | "separable" | "prefix" | "name" | "space" | "punctuation",
     "lemma": "canonical dictionary form of the token" (omitted for space, punctuation, and proper name (type 'name'). Nouns must include definite article, e.g., 'das Jahr'. Verbs must use bare infinitive. Adjectives must be uninflected base form.),
     "sepId": number (Optional. If this is a separable verb, assign the same integer ID to both the verb stem token and its prefix token, e.g., 1)
   }

   Example of Sequential Tokenization for Separable Verbs:
   Sentence: "Ich hole ihn ab."
   Tokens list:
   [
     { "t": "Ich", "type": "word", "lemma": "ich" },
     { "t": " " },
     { "t": "hole", "type": "separable", "lemma": "abholen", "sepId": 1 },
     { "t": " " },
     { "t": "ihn", "type": "word", "lemma": "er" },
     { "t": " " },
     { "t": "ab", "type": "prefix", "sepId": 1 },
     { "t": "." }
   ]

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

  const compiled = compileAnnotatedText(parsed.tokens);

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
            topic: parsed.topic,
            germanText: compiled.text,
            tokensJson: JSON.stringify({
              text: compiled.text,
              tokens: compiled.tokens
            }),
            questionsJson: JSON.stringify(parsed.questions),
            level: level,
            profession: 'software_engineer',
            audioFileId: ""
          }
        }
      ]
    })
  });

  if (!gristRes.ok) {
    const text = await gristRes.text();
    throw new Error(`Grist failed: ${gristRes.status} ${text}`);
  }

  console.log("Reading practice generated successfully!");
}

main().catch(err => {
  console.error("Failed to run script:", err);
  process.exit(1);
});
