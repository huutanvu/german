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

async function addLevelColumn(table) {
  console.log(`Adding 'level' column to ${table}...`);
  const colDef = {
    columns: [
      {
        id: "level",
        fields: {
          label: "level",
          type: "Choice",
          widgetOptions: JSON.stringify({ choices: ["A1", "A2", "B1", "B2", "C1", "C2"] })
        }
      }
    ]
  };

  const res = await fetch(`${BASE}/tables/${table}/columns`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(colDef),
  });

  if (res.status === 200) {
    console.log(`Successfully added 'level' column to ${table}`);
  } else if (res.status === 400) {
    const err = await res.json();
    if (err.error && err.error.includes("already exists")) {
      console.log(`'level' column already exists in ${table}`);
    } else {
      console.error(`Failed to add column to ${table}:`, err);
    }
  } else {
    console.error(`Failed to add column to ${table}: ${res.status} ${res.statusText}`);
  }
}

async function run() {
  const tables = ["ReadingPractice", "WritingPractice", "SpeakingPractice", "GrammarPractice"];
  for (const t of tables) {
    await addLevelColumn(t);
  }
  console.log("Column updates finished.");
}

run().catch(console.error);
