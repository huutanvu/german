"use server";

import type {
  GristResponse,
  LearningContextFields,
  VocabularyFields,
  VocabularyReviewFields,
  WritingPracticeFields,
  ReadingPracticeFields,
  SpeakingPracticeFields,
  LearningContext,
  Vocabulary,
  VocabularyReview,
  WritingPractice,
  ReadingPractice,
  SpeakingPractice,
} from "./types";

const GRIST_URL = process.env.GRIST_URL ?? process.env.NEXT_PUBLIC_GRIST_URL ?? "https://docs.getgrist.com/api";
const GRIST_DOC = process.env.GRIST_DOC ?? process.env.NEXT_PUBLIC_GRIST_DOC ?? "";
const GRIST_KEY = process.env.GRIST_KEY ?? process.env.NEXT_PUBLIC_GRIST_KEY ?? "";

const base = `${GRIST_URL}/docs/${GRIST_DOC}`;

// ---------------------------------------------------------------------------
// Gemini helper with model fallback chain
// ---------------------------------------------------------------------------
const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-2.0-flash",
  "gemini-3.5-flash",
];

async function callGemini(
  apiKey: string,
  body: object
): Promise<string> {
  let lastError: Error | null = null;
  for (const model of GEMINI_MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (res.ok) {
      const data = await res.json() as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
      lastError = new Error(`Empty response from ${model}`);
    } else {
      const errText = await res.text();
      console.warn(`Gemini model ${model} failed (${res.status}): ${errText}`);
      lastError = new Error(`${model}: ${res.status} ${errText}`);
    }
  }
  throw lastError ?? new Error("All Gemini models failed");
}



async function gristGet<T>(path: string): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${GRIST_KEY}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Grist GET ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

async function gristWrite<T>(
  method: string,
  path: string,
  body: unknown
): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${GRIST_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Grist ${method} ${path} failed (${res.status}): ${text}`
    );
  }
  return res.json() as Promise<T>;
}

// ─── Learning Context ───────────────────────────────────────────

export async function getLearningContext(): Promise<LearningContext | null> {
  const res = await gristGet<GristResponse<LearningContextFields>>("/tables/LearningContext/records");
  return res.records.length > 0 ? res.records[0] : null;
}

export async function updateLearningContext(
  rowId: number,
  fields: Partial<LearningContextFields>
): Promise<void> {
  await gristWrite("PUT", "/tables/LearningContext/records", {
    records: [
      {
        require: { id: rowId },
        fields: { ...fields, updatedAt: new Date().toISOString() },
      },
    ],
  });
}

// ─── Vocabulary ─────────────────────────────────────────────────

export async function listVocabulary(
  level?: string,
  type?: string
): Promise<GristResponse<VocabularyFields>> {
  const filters: Record<string, string[]> = {};
  if (level) filters.level = [level];
  if (type) filters.type = [type];

  const query = Object.keys(filters).length
    ? `?filter=${encodeURIComponent(JSON.stringify(filters))}`
    : "";

  return gristGet<GristResponse<VocabularyFields>>(`/tables/Vocabulary/records${query}`);
}

export async function getVocabularyByWord(word: string | string[]): Promise<Vocabulary | null> {
  const words = Array.isArray(word) ? word : [word];
  const query = `?filter=${encodeURIComponent(JSON.stringify({ word: words }))}`;
  const res = await gristGet<GristResponse<VocabularyFields>>(`/tables/Vocabulary/records${query}`);
  return res.records.length > 0 ? res.records[0] : null;
}

export async function createVocabulary(
  fields: Partial<VocabularyFields>
): Promise<{ records: { id: number }[] }> {
  return gristWrite("POST", "/tables/Vocabulary/records", {
    records: [{ fields: { ...fields, correctCount: 0, updatedAt: new Date().toISOString() } }],
  });
}

export async function updateVocabulary(
  rowId: number,
  fields: Partial<VocabularyFields>
): Promise<void> {
  await gristWrite("PATCH", "/tables/Vocabulary/records", {
    records: [{ id: rowId, fields: { ...fields, updatedAt: new Date().toISOString() } }],
  });
}

// ─── Vocabulary Reviews ──────────────────────────────────────────

export async function listReviews(
  status?: string
): Promise<GristResponse<VocabularyReviewFields>> {
  const filters: Record<string, string[]> = {};
  if (status) filters.status = [status];

  const query = Object.keys(filters).length
    ? `?filter=${encodeURIComponent(JSON.stringify(filters))}`
    : "";

  return gristGet<GristResponse<VocabularyReviewFields>>(`/tables/VocabularyReviews/records${query}`);
}

export async function upsertReview(
  vocabId: number,
  userSentence: string,
  status: 'pending_correction' | 'corrected' | 'failed' = 'pending_correction'
): Promise<void> {
  await gristWrite("PUT", "/tables/VocabularyReviews/records", {
    records: [
      {
        require: { vocabId, status: 'pending_correction' },
        fields: { userSentence, status, reviewedAt: new Date().toISOString() },
      },
    ],
  });
}

export async function updateReview(
  rowId: number,
  fields: Partial<VocabularyReviewFields>
): Promise<void> {
  await gristWrite("PATCH", "/tables/VocabularyReviews/records", {
    records: [{ id: rowId, fields }],
  });
}

// ─── Writing Practice ───────────────────────────────────────────

export async function listWritingPractices(
  status?: string
): Promise<GristResponse<WritingPracticeFields>> {
  const filters: Record<string, string[]> = {};
  if (status) filters.status = [status];

  const query = Object.keys(filters).length
    ? `?filter=${encodeURIComponent(JSON.stringify(filters))}`
    : "";

  return gristGet<GristResponse<WritingPracticeFields>>(`/tables/WritingPractice/records${query}`);
}

export async function upsertWritingPractice(
  topic: string,
  fields: Partial<WritingPracticeFields>
): Promise<void> {
  await gristWrite("PUT", "/tables/WritingPractice/records", {
    records: [
      {
        require: { topic },
        fields: { ...fields, date: new Date().toISOString().split("T")[0] },
      },
    ],
  });
}

// ─── Reading Practice ────────────────────────────────────────────

export async function listReadingPractices(
  status?: string
): Promise<GristResponse<ReadingPracticeFields>> {
  const filters: Record<string, string[]> = {};
  if (status) filters.status = [status];

  const query = Object.keys(filters).length
    ? `?filter=${encodeURIComponent(JSON.stringify(filters))}`
    : "";

  return gristGet<GristResponse<ReadingPracticeFields>>(`/tables/ReadingPractice/records${query}`);
}

export async function upsertReadingPractice(
  topic: string,
  fields: Partial<ReadingPracticeFields>
): Promise<void> {
  await gristWrite("PUT", "/tables/ReadingPractice/records", {
    records: [
      {
        require: { topic },
        fields: { ...fields, date: new Date().toISOString().split("T")[0] },
      },
    ],
  });
}

// ─── Speaking Practice ───────────────────────────────────────────

export async function listSpeakingPractices(
  status?: string
): Promise<GristResponse<SpeakingPracticeFields>> {
  const filters: Record<string, string[]> = {};
  if (status) filters.status = [status];

  const query = Object.keys(filters).length
    ? `?filter=${encodeURIComponent(JSON.stringify(filters))}`
    : "";

  return gristGet<GristResponse<SpeakingPracticeFields>>(`/tables/SpeakingPractice/records${query}`);
}

export async function upsertSpeakingPractice(
  topic: string,
  fields: Partial<SpeakingPracticeFields>
): Promise<void> {
  await gristWrite("PUT", "/tables/SpeakingPractice/records", {
    records: [
      {
        require: { topic },
        fields: { ...fields, date: new Date().toISOString().split("T")[0] },
      },
    ],
  });
}

export async function getReadingPractice(id: number): Promise<ReadingPractice | null> {
  const query = `?filter=${encodeURIComponent(JSON.stringify({ id: [id] }))}`;
  const res = await gristGet<GristResponse<ReadingPracticeFields>>(`/tables/ReadingPractice/records${query}`);
  return res.records.length > 0 ? res.records[0] : null;
}

export async function getWritingPractice(id: number): Promise<WritingPractice | null> {
  const query = `?filter=${encodeURIComponent(JSON.stringify({ id: [id] }))}`;
  const res = await gristGet<GristResponse<WritingPracticeFields>>(`/tables/WritingPractice/records${query}`);
  return res.records.length > 0 ? res.records[0] : null;
}

export async function getSpeakingPractice(id: number): Promise<SpeakingPractice | null> {
  const query = `?filter=${encodeURIComponent(JSON.stringify({ id: [id] }))}`;
  const res = await gristGet<GristResponse<SpeakingPracticeFields>>(`/tables/SpeakingPractice/records${query}`);
  return res.records.length > 0 ? res.records[0] : null;
}

export async function resolveWordWithGemini(clickedWord: string, contextSentence: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const prompt = `You are a German linguistics expert. Given the German word "${clickedWord}" as it appears in the sentence: "${contextSentence}"

Return ONLY the canonical dictionary form of this word as a JSON object:
- Verb → infinitive (e.g. "abholen", "sein", "haben")
- Noun → nominative singular with article (e.g. "die Aufgabe", "der Hund", "das Treffen")
- Adjective/Adverb → base form (e.g. "schnell", "gut")
- For separable verbs, reconstruct the full infinitive from the prefix at the end of the clause.

Response format: { "resolvedWord": "..." }`;

  const replyText = await callGemini(apiKey, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" },
  });

  const parsed = JSON.parse(replyText);
  return parsed.resolvedWord as string;
}

export async function lookupAndAddWord(rawWord: string, contextSentence: string): Promise<Vocabulary | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }

  const prompt = `You are a German language teacher fluent in both English and Vietnamese.
Analyze the German word "${rawWord}" captured in this sentence context: "${contextSentence}".
Reconstruct the correct base form (infinitive for verbs, nominative singular with gender article for nouns, base form for adjectives). Pay special attention to German separable verbs.

Format guidelines:
- For "dailyUse", provide a natural German example sentence showing daily context use of the resolved word, followed by its English translation in brackets. Format: "German sentence [English translation]"
- For "dailyUse_vn", provide the EXACT same German example sentence as dailyUse, but followed by its Vietnamese translation in brackets. Format: "German sentence [Vietnamese translation]"
- For "professionalUse", provide a German example sentence showing professional software engineering/agile context use, followed by its English translation in brackets. Format: "German sentence [English translation]"
- For "professionalUse_vn", provide the EXACT same German example sentence as professionalUse, but followed by its Vietnamese translation in brackets. Format: "German sentence [Vietnamese translation]"

CRITICAL: The sentence before the brackets MUST be the original German sentence in all four columns. Do NOT translate the German sentence itself to English or Vietnamese outside of the brackets. Only the translation inside the brackets [...] should be English or Vietnamese.

Example:
If German sentence is "Ich gehe heute einkaufen.", then:
- dailyUse: "Ich gehe heute einkaufen. [I am going shopping today.]"
- dailyUse_vn: "Ich gehe heute einkaufen. [Hôm nay tôi đi mua sắm.]"

Provide the response as a JSON object matching this schema:
{
  "word": "resolved base word/phrase (e.g. 'abholen' or 'das Treffen')",
  "meanings": "English translations/meanings separated by commas",
  "meanings_vn": "Vietnamese translations/meanings separated by commas",
  "level": "German CEFR Level (Choice: A1, A2, B1, B2, C1, C2)",
  "grammar": "Article, plural form (for nouns), aux verb + past participle (for verbs), prepositions (for adjectives), etc. in English",
  "grammar_vn": "Grammatical notes (articles, plurals, auxiliary verbs, etc.) explained in Vietnamese",
  "dailyUse": "German sentence [English translation]",
  "dailyUse_vn": "German sentence [Vietnamese translation]",
  "professionalUse": "German sentence [English translation]",
  "professionalUse_vn": "German sentence [Vietnamese translation]",
  "tips": "Grammatical cases, prepositions, or tips in English",
  "tips_vn": "Grammatical cases, prepositions, or tips explained in Vietnamese",
  "caution": "Common pitfalls or false friends in English",
  "caution_vn": "Common pitfalls or false friends explained in Vietnamese"
}`;

  const replyText = await callGemini(apiKey, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" },
  });

  const parsed = JSON.parse(replyText);

  const gristRes = await createVocabulary({
    word: parsed.word,
    meanings: parsed.meanings,
    meanings_vn: parsed.meanings_vn,
    level: parsed.level || "B1",
    type: "new",
    grammar: parsed.grammar,
    grammar_vn: parsed.grammar_vn,
    dailyUse: parsed.dailyUse,
    dailyUse_vn: parsed.dailyUse_vn,
    professionalUse: parsed.professionalUse,
    professionalUse_vn: parsed.professionalUse_vn,
    tips: parsed.tips,
    tips_vn: parsed.tips_vn,
    caution: parsed.caution,
    caution_vn: parsed.caution_vn,
    isProcessed: true,
  });

  if (gristRes.records && gristRes.records.length > 0) {
    const newId = gristRes.records[0].id;
    const itemsRes = await gristGet<GristResponse<VocabularyFields>>(`/tables/Vocabulary/records?filter=${encodeURIComponent(JSON.stringify({ id: [newId] }))}`);
    return itemsRes.records[0] || null;
  }

  return null;
}
