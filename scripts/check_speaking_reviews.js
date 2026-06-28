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

async function run() {
  const res = await fetch(`${base}/tables/SpeakingPractice/records`, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch records: ${res.status} ${text}`);
  }
  const data = await res.json();
  const pending = data.records.filter(r => r.fields.status === 'pending_assessment');
  console.log('Pending records count:', pending.length);
  console.log(JSON.stringify(pending, null, 2));
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
