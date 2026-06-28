const fs = require('fs');
const path = require('path');

// Load environment variables manually
const envPath = '/home/tvu/work/german/frontend/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnv = (key) => {
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
};

const GRIST_URL = getEnv('GRIST_URL') || 'https://docs.getgrist.com/api';
const GRIST_DOC = getEnv('GRIST_DOC');
const GRIST_KEY = getEnv('GRIST_KEY');

if (!GRIST_DOC || !GRIST_KEY) {
  console.error('Error: Grist credentials not found.');
  process.exit(1);
}

const base = `${GRIST_URL}/docs/${GRIST_DOC}`;
const headers = {
  Authorization: `Bearer ${GRIST_KEY}`,
  'Content-Type': 'application/json',
};

async function getLearningContext() {
  const res = await fetch(`${base}/tables/LearningContext/records`, { headers });
  if (!res.ok) return null;
  const data = await res.json();
  return data.records?.[0] || null;
}

async function run() {
  const context = await getLearningContext();
  const level = context?.fields?.targetLevel || 'B1';
  const topic = context?.fields?.currentTopic || 'General Software Engineering';

  console.log(`Current context: Level = ${level}, Topic = ${topic}`);

  // Create a speaking practice topic suited for the level and topic
  const targetTopic = "Das tägliche Standup-Meeting";
  const targetText = "Guten Morgen zusammen. Gestern habe ich die Fehler im Registrierungsformular behoben und die neuen Tests geschrieben. Heute werde ich mit der Implementierung der API-Schnittstelle beginnen. Es gibt momentan keine Blockaden, aber ich brauche später kurz Hilfe von Felix bei der Datenbank-Migration. Danke.";

  const dateStr = new Date().toISOString().split('T')[0];

  console.log('Inserting new speaking practice topic...');
  const res = await fetch(`${base}/tables/SpeakingPractice/records`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      records: [
        {
          fields: {
            topic: targetTopic,
            targetText: targetText,
            status: 'pending_recording',
            date: dateStr
          }
        }
      ]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to insert record: ${res.status} ${text}`);
  }

  const result = await res.json();
  console.log('Record inserted successfully:', result);
  console.log(`Topic: "${targetTopic}"`);
  console.log(`Target Text: "${targetText}"`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
