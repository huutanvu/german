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

export async function getVocabularyByWord(word: string): Promise<Vocabulary | null> {
  const query = `?filter=${encodeURIComponent(JSON.stringify({ word: [word] }))}`;
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
