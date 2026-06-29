#!/usr/bin/env node
// Usage: node migrate_grist_userid.js <supabase-user-uuid>
// Reads Grist credentials from mcp-server/.env
// Adds userId to all existing records that are missing it

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- Parse .env ----------
function parseEnv(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    env[key] = value;
  }
  return env;
}

const envPath = path.resolve(__dirname, "../mcp-server/.env");
const env = parseEnv(envPath);

const GRIST_URL = env.GRIST_URL;
const GRIST_DOC = env.GRIST_DOC;
const GRIST_KEY = env.GRIST_KEY;

if (!GRIST_URL || !GRIST_DOC || !GRIST_KEY) {
  console.error("Missing GRIST_URL, GRIST_DOC, or GRIST_KEY in mcp-server/.env");
  process.exit(1);
}

// ---------- Validate userId argument ----------
const userId = process.argv[2];
if (!userId) {
  console.error("Error: no userId provided.");
  console.error("Usage: node migrate_grist_userid.js <supabase-user-uuid>");
  process.exit(1);
}

const BASE = `${GRIST_URL}/docs/${GRIST_DOC}/tables`;
const HEADERS = {
  Authorization: `Bearer ${GRIST_KEY}`,
  "Content-Type": "application/json",
};

// ---------- Tables to migrate ----------
const TABLES = [
  "Vocabulary",
  "VocabularyReviews",
  "WritingPractice",
  "ReadingPractice",
  "GrammarPractice",
  "SpeakingPractice",
  "LearningContext",
];

async function fetchRecords(table) {
  const res = await fetch(`${BASE}/${table}/records`, { headers: HEADERS });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${table} failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.records ?? [];
}

async function patchRecords(table, records) {
  const body = {
    records: records.map((r) => ({
      id: r.id,
      fields: { userId },
    })),
  };
  const res = await fetch(`${BASE}/${table}/records`, {
    method: "PATCH",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH ${table} failed (${res.status}): ${text}`);
  }
}

async function migrateTable(table) {
  const records = await fetchRecords(table);
  const missing = records.filter((r) => !r.fields?.userId);
  console.log(
    `Table ${table}: found ${records.length} records, patching ${missing.length} with userId...`
  );
  if (missing.length === 0) return;
  await patchRecords(table, missing);
  console.log(`  -> Done patching ${table}.`);
}

async function main() {
  console.log(`Migrating userId="${userId}" into Grist doc "${GRIST_DOC}"...\n`);
  for (const table of TABLES) {
    try {
      await migrateTable(table);
    } catch (err) {
      console.error(`  ERROR on table ${table}:`, err.message);
    }
  }
  console.log("\nMigration complete.");
}

main();
