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

async function checkTableExists() {
  const res = await fetch(`${BASE}/tables`, { headers: HEADERS });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list Grist tables (${res.status}): ${text}`);
  }
  const data = await res.json();
  const tables = data.tables ?? [];
  return tables.some((t) => t.id === "VocabularyUsage");
}

async function createVocabularyUsageTable() {
  console.log("Creating VocabularyUsage table in Grist...");
  const body = {
    tables: [
      {
        id: "VocabularyUsage",
        columns: [
          { id: "vocabId", fields: { label: "vocabId", type: "Ref:Vocabulary" } },
          { id: "profession", fields: { label: "profession", type: "Text" } },
          { id: "dailyUse", fields: { label: "dailyUse", type: "Text" } },
          { id: "dailyUse_vn", fields: { label: "dailyUse_vn", type: "Text" } },
          { id: "professionalUse", fields: { label: "professionalUse", type: "Text" } },
          { id: "professionalUse_vn", fields: { label: "professionalUse_vn", type: "Text" } },
          { id: "tips", fields: { label: "tips", type: "Text" } },
          { id: "tips_vn", fields: { label: "tips_vn", type: "Text" } },
          { id: "caution", fields: { label: "caution", type: "Text" } },
          { id: "caution_vn", fields: { label: "caution_vn", type: "Text" } },
          { id: "createdAt", fields: { label: "createdAt", type: "Text" } },
          { id: "userId", fields: { label: "userId", type: "Text" } }
        ]
      }
    ]
  };

  const res = await fetch(`${BASE}/tables`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create VocabularyUsage table (${res.status}): ${text}`);
  }
  console.log("  -> Table VocabularyUsage created successfully!");
}

async function main() {
  try {
    const exists = await checkTableExists();
    if (exists) {
      console.log("VocabularyUsage table already exists in Grist.");
    } else {
      await createVocabularyUsageTable();
    }
  } catch (err) {
    console.error("Error ensuring VocabularyUsage table:", err.message);
    process.exit(1);
  }
}

main();
