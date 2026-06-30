#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
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

const GRIST_URL = env.GRIST_URL || process.env.GRIST_URL;
const GRIST_DOC = env.GRIST_DOC || process.env.GRIST_DOC;
const GRIST_KEY = env.GRIST_KEY || process.env.GRIST_KEY;

if (!GRIST_URL || !GRIST_DOC || !GRIST_KEY) {
  console.error("Missing GRIST credentials in mcp-server/.env or environment");
  process.exit(1);
}

const BASE = `${GRIST_URL}/docs/${GRIST_DOC}`;
const HEADERS = {
  Authorization: `Bearer ${GRIST_KEY}`,
  "Content-Type": "application/json",
};

const columnsToAdd = {
  ReadingPractice: [
    { id: "tokensJson", fields: { label: "tokensJson", type: "Text" } }
  ],
  WritingPracticeSubmission: [
    { id: "correctedTokensJson", fields: { label: "correctedTokensJson", type: "Text" } }
  ],
  SpeakingPractice: [
    { id: "targetTokensJson", fields: { label: "targetTokensJson", type: "Text" } }
  ],
  Vocabulary: [
    { id: "dailyUseTokensJson", fields: { label: "dailyUseTokensJson", type: "Text" } },
    { id: "dailyUseTokensJson_vn", fields: { label: "dailyUseTokensJson_vn", type: "Text" } },
    { id: "professionalUseTokensJson", fields: { label: "professionalUseTokensJson", type: "Text" } },
    { id: "professionalUseTokensJson_vn", fields: { type: "Text", label: "Professional Use Tokens JSON (VN)" } }
  ]
};

async function getExistingColumns(tableId) {
  try {
    const res = await fetch(`${BASE}/tables/${tableId}/columns`, { headers: HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.columns ?? []).map(c => c.id);
  } catch (err) {
    console.error(`Error listing columns for ${tableId}:`, err);
    return null;
  }
}

async function addColumn(tableId, col) {
  console.log(`Adding column ${col.id} to table ${tableId}...`);
  const res = await fetch(`${BASE}/tables/${tableId}/columns`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      columns: [col]
    })
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`  -> Failed to add column ${col.id}: ${res.status} ${body}`);
  } else {
    console.log(`  -> Column ${col.id} added successfully.`);
  }
}

async function main() {
  for (const [tableId, cols] of Object.entries(columnsToAdd)) {
    const existing = await getExistingColumns(tableId);
    if (!existing) {
      console.warn(`Table ${tableId} not found or columns could not be listed. Skipping.`);
      continue;
    }
    for (const col of cols) {
      if (existing.includes(col.id)) {
        console.log(`Column ${col.id} already exists in ${tableId}. Skipping.`);
      } else {
        await addColumn(tableId, col);
      }
    }
  }
  console.log("Migration complete.");
}

main().catch(err => {
  console.error("Migration script failed:", err);
  process.exit(1);
});
