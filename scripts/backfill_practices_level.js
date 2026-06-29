#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  console.error("Missing GRIST credentials in mcp-server/.env");
  process.exit(1);
}

const BASE = `${GRIST_URL}/docs/${GRIST_DOC}`;
const HEADERS = {
  Authorization: `Bearer ${GRIST_KEY}`,
  "Content-Type": "application/json",
};

async function backfillTable(table) {
  console.log(`Fetching records for ${table}...`);
  const res = await fetch(`${BASE}/tables/${table}/records`, { headers: HEADERS });
  if (!res.ok) {
    console.error(`Failed to fetch ${table} records: ${res.status}`);
    return;
  }
  const data = await res.json();
  const records = data.records || [];
  console.log(`Found ${records.length} records in ${table}`);

  const updateRecords = [];
  for (const r of records) {
    if (!r.fields.level) {
      updateRecords.push({
        id: r.id,
        fields: { level: "B1" }
      });
    }
  }

  if (updateRecords.length === 0) {
    console.log(`No records need backfilling in ${table}`);
    return;
  }

  console.log(`Patching ${updateRecords.length} records in ${table} with default level 'B1'...`);
  const patchRes = await fetch(`${BASE}/tables/${table}/records`, {
    method: "PATCH",
    headers: HEADERS,
    body: JSON.stringify({ records: updateRecords })
  });

  if (patchRes.ok) {
    console.log(`Successfully backfilled ${table}`);
  } else {
    console.error(`Failed to backfill ${table}: ${patchRes.status} ${await patchRes.text()}`);
  }
}

async function run() {
  const tables = ["ReadingPractice", "WritingPractice", "SpeakingPractice", "GrammarPractice"];
  for (const t of tables) {
    await backfillTable(t);
  }
  console.log("Backfill finished.");
}

run().catch(console.error);
