"use server";

import type {
  GristResponse,
  LearningContextFields,
  VocabularyFields,
  VocabularyReviewFields,
  WritingPracticeFields,
  ReadingPracticeFields,
  GrammarPracticeFields,
  SpeakingPracticeFields,
  VocabularyUsageFields,
  LearningContext,
  Vocabulary,
  VocabularyReview,
  VocabularyUsage,
  WritingPractice,
  ReadingPractice,
  GrammarPractice,
  SpeakingPractice,
  ReadingPracticeSubmissionFields,
  WritingPracticeSubmissionFields,
  SpeakingPracticeSubmissionFields,
  GrammarPracticeSubmissionFields,
} from "./types";

const GRIST_URL = process.env.GRIST_URL ?? process.env.NEXT_PUBLIC_GRIST_URL ?? "https://docs.getgrist.com/api";
const GRIST_DOC = process.env.GRIST_DOC ?? process.env.NEXT_PUBLIC_GRIST_DOC ?? "";
const GRIST_KEY = process.env.GRIST_KEY ?? process.env.NEXT_PUBLIC_GRIST_KEY ?? "";

const base = `${GRIST_URL}/docs/${GRIST_DOC}`;

// ---------------------------------------------------------------------------
// Gemini helper with model fallback chain
// ---------------------------------------------------------------------------
const GEMINI_MODELS = [
  "gemini-3.5-live-translate",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-3-flash-preview",
  "gemini-2.0-flash",
  "gemini-3.5-flash",
];

async function callGemini(
  apiKey: string,
  body: object
): Promise<string> {
  let lastError: Error | null = null;
  for (const model of GEMINI_MODELS) {
    console.log(`Using model ${model}`)
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

function findMatchingBraceIndex(str: string, startIdx: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < str.length; i++) {
    const char = str[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }
  }

  return -1;
}

function findMatchingBracketIndex(str: string, startIdx: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < str.length; i++) {
    const char = str[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '[') {
        depth++;
      } else if (char === ']') {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }
  }

  return -1;
}

function cleanJsonString(str: string): string {
  let cleaned = str.trim();
  
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIdx = -1;
  let endIdx = -1;
  
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = findMatchingBraceIndex(cleaned, startIdx);
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = findMatchingBracketIndex(cleaned, startIdx);
  }
  
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1);
  }
  
  cleaned = cleaned.trim();
  // Remove trailing commas in arrays/objects
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
  return cleaned;
}

function safeJsonParse<T = any>(str: string): T {
  const cleaned = cleanJsonString(str);
  try {
    return JSON.parse(cleaned) as T;
  } catch (err: any) {
    console.error("Failed to parse JSON string. Raw input was:\n", str);
    console.error("Cleaned input was:\n", cleaned);
    throw err;
  }
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

import { cookies } from "next/headers";
import { decodeJwtPayload } from "./supabase";

async function getUserIdFromCookie(): Promise<string | undefined> {
  try {
    const store = await cookies();
    const token = store.get('sb-access-token')?.value;
    if (!token) return undefined;
    const payload = decodeJwtPayload(token);
    if (!payload || typeof payload.sub !== 'string') return undefined;
    return payload.sub;
  } catch {
    return undefined;
  }
}

const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function isLevelLowerOrEqual(itemLevel: string, userLevel: string): boolean {
  const itemIdx = LEVEL_ORDER.indexOf(itemLevel);
  const userIdx = LEVEL_ORDER.indexOf(userLevel);
  if (itemIdx === -1) return true; // Show by default if level is missing
  if (userIdx === -1) return true;
  return itemIdx <= userIdx;
}

async function getUserProfileFromSupabase(userId?: string): Promise<{ profession: string; targetLevel: string }> {
  const defaultProfile = { profession: 'software_engineer', targetLevel: 'B1' };
  if (!userId) return defaultProfile;
  try {
    const store = await cookies();
    const token = store.get('sb-access-token')?.value;
    if (!token) return defaultProfile;

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
          Authorization: `Bearer ${token}`,
        }
      }
    );
    if (!res.ok) return defaultProfile;
    const rows = await res.json();
    return {
      profession: rows?.[0]?.profession ?? 'software_engineer',
      targetLevel: rows?.[0]?.target_level ?? 'B1',
    };
  } catch {
    return defaultProfile;
  }
}

async function getProfileProfession(userId?: string): Promise<string> {
  const profile = await getUserProfileFromSupabase(userId);
  return profile.profession;
}

// ─── Learning Context ───────────────────────────────────────────

export async function getLearningContext(userId?: string): Promise<LearningContext | null> {
  const resolvedUserId = userId || (await getUserIdFromCookie());
  if (resolvedUserId) {
    const query = `?filter=${encodeURIComponent(JSON.stringify({ userId: [resolvedUserId] }))}`;
    const res = await gristGet<GristResponse<LearningContextFields>>(`/tables/LearningContext/records${query}`);
    return res.records.length > 0 ? res.records[0] : null;
  }
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
  type?: string,
  userId?: string
): Promise<GristResponse<VocabularyFields>> {
  const resolvedUserId = userId || (await getUserIdFromCookie());
  const filters: Record<string, string[]> = {};
  if (level) filters.level = [level];
  if (type) filters.type = [type];

  const query = Object.keys(filters).length
    ? `?filter=${encodeURIComponent(JSON.stringify(filters))}`
    : "";

  const res = await gristGet<GristResponse<VocabularyFields>>(`/tables/Vocabulary/records${query}`);

  // Resolve custom profession usage overrides
  try {
    const userProfession = await getProfileProfession(resolvedUserId);
    if (userProfession && res.records.length > 0) {
      const vocabIds = res.records.map(r => r.id);
      const usagesQuery = `?filter=${encodeURIComponent(JSON.stringify({ vocabId: vocabIds, profession: [userProfession, 'general'] }))}`;
      const usagesRes = await gristGet<GristResponse<VocabularyUsageFields>>(`/tables/VocabularyUsage/records${usagesQuery}`);
      
      // Map: vocabId -> { profession -> fields }
      const usagesMap = new Map<number, Record<string, VocabularyUsageFields>>();

      for (const record of usagesRes.records) {
        const vId = Array.isArray(record.fields.vocabId) ? record.fields.vocabId[1] : record.fields.vocabId;
        if (typeof vId === 'number') {
          if (!usagesMap.has(vId)) {
            usagesMap.set(vId, {});
          }
          usagesMap.get(vId)![record.fields.profession] = record.fields;
        }
      }

      for (const record of res.records) {
        const profMap = usagesMap.get(record.id);
        const usage = profMap ? (profMap[userProfession] || profMap['general']) : null;
        if (usage) {
          if (usage.dailyUse) record.fields.dailyUse = usage.dailyUse;
          if (usage.dailyUse_vn) record.fields.dailyUse_vn = usage.dailyUse_vn;
          if (usage.professionalUse) record.fields.professionalUse = usage.professionalUse;
          if (usage.professionalUse_vn) record.fields.professionalUse_vn = usage.professionalUse_vn;
          if (usage.tips) record.fields.tips = usage.tips;
          if (usage.tips_vn) record.fields.tips_vn = usage.tips_vn;
          if (usage.caution) record.fields.caution = usage.caution;
          if (usage.caution_vn) record.fields.caution_vn = usage.caution_vn;
        }
      }
    }
  } catch (err) {
    console.error("Failed to merge vocabulary usages in listVocabulary:", err);
  }

  return res;
}

export async function listVocabularyByIds(ids: number[]): Promise<GristResponse<VocabularyFields>> {
  if (ids.length === 0) return { records: [] };
  const resolvedUserId = await getUserIdFromCookie();
  const query = `?filter=${encodeURIComponent(JSON.stringify({ id: ids }))}`;
  const res = await gristGet<GristResponse<VocabularyFields>>(`/tables/Vocabulary/records${query}`);

  // Resolve custom profession usage overrides
  try {
    const userProfession = await getProfileProfession(resolvedUserId);
    if (userProfession && res.records.length > 0) {
      const usagesQuery = `?filter=${encodeURIComponent(JSON.stringify({ vocabId: ids, profession: [userProfession, 'general'] }))}`;
      const usagesRes = await gristGet<GristResponse<VocabularyUsageFields>>(`/tables/VocabularyUsage/records${usagesQuery}`);
      
      const usagesMap = new Map<number, Record<string, VocabularyUsageFields>>();
      for (const record of usagesRes.records) {
        const vId = Array.isArray(record.fields.vocabId) ? record.fields.vocabId[1] : record.fields.vocabId;
        if (typeof vId === 'number') {
          if (!usagesMap.has(vId)) {
            usagesMap.set(vId, {});
          }
          usagesMap.get(vId)![record.fields.profession] = record.fields;
        }
      }

      for (const record of res.records) {
        const profMap = usagesMap.get(record.id);
        const usage = profMap ? (profMap[userProfession] || profMap['general']) : null;
        if (usage) {
          if (usage.dailyUse) record.fields.dailyUse = usage.dailyUse;
          if (usage.dailyUse_vn) record.fields.dailyUse_vn = usage.dailyUse_vn;
          if (usage.professionalUse) record.fields.professionalUse = usage.professionalUse;
          if (usage.professionalUse_vn) record.fields.professionalUse_vn = usage.professionalUse_vn;
          if (usage.tips) record.fields.tips = usage.tips;
          if (usage.tips_vn) record.fields.tips_vn = usage.tips_vn;
          if (usage.caution) record.fields.caution = usage.caution;
          if (usage.caution_vn) record.fields.caution_vn = usage.caution_vn;
        }
      }
    }
  } catch (err) {
    console.error("Failed to merge vocabulary usages in listVocabularyByIds:", err);
  }

  return res;
}

export async function getVocabularyByWord(word: string | string[]): Promise<Vocabulary | null> {
  const resolvedUserId = await getUserIdFromCookie();
  const words = Array.isArray(word) ? word : [word];
  const filters: Record<string, any[]> = { word: words };
  const query = `?filter=${encodeURIComponent(JSON.stringify(filters))}`;
  const res = await gristGet<GristResponse<VocabularyFields>>(`/tables/Vocabulary/records${query}`);
  const item = res.records.length > 0 ? res.records[0] : null;

  if (item && resolvedUserId) {
    try {
      const userProfession = await getProfileProfession(resolvedUserId);
      if (userProfession) {
        const usagesRes = await listVocabularyUsage(item.id);
        const usages = usagesRes.records;
        const targetUsage = usages.find(u => u.fields.profession === userProfession) || usages.find(u => u.fields.profession === 'general');
        if (targetUsage) {
          const usage = targetUsage.fields;
          if (usage.dailyUse) item.fields.dailyUse = usage.dailyUse;
          if (usage.dailyUse_vn) item.fields.dailyUse_vn = usage.dailyUse_vn;
          if (usage.professionalUse) item.fields.professionalUse = usage.professionalUse;
          if (usage.professionalUse_vn) item.fields.professionalUse_vn = usage.professionalUse_vn;
          if (usage.tips) item.fields.tips = usage.tips;
          if (usage.tips_vn) item.fields.tips_vn = usage.tips_vn;
          if (usage.caution) item.fields.caution = usage.caution;
          if (usage.caution_vn) item.fields.caution_vn = usage.caution_vn;
        }
      }
    } catch (err) {
      console.error("Failed to merge vocabulary usage in getVocabularyByWord:", err);
    }
  }

  return item;
}

export async function createVocabulary(
  fields: Partial<VocabularyFields>
): Promise<{ records: { id: number }[] }> {
  return gristWrite("POST", "/tables/Vocabulary/records", {
    records: [{ fields: { ...fields, updatedAt: new Date().toISOString() } }],
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
  status?: string,
  userId?: string
): Promise<GristResponse<VocabularyReviewFields>> {
  const resolvedUserId = userId || (await getUserIdFromCookie());
  const filters: Record<string, string[]> = {};
  if (status) filters.status = [status];
  if (resolvedUserId) filters.userId = [resolvedUserId];

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
  const resolvedUserId = await getUserIdFromCookie();
  await gristWrite("PUT", "/tables/VocabularyReviews/records", {
    records: [
      {
        require: { vocabId, status: 'pending_correction', ...(resolvedUserId ? { userId: resolvedUserId } : {}) },
        fields: { userSentence, status, reviewedAt: new Date().toISOString(), ...(resolvedUserId ? { userId: resolvedUserId } : {}) },
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
  status?: string,
  userId?: string
): Promise<GristResponse<WritingPracticeFields>> {
  const resolvedUserId = userId || (await getUserIdFromCookie());
  const profile = await getUserProfileFromSupabase(resolvedUserId);
  const userProfession = profile.profession;
  const userLevel = profile.targetLevel;

  const query = `?filter=${encodeURIComponent(JSON.stringify({ profession: [userProfession] }))}`;
  const templates = await gristGet<GristResponse<WritingPracticeFields>>(`/tables/WritingPractice/records${query}`);

  // Filter templates locally by level <= userLevel
  templates.records = templates.records.filter(r => isLevelLowerOrEqual(r.fields.level || 'B1', userLevel));

  if (templates.records.length === 0) return templates;

  let subsMap = new Map<number, any>();
  if (resolvedUserId) {
    const practiceIds = templates.records.map((t) => t.id);
    const subQuery = `?filter=${encodeURIComponent(JSON.stringify({ userId: [resolvedUserId], practiceId: practiceIds }))}`;
    const subs = await gristGet<GristResponse<WritingPracticeSubmissionFields>>(`/tables/WritingPracticeSubmission/records${subQuery}`);
    for (const s of subs.records) {
      const pId = Array.isArray(s.fields.practiceId) ? s.fields.practiceId[1] : s.fields.practiceId;
      if (typeof pId === 'number') subsMap.set(pId, s.fields);
    }
  }

  for (const r of templates.records) {
    const sub = subsMap.get(r.id);
    if (sub) {
      Object.assign(r.fields, {
        userParagraph: sub.userParagraph,
        correctedParagraph: sub.correctedParagraph,
        correctionsJson: sub.correctionsJson,
        correctionsJson_vn: sub.correctionsJson_vn,
        status: sub.status,
        date: sub.date,
      });
    } else {
      Object.assign(r.fields, {
        userParagraph: "",
        correctedParagraph: "",
        correctionsJson: "",
        status: 'pending_user',
        date: new Date().toISOString().split("T")[0],
      });
    }
  }

  if (status) {
    templates.records = templates.records.filter((r) => (r.fields as any).status === status);
  }

  return templates;
}

export async function getWritingPractice(id: number): Promise<WritingPractice | null> {
  const resolvedUserId = await getUserIdFromCookie();
  if (!resolvedUserId) return null;

  const templates = await gristGet<GristResponse<WritingPracticeFields>>(`/tables/WritingPractice/records?filter=${encodeURIComponent(JSON.stringify({ id: [id] }))}`);
  const template = templates.records.length > 0 ? templates.records[0] : null;
  if (!template) return null;

  const subQuery = `?filter=${encodeURIComponent(JSON.stringify({ userId: [resolvedUserId], practiceId: [id] }))}`;
  const subs = await gristGet<GristResponse<WritingPracticeSubmissionFields>>(`/tables/WritingPracticeSubmission/records${subQuery}`);
  const sub = subs.records.length > 0 ? subs.records[0] : null;

  if (sub) {
    Object.assign(template.fields, {
      userParagraph: sub.fields.userParagraph,
      correctedParagraph: sub.fields.correctedParagraph,
      correctionsJson: sub.fields.correctionsJson,
      correctionsJson_vn: sub.fields.correctionsJson_vn,
      status: sub.fields.status,
      date: sub.fields.date,
    });
  } else {
    Object.assign(template.fields, {
      userParagraph: "",
      correctedParagraph: "",
      correctionsJson: "",
      status: 'pending_user',
      date: new Date().toISOString().split("T")[0],
    });
  }

  return template as any;
}

export async function upsertWritingPractice(
  topic: string,
  fields: Partial<WritingPracticeSubmissionFields>
): Promise<void> {
  const resolvedUserId = await getUserIdFromCookie();
  if (!resolvedUserId) throw new Error("Unauthorized");

  const query = `?filter=${encodeURIComponent(JSON.stringify({ topic: [topic] }))}`;
  const templates = await gristGet<GristResponse<WritingPracticeFields>>(`/tables/WritingPractice/records${query}`);
  if (templates.records.length === 0) {
    throw new Error(`WritingPractice template not found for topic: ${topic}`);
  }
  const practiceId = templates.records[0].id;

  await gristWrite("PUT", "/tables/WritingPracticeSubmission/records", {
    records: [
      {
        require: { practiceId, userId: resolvedUserId },
        fields: {
          ...fields,
          practiceId,
          userId: resolvedUserId,
          date: fields.date || new Date().toISOString().split("T")[0],
          updatedAt: new Date().toISOString(),
        },
      },
    ],
  });
}

// ─── Reading Practice ────────────────────────────────────────────

export async function listReadingPractices(
  status?: string,
  userId?: string
): Promise<GristResponse<ReadingPracticeFields>> {
  const resolvedUserId = userId || (await getUserIdFromCookie());
  const profile = await getUserProfileFromSupabase(resolvedUserId);
  const userProfession = profile.profession;
  const userLevel = profile.targetLevel;

  const query = `?filter=${encodeURIComponent(JSON.stringify({ profession: [userProfession] }))}`;
  const templates = await gristGet<GristResponse<ReadingPracticeFields>>(`/tables/ReadingPractice/records${query}`);

  // Filter templates locally by level <= userLevel
  templates.records = templates.records.filter(r => isLevelLowerOrEqual(r.fields.level || 'B1', userLevel));

  if (templates.records.length === 0) return templates;

  let subsMap = new Map<number, any>();
  if (resolvedUserId) {
    const practiceIds = templates.records.map((t) => t.id);
    const subQuery = `?filter=${encodeURIComponent(JSON.stringify({ userId: [resolvedUserId], practiceId: practiceIds }))}`;
    const subs = await gristGet<GristResponse<ReadingPracticeSubmissionFields>>(`/tables/ReadingPracticeSubmission/records${subQuery}`);
    for (const s of subs.records) {
      const pId = Array.isArray(s.fields.practiceId) ? s.fields.practiceId[1] : s.fields.practiceId;
      if (typeof pId === 'number') subsMap.set(pId, s.fields);
    }
  }

  for (const r of templates.records) {
    const sub = subsMap.get(r.id);
    if (sub) {
      Object.assign(r.fields, {
        userAnswersJson: sub.userAnswersJson,
        correctionsJson: sub.correctionsJson,
        correctionsJson_vn: sub.correctionsJson_vn,
        status: sub.status,
        date: sub.date,
      });
    } else {
      Object.assign(r.fields, {
        userAnswersJson: "",
        correctionsJson: "",
        status: 'pending_user',
        date: new Date().toISOString().split("T")[0],
      });
    }
  }

  if (status) {
    templates.records = templates.records.filter((r) => (r.fields as any).status === status);
  }

  return templates;
}

export async function getReadingPractice(id: number): Promise<ReadingPractice | null> {
  const resolvedUserId = await getUserIdFromCookie();
  if (!resolvedUserId) return null;

  const templates = await gristGet<GristResponse<ReadingPracticeFields>>(`/tables/ReadingPractice/records?filter=${encodeURIComponent(JSON.stringify({ id: [id] }))}`);
  const template = templates.records.length > 0 ? templates.records[0] : null;
  if (!template) return null;

  const subQuery = `?filter=${encodeURIComponent(JSON.stringify({ userId: [resolvedUserId], practiceId: [id] }))}`;
  const subs = await gristGet<GristResponse<ReadingPracticeSubmissionFields>>(`/tables/ReadingPracticeSubmission/records${subQuery}`);
  const sub = subs.records.length > 0 ? subs.records[0] : null;

  if (sub) {
    Object.assign(template.fields, {
      userAnswersJson: sub.fields.userAnswersJson,
      correctionsJson: sub.fields.correctionsJson,
      correctionsJson_vn: sub.fields.correctionsJson_vn,
      status: sub.fields.status,
      date: sub.fields.date,
    });
  } else {
    Object.assign(template.fields, {
      userAnswersJson: "",
      correctionsJson: "",
      status: 'pending_user',
      date: new Date().toISOString().split("T")[0],
    });
  }

  return template as any;
}

export async function upsertReadingPractice(
  topic: string,
  fields: Partial<ReadingPracticeSubmissionFields>
): Promise<void> {
  const resolvedUserId = await getUserIdFromCookie();
  if (!resolvedUserId) throw new Error("Unauthorized");

  const query = `?filter=${encodeURIComponent(JSON.stringify({ topic: [topic] }))}`;
  const templates = await gristGet<GristResponse<ReadingPracticeFields>>(`/tables/ReadingPractice/records${query}`);
  if (templates.records.length === 0) {
    throw new Error(`ReadingPractice template not found for topic: ${topic}`);
  }
  const practiceId = templates.records[0].id;

  await gristWrite("PUT", "/tables/ReadingPracticeSubmission/records", {
    records: [
      {
        require: { practiceId, userId: resolvedUserId },
        fields: {
          ...fields,
          practiceId,
          userId: resolvedUserId,
          date: fields.date || new Date().toISOString().split("T")[0],
          updatedAt: new Date().toISOString(),
        },
      },
    ],
  });
}

// ─── Grammar Practice ────────────────────────────────────────────

export async function listGrammarPractices(
  status?: string,
  userId?: string
): Promise<GristResponse<GrammarPracticeFields>> {
  const resolvedUserId = userId || (await getUserIdFromCookie());
  const profile = await getUserProfileFromSupabase(resolvedUserId);
  const userProfession = profile.profession;
  const userLevel = profile.targetLevel;

  const query = `?filter=${encodeURIComponent(JSON.stringify({ profession: [userProfession] }))}`;
  const templates = await gristGet<GristResponse<GrammarPracticeFields>>(`/tables/GrammarPractice/records${query}`);

  // Filter templates locally by level <= userLevel
  templates.records = templates.records.filter(r => isLevelLowerOrEqual(r.fields.level || 'B1', userLevel));

  if (templates.records.length === 0) return templates;

  let subsMap = new Map<number, any>();
  if (resolvedUserId) {
    const practiceIds = templates.records.map((t) => t.id);
    const subQuery = `?filter=${encodeURIComponent(JSON.stringify({ userId: [resolvedUserId], practiceId: practiceIds }))}`;
    const subs = await gristGet<GristResponse<GrammarPracticeSubmissionFields>>(`/tables/GrammarPracticeSubmission/records${subQuery}`);
    for (const s of subs.records) {
      const pId = Array.isArray(s.fields.practiceId) ? s.fields.practiceId[1] : s.fields.practiceId;
      if (typeof pId === 'number') subsMap.set(pId, s.fields);
    }
  }

  for (const r of templates.records) {
    const sub = subsMap.get(r.id);
    if (sub) {
      Object.assign(r.fields, {
        userAnswersJson: sub.userAnswersJson,
        correctionsJson: sub.correctionsJson,
        correctionsJson_vn: sub.correctionsJson_vn,
        status: sub.status,
        date: sub.date,
      });
    } else {
      Object.assign(r.fields, {
        userAnswersJson: "",
        correctionsJson: "",
        status: 'pending_user',
        date: new Date().toISOString().split("T")[0],
      });
    }
  }

  if (status) {
    templates.records = templates.records.filter((r) => (r.fields as any).status === status);
  }

  return templates;
}

export async function getGrammarPractice(id: number): Promise<GrammarPractice | null> {
  const resolvedUserId = await getUserIdFromCookie();
  if (!resolvedUserId) return null;

  const templates = await gristGet<GristResponse<GrammarPracticeFields>>(`/tables/GrammarPractice/records?filter=${encodeURIComponent(JSON.stringify({ id: [id] }))}`);
  const template = templates.records.length > 0 ? templates.records[0] : null;
  if (!template) return null;

  const subQuery = `?filter=${encodeURIComponent(JSON.stringify({ userId: [resolvedUserId], practiceId: [id] }))}`;
  const subs = await gristGet<GristResponse<GrammarPracticeSubmissionFields>>(`/tables/GrammarPracticeSubmission/records${subQuery}`);
  const sub = subs.records.length > 0 ? subs.records[0] : null;

  if (sub) {
    Object.assign(template.fields, {
      userAnswersJson: sub.fields.userAnswersJson,
      correctionsJson: sub.fields.correctionsJson,
      correctionsJson_vn: sub.fields.correctionsJson_vn,
      status: sub.fields.status,
      date: sub.fields.date,
    });
  } else {
    Object.assign(template.fields, {
      userAnswersJson: "",
      correctionsJson: "",
      status: 'pending_user',
      date: new Date().toISOString().split("T")[0],
    });
  }

  return template as any;
}

export async function upsertGrammarPractice(
  topic: string,
  fields: Partial<GrammarPracticeSubmissionFields>
): Promise<void> {
  const resolvedUserId = await getUserIdFromCookie();
  if (!resolvedUserId) throw new Error("Unauthorized");

  const query = `?filter=${encodeURIComponent(JSON.stringify({ topic: [topic] }))}`;
  const templates = await gristGet<GristResponse<GrammarPracticeFields>>(`/tables/GrammarPractice/records${query}`);
  if (templates.records.length === 0) {
    throw new Error(`GrammarPractice template not found for topic: ${topic}`);
  }
  const practiceId = templates.records[0].id;

  await gristWrite("PUT", "/tables/GrammarPracticeSubmission/records", {
    records: [
      {
        require: { practiceId, userId: resolvedUserId },
        fields: {
          ...fields,
          practiceId,
          userId: resolvedUserId,
          date: fields.date || new Date().toISOString().split("T")[0],
          updatedAt: new Date().toISOString(),
        },
      },
    ],
  });
}

// ─── Speaking Practice ───────────────────────────────────────────

export async function listSpeakingPractices(
  status?: string,
  userId?: string
): Promise<GristResponse<SpeakingPracticeFields>> {
  const resolvedUserId = userId || (await getUserIdFromCookie());
  const profile = await getUserProfileFromSupabase(resolvedUserId);
  const userProfession = profile.profession;
  const userLevel = profile.targetLevel;

  const query = `?filter=${encodeURIComponent(JSON.stringify({ profession: [userProfession] }))}`;
  const templates = await gristGet<GristResponse<SpeakingPracticeFields>>(`/tables/SpeakingPractice/records${query}`);

  // Filter templates locally by level <= userLevel
  templates.records = templates.records.filter(r => isLevelLowerOrEqual(r.fields.level || 'B1', userLevel));

  if (templates.records.length === 0) return templates;

  let subsMap = new Map<number, any>();
  if (resolvedUserId) {
    const practiceIds = templates.records.map((t) => t.id);
    const subQuery = `?filter=${encodeURIComponent(JSON.stringify({ userId: [resolvedUserId], practiceId: practiceIds }))}`;
    const subs = await gristGet<GristResponse<SpeakingPracticeSubmissionFields>>(`/tables/SpeakingPracticeSubmission/records${subQuery}`);
    for (const s of subs.records) {
      const pId = Array.isArray(s.fields.practiceId) ? s.fields.practiceId[1] : s.fields.practiceId;
      if (typeof pId === 'number') subsMap.set(pId, s.fields);
    }
  }

  for (const r of templates.records) {
    const sub = subsMap.get(r.id);
    if (sub) {
      Object.assign(r.fields, {
        userAudioFileId: sub.userAudioFileId,
        transcript: sub.transcript,
        grammarFeedback: sub.grammarFeedback,
        grammarFeedback_vn: sub.grammarFeedback_vn,
        pronunciationFeedback: sub.pronunciationFeedback,
        pronunciationFeedback_vn: sub.pronunciationFeedback_vn,
        score: sub.score,
        status: sub.status,
        date: sub.date,
      });
    } else {
      Object.assign(r.fields, {
        userAudioFileId: "",
        transcript: "",
        grammarFeedback: "",
        pronunciationFeedback: "",
        score: 0,
        status: 'pending_recording',
        date: new Date().toISOString().split("T")[0],
      });
    }
  }

  if (status) {
    templates.records = templates.records.filter((r) => (r.fields as any).status === status);
  }

  return templates;
}

export async function getSpeakingPractice(id: number): Promise<SpeakingPractice | null> {
  const resolvedUserId = await getUserIdFromCookie();
  if (!resolvedUserId) return null;

  const templates = await gristGet<GristResponse<SpeakingPracticeFields>>(`/tables/SpeakingPractice/records?filter=${encodeURIComponent(JSON.stringify({ id: [id] }))}`);
  const template = templates.records.length > 0 ? templates.records[0] : null;
  if (!template) return null;

  const subQuery = `?filter=${encodeURIComponent(JSON.stringify({ userId: [resolvedUserId], practiceId: [id] }))}`;
  const subs = await gristGet<GristResponse<SpeakingPracticeSubmissionFields>>(`/tables/SpeakingPracticeSubmission/records${subQuery}`);
  const sub = subs.records.length > 0 ? subs.records[0] : null;

  if (sub) {
    Object.assign(template.fields, {
      userAudioFileId: sub.fields.userAudioFileId,
      transcript: sub.fields.transcript,
      grammarFeedback: sub.fields.grammarFeedback,
      grammarFeedback_vn: sub.fields.grammarFeedback_vn,
      pronunciationFeedback: sub.fields.pronunciationFeedback,
      pronunciationFeedback_vn: sub.fields.pronunciationFeedback_vn,
      score: sub.fields.score,
      status: sub.fields.status,
      date: sub.fields.date,
    });
  } else {
    Object.assign(template.fields, {
      userAudioFileId: "",
      transcript: "",
      grammarFeedback: "",
      pronunciationFeedback: "",
      score: 0,
      status: 'pending_recording',
      date: new Date().toISOString().split("T")[0],
    });
  }

  return template as any;
}

export async function upsertSpeakingPractice(
  topic: string,
  fields: Partial<SpeakingPracticeSubmissionFields>
): Promise<void> {
  const resolvedUserId = await getUserIdFromCookie();
  if (!resolvedUserId) throw new Error("Unauthorized");

  const query = `?filter=${encodeURIComponent(JSON.stringify({ topic: [topic] }))}`;
  const templates = await gristGet<GristResponse<SpeakingPracticeFields>>(`/tables/SpeakingPractice/records${query}`);
  if (templates.records.length === 0) {
    throw new Error(`SpeakingPractice template not found for topic: ${topic}`);
  }
  const practiceId = templates.records[0].id;

  await gristWrite("PUT", "/tables/SpeakingPracticeSubmission/records", {
    records: [
      {
        require: { practiceId, userId: resolvedUserId },
        fields: {
          ...fields,
          practiceId,
          userId: resolvedUserId,
          date: fields.date || new Date().toISOString().split("T")[0],
          updatedAt: new Date().toISOString(),
        },
      },
    ],
  });
}

export async function createSpeakingPractice(
  topic: string,
  targetText: string,
  fields: Partial<SpeakingPracticeFields>
): Promise<SpeakingPractice> {
  const resolvedUserId = await getUserIdFromCookie();
  const userProfession = await getProfileProfession(resolvedUserId);

  const res = await gristWrite<{ records: any[] }>("POST", "/tables/SpeakingPractice/records", {
    records: [
      {
        fields: {
          topic,
          targetText,
          profession: userProfession,
          targetAudioFileId: fields.targetAudioFileId || "",
          createdAt: new Date().toISOString(),
        },
      },
    ],
  });
  return res.records[0] as SpeakingPractice;
}

export async function updateSpeakingPractice(
  id: number,
  fields: Partial<SpeakingPracticeFields>
): Promise<void> {
  await gristWrite("PATCH", "/tables/SpeakingPractice/records", {
    records: [
      {
        id,
        fields,
      },
    ],
  });
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

  const parsed = safeJsonParse(replyText);
  return parsed.resolvedWord as string;
}

export async function lookupAndAddWord(rawWord: string, contextSentence: string, userId?: string): Promise<Vocabulary | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }

  const resolvedUserId = userId || (await getUserIdFromCookie());

  const prompt = `You are a German language teacher fluent in both English and Vietnamese.
Analyze the German word "${rawWord}" captured in this sentence context: "${contextSentence}".
Reconstruct the correct base form (infinitive for verbs, nominative singular with gender article for nouns, base form for adjectives). Pay special attention to German separable verbs.

You must generate vocabulary context examples, translation, tips, and cautions for ALL of the following 7 professions:
1. software_engineer
2. healthcare_professional
3. nurse
4. teacher
5. legal_professional
6. finance_professional
7. general

For each profession:
- dailyUse: German sentence [English translation]
- dailyUse_vn: Same German sentence [Vietnamese translation]
- professionalUse: German sentence [English translation] tailored to the profession
- professionalUse_vn: Same German sentence [Vietnamese translation] tailored to the profession
- tips: Grammatical cases, prepositions, or tips in English
- tips_vn: Grammatical cases, prepositions, or tips explained in Vietnamese
- caution: Common pitfalls or false friends in English
- caution_vn: Common pitfalls or false friends explained in Vietnamese

CRITICAL: The sentence before the brackets [...] MUST be the original German sentence. Do NOT translate the German sentence itself to English or Vietnamese outside of the brackets. Only the translation inside the brackets [...] should be English or Vietnamese.
CRITICAL: The output must be pure, valid JSON matching the exact schema below. Do not include any JSON comments, ellipsis (...), or placeholders. The "usages" array must contain exactly 7 complete object entries, one for each of the 7 professions.

Provide the response as a JSON object matching this schema:
{
  "word": "resolved base word/phrase (e.g. 'abholen' or 'das Treffen')",
  "meanings": "English translations/meanings separated by commas",
  "meanings_vn": "Vietnamese translations/meanings separated by commas",
  "level": "German CEFR Level (Choice: A1, A2, B1, B2, C1, C2)",
  "partOfSpeech": "Word type (Choice: 'noun', 'verb', 'adjective', 'adverb', 'preposition', 'pronoun', 'conjunction', 'phrase')",
  "grammar": "Article, plural form (for nouns), aux verb + past participle (for verbs), prepositions (for adjectives), etc. in English",
  "grammar_vn": "Grammatical notes explained in Vietnamese",
  "usages": [
    {
      "profession": "one of the 7 professions above",
      "dailyUse": "German sentence [English translation]",
      "dailyUse_vn": "German sentence [Vietnamese translation]",
      "professionalUse": "German sentence [English translation]",
      "professionalUse_vn": "German sentence [Vietnamese translation]",
      "tips": "Tips in English",
      "tips_vn": "Tips in Vietnamese",
      "caution": "Caution in English",
      "caution_vn": "Caution in Vietnamese"
    }
  ]
}`;

  const replyText = await callGemini(apiKey, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" },
  });

  const parsed = safeJsonParse(replyText);

  const gristRes = await createVocabulary({
    word: parsed.word,
    meanings: parsed.meanings,
    meanings_vn: parsed.meanings_vn,
    level: parsed.level || "B1",
    type: "new",
    grammar: parsed.grammar,
    grammar_vn: parsed.grammar_vn,
    partOfSpeech: parsed.partOfSpeech,
    isProcessed: true,
  });

  if (gristRes.records && gristRes.records.length > 0) {
    const newId = gristRes.records[0].id;

    // Create usages for all professions in bulk
    const usageRecords = parsed.usages.map((u: any) => ({
      vocabId: newId,
      profession: u.profession,
      dailyUse: u.dailyUse,
      dailyUse_vn: u.dailyUse_vn,
      professionalUse: u.professionalUse,
      professionalUse_vn: u.professionalUse_vn,
      tips: u.tips,
      tips_vn: u.tips_vn,
      caution: u.caution,
      caution_vn: u.caution_vn,
    }));

    await createVocabularyUsages(usageRecords);

    const itemsRes = await gristGet<GristResponse<VocabularyFields>>(`/tables/Vocabulary/records?filter=${encodeURIComponent(JSON.stringify({ id: [newId] }))}`);
    return itemsRes.records[0] || null;
  }

  return null;
}

export async function listVocabularyUsage(
  vocabId: number,
  profession?: string
): Promise<GristResponse<VocabularyUsageFields>> {
  const filters: Record<string, unknown[]> = { vocabId: [vocabId] };
  if (profession) filters.profession = [profession];
  const query = `?filter=${encodeURIComponent(JSON.stringify(filters))}`;
  return gristGet<GristResponse<VocabularyUsageFields>>(`/tables/VocabularyUsage/records${query}`);
}

export async function createVocabularyUsage(
  fields: Partial<VocabularyUsageFields>
): Promise<{ records: { id: number }[] }> {
  return gristWrite('POST', '/tables/VocabularyUsage/records', {
    records: [{ fields: { ...fields, createdAt: new Date().toISOString() } }],
  });
}

export async function createVocabularyUsages(
  records: Partial<VocabularyUsageFields>[]
): Promise<{ records: { id: number }[] }> {
  return gristWrite('POST', '/tables/VocabularyUsage/records', {
    records: records.map(fields => ({
      fields: { ...fields, createdAt: new Date().toISOString() }
    })),
  });
}

export async function getVocabularyUsageForUser(
  vocabId: number,
  profession: string
): Promise<VocabularyUsage | null> {
  const res = await listVocabularyUsage(vocabId, profession);
  return res.records.length > 0 ? res.records[0] : null;
}

export async function getReviewsForWord(vocabId: number): Promise<VocabularyReview[]> {
  const resolvedUserId = await getUserIdFromCookie();
  if (!resolvedUserId) return [];
  const filters = { vocabId: [vocabId], userId: [resolvedUserId] };
  const query = `?filter=${encodeURIComponent(JSON.stringify(filters))}`;
  const res = await gristGet<GristResponse<VocabularyReviewFields>>(`/tables/VocabularyReviews/records${query}`);
  return res.records;
}

export async function addWordToCollection(vocabId: number): Promise<void> {
  const resolvedUserId = await getUserIdFromCookie();
  if (!resolvedUserId) throw new Error("User not logged in");
  
  const existing = await getReviewsForWord(vocabId);
  const pending = existing.find(r => r.fields.status === 'pending_correction');
  if (pending) return; // already pending review
  
  await gristWrite("POST", "/tables/VocabularyReviews/records", {
    records: [
      {
        fields: {
          vocabId,
          userId: resolvedUserId,
          userSentence: "",
          status: "pending_correction",
          reviewedAt: new Date().toISOString()
        }
      }
    ]
  });
}

export async function addPracticeTemplate(
  type: 'reading' | 'writing' | 'speaking' | 'grammar',
  fields: any
): Promise<any> {
  const resolvedUserId = await getUserIdFromCookie();
  if (resolvedUserId !== 'd68f7a67-42fb-43b2-a1c7-1108eb99150a') {
    throw new Error("Unauthorized access. Access restricted to administrator.");
  }

  const tableMap = {
    reading: 'ReadingPractice',
    writing: 'WritingPractice',
    speaking: 'SpeakingPractice',
    grammar: 'GrammarPractice'
  };

  const table = tableMap[type];
  if (!table) throw new Error("Invalid practice type");

  return gristWrite('POST', `/tables/${table}/records`, {
    records: [{ fields: { ...fields, createdAt: new Date().toISOString() } }]
  });
}

export async function updatePracticeTemplate(
  type: 'reading' | 'writing' | 'speaking' | 'grammar',
  id: number,
  fields: any
): Promise<any> {
  const resolvedUserId = await getUserIdFromCookie();
  if (resolvedUserId !== 'd68f7a67-42fb-43b2-a1c7-1108eb99150a') {
    throw new Error("Unauthorized access. Access restricted to administrator.");
  }

  const tableMap = {
    reading: 'ReadingPractice',
    writing: 'WritingPractice',
    speaking: 'SpeakingPractice',
    grammar: 'GrammarPractice'
  };

  const table = tableMap[type];
  if (!table) throw new Error("Invalid practice type");

  return gristWrite('PATCH', `/tables/${table}/records`, {
    records: [{ id, fields }]
  });
}


