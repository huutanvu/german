#!/usr/bin/env node
// Usage: node setup_flotiq_professions.js
// Reads FLOTIQ_RW_KEY from frontend/.env.local
// Creates the profession_reference content type and seeds 7 professions

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

const envPath = path.resolve(__dirname, "../frontend/.env.local");
const env = parseEnv(envPath);

const FLOTIQ_RW_KEY = env.FLOTIQ_RW_KEY;
if (!FLOTIQ_RW_KEY) {
  console.error("Missing FLOTIQ_RW_KEY in frontend/.env.local");
  process.exit(1);
}

const FLOTIQ_URL = "https://api.flotiq.com";
const HEADERS = {
  "X-AUTH-TOKEN": FLOTIQ_RW_KEY,
  "Content-Type": "application/json",
};

// ---------- Content type definition ----------
const CONTENT_TYPE = {
  name: "profession_reference",
  label: "Profession Reference",
  schemaDefinition: {
    type: "object",
    allOf: [
      { $ref: "#/components/schemas/AbstractContentTypeSchemaDefinition" },
      {
        type: "object",
        properties: {
          slug: { type: "string" },
          displayName: { type: "string" },
          description: { type: "string" },
          sampleContext: { type: "string" },
          icon: { type: "string" },
        },
        required: ["slug", "displayName"],
      },
    ],
  },
  metaDefinition: {
    order: ["slug", "displayName", "description", "sampleContext", "icon"],
    propertiesConfig: {
      slug: { label: "Slug", inputType: "text", unique: true },
      displayName: { label: "Display Name", inputType: "text", unique: false },
      description: { label: "Description", inputType: "textarea", unique: false },
      sampleContext: { label: "Sample Context", inputType: "textarea", unique: false },
      icon: { label: "Icon", inputType: "text", unique: false },
    },
  },
};

// ---------- Professions ----------
const PROFESSIONS = [
  {
    id: "profession_reference-software_engineer",
    slug: "software_engineer",
    displayName: "Software Engineer",
    description: "Technology and software development professional",
    sampleContext:
      "Wir deployen heute die neue Version. Das Ticket ist im Backlog. Ich reviewe deinen Pull Request.",
    icon: "laptop",
  },
  {
    id: "profession_reference-healthcare_professional",
    slug: "healthcare_professional",
    displayName: "Healthcare Professional",
    description: "General healthcare and medical professional",
    sampleContext:
      "Die Diagnose wurde gestellt. Wir müssen den Befund besprechen. Der Patient braucht Ruhe.",
    icon: "stethoscope",
  },
  {
    id: "profession_reference-nurse",
    slug: "nurse",
    displayName: "Nurse / Pflegekraft",
    description: "Nursing and patient care professional",
    sampleContext:
      "Ich nehme die Vitalzeichen auf. Das Medikament wird dreimal täglich gegeben.",
    icon: "heart-pulse",
  },
  {
    id: "profession_reference-teacher",
    slug: "teacher",
    displayName: "Teacher / Lehrer/in",
    description: "Education and teaching professional",
    sampleContext:
      "Die Hausaufgaben sind bis Freitag abzugeben. Wir besprechen das Thema in der nächsten Stunde.",
    icon: "graduation-cap",
  },
  {
    id: "profession_reference-legal_professional",
    slug: "legal_professional",
    displayName: "Legal Professional",
    description: "Law and legal services professional",
    sampleContext:
      "Der Vertrag muss bis Ende des Monats unterzeichnet werden. Wir prüfen die Klausel.",
    icon: "scale",
  },
  {
    id: "profession_reference-finance_professional",
    slug: "finance_professional",
    displayName: "Finance Professional",
    description: "Finance, banking, and accounting professional",
    sampleContext:
      "Das Quartalsergebnis liegt vor. Wir müssen den Cashflow analysieren.",
    icon: "chart-bar",
  },
  {
    id: "profession_reference-general",
    slug: "general",
    displayName: "General / Allgemein",
    description: "General everyday professional context",
    sampleContext:
      "Ich habe heute einen wichtigen Termin. Können wir das Meeting verschieben?",
    icon: "briefcase",
  },
];

// ---------- Helpers ----------
async function createContentType() {
  console.log("Creating profession_reference content type...");
  const res = await fetch(`${FLOTIQ_URL}/api/v1/internal/contenttype`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(CONTENT_TYPE),
  });
  if (res.status === 409) {
    console.log("  Content type already exists, skipping.");
    return;
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST contenttype failed (${res.status}): ${text}`);
  }
  console.log("  Content type created successfully.");
}

async function seedProfession(profession) {
  const { id, ...fields } = profession;
  const res = await fetch(
    `${FLOTIQ_URL}/api/v1/content/profession_reference`,
    {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ id, ...fields }),
    }
  );
  if (res.status === 400 || res.status === 409) {
    console.log(`Profession ${profession.slug}: already exists, skipping`);
    return;
  }
  if (!res.ok) {
    const text = await res.text();
    console.error(
      `Profession ${profession.slug}: failed (${res.status}): ${text}`
    );
    return;
  }
  console.log(`Profession ${profession.slug}: created successfully`);
}

// ---------- Main ----------
async function main() {
  try {
    await createContentType();
  } catch (err) {
    console.error("Failed to create content type:", err.message);
    process.exit(1);
  }

  console.log("\nSeeding professions...");
  for (const profession of PROFESSIONS) {
    await seedProfession(profession);
  }
  console.log("\nSetup complete.");
}

main();
