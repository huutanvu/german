const fs = require('fs');
const path = require('path');

// Load environment variables manually
const envPath = '/home/tvu/work/german/frontend/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnv = (key) => {
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : '';
};

const GRIST_URL = getEnv('GRIST_URL') || 'https://docs.getgrist.com/api';
const GRIST_DOC = getEnv('GRIST_DOC');
const GRIST_KEY = getEnv('GRIST_KEY');

const url = `${GRIST_URL}/docs/${GRIST_DOC}/tables/LearningContext/records`;

console.log('Querying Grist LearningContext...');
fetch(url, {
  headers: {
    'Authorization': `Bearer ${GRIST_KEY}`
  }
})
.then(res => {
  if (!res.ok) {
    return res.text().then(text => { throw new Error(text) });
  }
  return res.json();
})
.then(data => {
  console.log('Data:', JSON.stringify(data, null, 2));
})
.catch(err => {
  console.error('Error:', err);
});
