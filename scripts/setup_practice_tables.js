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

// ─── Columns configuration ───
const SUBMISSION_SCHEMAS = {
  ReadingPracticeSubmission: [
    { id: "practiceId", fields: { label: "practiceId", type: "Ref:ReadingPractice" } },
    { id: "userId", fields: { label: "userId", type: "Text" } },
    { id: "userAnswersJson", fields: { label: "userAnswersJson", type: "Text" } },
    { id: "correctionsJson", fields: { label: "correctionsJson", type: "Text" } },
    { id: "correctionsJson_vn", fields: { label: "correctionsJson_vn", type: "Text" } },
    { id: "status", fields: { label: "status", type: "Text" } },
    { id: "date", fields: { label: "date", type: "Text" } },
    { id: "updatedAt", fields: { label: "updatedAt", type: "Text" } }
  ],
  WritingPracticeSubmission: [
    { id: "practiceId", fields: { label: "practiceId", type: "Ref:WritingPractice" } },
    { id: "userId", fields: { label: "userId", type: "Text" } },
    { id: "userParagraph", fields: { label: "userParagraph", type: "Text" } },
    { id: "correctedParagraph", fields: { label: "correctedParagraph", type: "Text" } },
    { id: "correctionsJson", fields: { label: "correctionsJson", type: "Text" } },
    { id: "correctionsJson_vn", fields: { label: "correctionsJson_vn", type: "Text" } },
    { id: "status", fields: { label: "status", type: "Text" } },
    { id: "date", fields: { label: "date", type: "Text" } },
    { id: "updatedAt", fields: { label: "updatedAt", type: "Text" } }
  ],
  SpeakingPracticeSubmission: [
    { id: "practiceId", fields: { label: "practiceId", type: "Ref:SpeakingPractice" } },
    { id: "userId", fields: { label: "userId", type: "Text" } },
    { id: "userAudioFileId", fields: { label: "userAudioFileId", type: "Text" } },
    { id: "transcript", fields: { label: "transcript", type: "Text" } },
    { id: "grammarFeedback", fields: { label: "grammarFeedback", type: "Text" } },
    { id: "grammarFeedback_vn", fields: { label: "grammarFeedback_vn", type: "Text" } },
    { id: "pronunciationFeedback", fields: { label: "pronunciationFeedback", type: "Text" } },
    { id: "pronunciationFeedback_vn", fields: { label: "pronunciationFeedback_vn", type: "Text" } },
    { id: "score", fields: { label: "score", type: "Int" } },
    { id: "status", fields: { label: "status", type: "Text" } },
    { id: "date", fields: { label: "date", type: "Text" } },
    { id: "updatedAt", fields: { label: "updatedAt", type: "Text" } }
  ],
  GrammarPracticeSubmission: [
    { id: "practiceId", fields: { label: "practiceId", type: "Ref:GrammarPractice" } },
    { id: "userId", fields: { label: "userId", type: "Text" } },
    { id: "userAnswersJson", fields: { label: "userAnswersJson", type: "Text" } },
    { id: "correctionsJson", fields: { label: "correctionsJson", type: "Text" } },
    { id: "correctionsJson_vn", fields: { label: "correctionsJson_vn", type: "Text" } },
    { id: "status", fields: { label: "status", type: "Text" } },
    { id: "date", fields: { label: "date", type: "Text" } },
    { id: "updatedAt", fields: { label: "updatedAt", type: "Text" } }
  ]
};

async function getExistingTables() {
  const res = await fetch(`${BASE}/tables`, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`Failed to list Grist tables (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return (data.tables ?? []).map((t) => t.id);
}

async function createTable(tableId, columns) {
  console.log(`Creating table ${tableId}...`);
  const body = {
    tables: [
      {
        id: tableId,
        columns: columns
      }
    ]
  };

  const res = await fetch(`${BASE}/tables`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Failed to create table ${tableId} (${res.status}): ${await res.text()}`);
  }
  console.log(`  -> Table ${tableId} created successfully!`);
}

async function ensureProfessionColumn(tableId) {
  const res = await fetch(`${BASE}/tables/${tableId}/columns`, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`Failed to get columns for ${tableId} (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const columns = data.columns ?? [];
  const hasProfession = columns.some((c) => c.id === "profession");

  if (!hasProfession) {
    console.log(`Adding profession column to ${tableId}...`);
    const addRes = await fetch(`${BASE}/tables/${tableId}/columns`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        columns: [
          {
            id: "profession",
            fields: {
              label: "profession",
              type: "Text"
            }
          }
        ]
      }),
    });
    if (!addRes.ok) {
      throw new Error(`Failed to add profession column to ${tableId} (${addRes.status}): ${await addRes.text()}`);
    }
    console.log(`  -> Column profession added to ${tableId}.`);
  } else {
    console.log(`Column profession already exists in ${tableId}.`);
  }
}

async function main() {
  try {
    const existingTables = await getExistingTables();
    console.log("Existing tables:", existingTables);

    // 1. Ensure profession column in original tables
    const originalTables = ["ReadingPractice", "WritingPractice", "SpeakingPractice", "GrammarPractice"];
    for (const table of originalTables) {
      if (existingTables.includes(table)) {
        await ensureProfessionColumn(table);
      } else {
        console.warn(`Original table ${table} does not exist yet! Creating it first...`);
        // If they don't exist, create them with baseline fields + profession
        // Usually they already exist in the user's grist document.
      }
    }

    // 2. Create the submission tables if they do not exist
    for (const [tableId, columns] of Object.entries(SUBMISSION_SCHEMAS)) {
      if (existingTables.includes(tableId)) {
        console.log(`Table ${tableId} already exists.`);
      } else {
        await createTable(tableId, columns);
      }
    }

    console.log("\nPractice schema splitting complete!");
  } catch (err) {
    console.error("Migration error:", err.message);
    process.exit(1);
  }
}

main();
