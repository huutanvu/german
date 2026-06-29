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

async function addDescriptionVn() {
  console.log("Adding 'description_vn' column to WritingPractice...");
  const colDef = {
    columns: [
      {
        id: "description_vn",
        fields: {
          label: "description_vn",
          type: "Text"
        }
      }
    ]
  };

  const res = await fetch(`${BASE}/tables/WritingPractice/columns`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(colDef),
  });

  if (res.status === 200) {
    console.log("Successfully added 'description_vn' column to WritingPractice");
  } else if (res.status === 400) {
    const err = await res.json();
    if (err.error && err.error.includes("already exists")) {
      console.log("'description_vn' column already exists in WritingPractice");
    } else {
      console.error("Failed to add column:", err);
    }
  } else {
    console.error(`Failed to add column: ${res.status} ${res.statusText}`);
  }
}

addDescriptionVn().catch(console.error);
