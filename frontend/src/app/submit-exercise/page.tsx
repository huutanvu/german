'use client';

import { useEffect, useState } from 'react';
import { addPracticeTemplate } from '@/lib/grist';

const SAMPLES = {
  reading: `{
  "profession": "nurse",
  "topic": "Patientenaufnahme im Krankenhaus",
  "germanText": "Bei der Patientenaufnahme ist es wichtig, alle relevanten Informationen wie Vorerkrankungen und aktuelle Symptome genau zu dokumentieren.",
  "audioFileId": "example_audio_id",
  "questionsJson": "[{\\"id\\":1,\\"type\\":\\"single_selection\\",\\"question\\":\\"Was ist bei der Aufnahme wichtig?\\",\\"options\\":[\\"Dokumentation der Symptome\\",\\"Nichts\\",\\"Kaffee trinken\\"],\\"correct_answer\\":\\"Dokumentation der Symptome\\",\\"difficulty\\":1,\\"explanation\\":\\"Documentation is key.\\",\\"explanation_vn\\":\\"Ghi chép bệnh án là quan trọng nhất.\\"}]"
}`,
  writing: `{
  "profession": "nurse",
  "topic": "Dokumentation der Wundversorgung",
  "description": "Describe the process of changing a wound dressing for a diabetic patient in German. Focus on hygiene and sterile procedures."
}`,
  speaking: `{
  "profession": "nurse",
  "topic": "Beantwortung eines Patientenrufs",
  "targetText": "Guten Tag, Herr Müller. Wie kann ich Ihnen heute helfen? Haben Sie Schmerzen?",
  "targetAudioFileId": "tts_audio_id"
}`,
  grammar: `{
  "profession": "nurse",
  "topic": "Präpositionen mit Dativ in der Pflege",
  "description": "Practice prepositions that take the dative case (mit, nach, bei, seit, von, zu) in a medical context.",
  "questionsJson": "[{\\"id\\":1,\\"type\\":\\"fill_in_gap\\",\\"question\\":\\"Ich gehe zu___ Arzt (dem Arzt).\\",\\"options\\":[\\"m\\",\\"r\\",\\"n\\"],\\"correct_answer\\":\\"m\\",\\"difficulty\\":1,\\"explanation\\":\\"zu + dem = zum\\",\\"explanation_vn\\":\\"zu đi với Dativ, der Arzt -> dem Arzt, viết tắt là zum.\\"}]"
}`
};

const PROFESSIONS = [
  { slug: 'software_engineer', label: 'Software Engineer' },
  { slug: 'healthcare_professional', label: 'Healthcare Professional' },
  { slug: 'nurse', label: 'Nurse / Pflegekraft' },
  { slug: 'teacher', label: 'Teacher / Lehrer/in' },
  { slug: 'legal_professional', label: 'Legal Professional' },
  { slug: 'finance_professional', label: 'Finance Professional' },
  { slug: 'general', label: 'General / Allgemein' }
];

export default function SubmitExercisePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [type, setType] = useState<'reading' | 'writing' | 'speaking' | 'grammar'>('reading');
  const [level, setLevel] = useState<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'>('B1');
  const [payload, setPayload] = useState(SAMPLES.reading);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  
  // Prompt Generator states
  const [promptProfession, setPromptProfession] = useState('nurse');
  const [promptLevel, setPromptLevel] = useState<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'>('B1');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function checkUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUserId(data.userId);
        }
      } catch (err) {
        console.error('Failed to check user:', err);
      } finally {
        setLoadingUser(false);
      }
    }
    checkUser();
  }, []);

  const handleTypeChange = (newType: 'reading' | 'writing' | 'speaking' | 'grammar') => {
    setType(newType);
    setPayload(SAMPLES[newType]);
    setJsonError(null);
    setMessage(null);
  };

  const handlePayloadChange = (val: string) => {
    setPayload(val);
    try {
      JSON.parse(val);
      setJsonError(null);
    } catch (err: any) {
      setJsonError(err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJsonError(null);
    setMessage(null);

    let parsed: any;
    try {
      parsed = JSON.parse(payload);
    } catch (err: any) {
      setJsonError(`Invalid JSON: ${err.message}`);
      return;
    }

    parsed.level = level;

    setSubmitting(true);
    try {
      await addPracticeTemplate(type, parsed);
      setMessage({ text: 'Practice template submitted successfully!', isError: false });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to submit template', isError: true });
    } finally {
      setSubmitting(false);
    }
  };

  // Generate the AI Prompt based on selected type, profession and level
  const generatePromptText = () => {
    const profLabel = PROFESSIONS.find(p => p.slug === promptProfession)?.label || promptProfession;
    
    if (type === 'reading') {
      return `You are a German language teacher fluent in English and Vietnamese.
Generate a German reading practice exercise tailored for a "${profLabel}" at level "${promptLevel}" (profession slug: "${promptProfession}", level: "${promptLevel}").

Provide the output as a single, valid JSON object matching this schema:
{
  "profession": "${promptProfession}",
  "level": "${promptLevel}",
  "topic": "[Choose a unique topic title in German, NOT English or Vietnamese, matching this professional context]",
  "germanText": "[A German reading passage of 250-350 words, structured in at least 2 paragraphs. You may use markdown (such as bolding key terms, headers, or bullet lists) inside this string to structure the text and make it easier to read when required]",
  "audioFileId": "",
  "questionsJson": "[A stringified JSON array containing exactly 10 comprehension and grammar questions of increasing difficulty (1 to 10) testing case endings, prepositions, articles, etc. Each question object matches: {\\\\\\"id\\\\\\": number, \\\\\\"type\\\\\\": \\\\\\"single_selection\\\\\\" | \\\\\\"multi_selection\\\\\\" | \\\\\\"yes_no\\\\\\" | \\\\\\"fill_in_gap\\\\\\", \\\\\\"question\\\\\\": string, \\\\\\"options\\\\\\": string[], \\\\\\"correct_answer\\\\\\": string | string[], \\\\\\"difficulty\\\\\\": number, \\\\\\"explanation\\\\\\": string, \\\\\\"explanation_vn\\\\\\": string}]"
}

CRITICAL: 
1. The questionsJson must be a string containing a valid JSON array, so double quotes inside questionsJson MUST be correctly escaped (e.g. \\"id\\": 1).
2. The output must be pure JSON with NO markdown code blocks (fences like \`\`\`json) and NO comments or ellipsis (...). All placeholders must be fully generated.
3. The "topic" field value MUST be written in German.
4. The "germanText" must be at least 2 paragraphs long and can use markdown formatting where appropriate.`;
    }
    
    if (type === 'writing') {
      return `You are a German language teacher fluent in English and Vietnamese.
Generate a German writing practice topic tailored for a "${profLabel}" at level "${promptLevel}" (profession slug: "${promptProfession}", level: "${promptLevel}").

Provide the output as a single, valid JSON object matching this schema:
{
  "profession": "${promptProfession}",
  "level": "${promptLevel}",
  "topic": "[Choose a unique topic title in German, NOT English or Vietnamese, matching this professional context]",
  "description": "[A detailed description and instructions in English guiding the user on what to write in German, specifying grammar/lexical goals]"
}

CRITICAL: The output must be pure JSON with NO markdown code blocks (fences like \`\`\`json) and NO comments or ellipsis (...). The "topic" field value MUST be written in German.`;
    }
    
    if (type === 'speaking') {
      return `You are a German language teacher fluent in English and Vietnamese.
Generate a German speaking practice prompt tailored for a "${profLabel}" at level "${promptLevel}" (profession slug: "${promptProfession}", level: "${promptLevel}").

Provide the output as a single, valid JSON object matching this schema:
{
  "profession": "${promptProfession}",
  "level": "${promptLevel}",
  "topic": "[Choose a unique topic title in German, NOT English or Vietnamese, matching this professional context]",
  "targetText": "[A natural German sentence or short paragraph representing a speaking or dialogue prompt for the user to read out loud]",
  "targetAudioFileId": ""
}

CRITICAL: The output must be pure JSON with NO markdown code blocks (fences like \`\`\`json) and NO comments or ellipsis (...). The "topic" field value MUST be written in German.`;
    }
    
    // grammar
    return `You are a German language teacher fluent in English and Vietnamese.
Generate a German grammar practice drill tailored for a "${profLabel}" at level "${promptLevel}" (profession slug: "${promptProfession}", level: "${promptLevel}").

Provide the output as a single, valid JSON object matching this schema:
{
  "profession": "${promptProfession}",
  "level": "${promptLevel}",
  "topic": "[Choose a unique topic title in German, NOT English or Vietnamese, matching this professional context]",
  "description": "[Short grammar guidelines/explanation in English]",
  "questionsJson": "[A stringified JSON array containing exactly 15 grammar questions of increasing difficulty (1 to 15) testing case endings, prepositions, articles, etc. Each question object matches: {\\\\\\"id\\\\\\": number, \\\\\\"type\\\\\\": \\\\\\"single_selection\\\\\\" | \\\\\\"multi_selection\\\\\\" | \\\\\\"yes_no\\\\\\" | \\\\\\"fill_in_gap\\\\\\", \\\\\\"question\\\\\\": string, \\\\\\"options\\\\\\": string[], \\\\\\"correct_answer\\\\\\": string | string[], \\\\\\"difficulty\\\\\\": number, \\\\\\"explanation\\\\\\": string, \\\\\\"explanation_vn\\\\\\": string}]"
}

CRITICAL: 
1. The questionsJson must be a string containing a valid JSON array, so double quotes inside questionsJson MUST be correctly escaped (e.g. \\"id\\": 1).
2. The output must be pure JSON with NO markdown code blocks (fences like \`\`\`json) and NO comments or ellipsis (...). All placeholders must be fully generated.
3. The "topic" field value MUST be written in German.`;
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(generatePromptText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 text-gray-500">
        <div className="animate-pulse text-sm font-semibold">Verifying credentials...</div>
      </div>
    );
  }

  if (userId !== 'd68f7a67-42fb-43b2-a1c7-1108eb99150a') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 px-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-red-200 dark:border-red-950 p-8 rounded-2xl shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0-6v2m0-8H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V9l-5-5z" />
            </svg>
          </div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">Access Denied</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            You do not have administrative privileges to access this configuration page.
          </p>
          <a
            href="/"
            className="inline-block mt-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-xs font-bold rounded-lg transition-colors"
          >
            Return to Dashboard
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Submit Exercise Template
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
            Create new global reference exercises categorized by professions directly in the Grist database.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                    Practice Type
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['reading', 'writing', 'speaking', 'grammar'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleTypeChange(t)}
                        className={`py-2 px-1 text-xs font-bold rounded-lg border capitalize transition-all cursor-pointer ${
                          type === t
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-500/10'
                            : 'bg-white dark:bg-slate-950 border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-900'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                    Target Level
                  </label>
                  <div className="grid grid-cols-6 gap-1">
                    {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setLevel(l)}
                        className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          level === l
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-500/10'
                            : 'bg-white dark:bg-slate-950 border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-900'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  JSON Payload
                </label>
                <textarea
                  value={payload}
                  onChange={(e) => handlePayloadChange(e.target.value)}
                  rows={14}
                  className="w-full font-mono text-xs p-4 bg-gray-50 dark:bg-slate-950 text-gray-800 dark:text-slate-200 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-inner leading-relaxed"
                  placeholder="Paste JSON payload here..."
                />
              </div>

              {jsonError && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-xs font-semibold font-mono whitespace-pre-wrap leading-relaxed">
                  ⚠️ {jsonError}
                </div>
              )}

              {message && (
                <div
                  className={`p-3.5 border rounded-xl text-xs font-semibold leading-relaxed ${
                    message.isError
                      ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400'
                      : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {message.isError ? '❌' : '✅'} {message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !!jsonError}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm shadow-md shadow-indigo-500/10 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {submitting ? 'Submitting to Grist...' : 'Publish Template'}
              </button>
            </form>
          </div>

          {/* Guide Sidebar */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              Expected JSON Format
            </h2>
            <div className="text-xs text-gray-600 dark:text-slate-400 space-y-3 leading-relaxed">
              <p>Your JSON payload must specify:</p>
              <ul className="list-disc pl-4 space-y-1.5 font-medium">
                <li>
                  <code className="text-indigo-600 dark:text-indigo-400">profession</code>: Slug of the target profession (e.g. <code className="text-gray-900 dark:text-white">"nurse"</code>, <code className="text-gray-900 dark:text-white">"software_engineer"</code>, etc.)
                </li>
                <li>
                  <code className="text-indigo-600 dark:text-indigo-400">topic</code>: Unique learning topic description.
                </li>
              </ul>
              <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
                <span className="font-bold text-gray-900 dark:text-white block mb-1">
                  Required Type Fields:
                </span>
                {type === 'reading' && (
                  <span className="block text-[11px] font-mono leading-normal bg-gray-50 dark:bg-slate-950 p-2.5 rounded border border-gray-100 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    - germanText (string)<br />
                    - audioFileId (string)<br />
                    - questionsJson (JSON string array of 10 items)
                  </span>
                )}
                {type === 'writing' && (
                  <span className="block text-[11px] font-mono leading-normal bg-gray-50 dark:bg-slate-950 p-2.5 rounded border border-gray-100 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    - description (string instructions)
                  </span>
                )}
                {type === 'speaking' && (
                  <span className="block text-[11px] font-mono leading-normal bg-gray-50 dark:bg-slate-950 p-2.5 rounded border border-gray-100 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    - targetText (string)<br />
                    - targetAudioFileId (string)
                  </span>
                )}
                {type === 'grammar' && (
                  <span className="block text-[11px] font-mono leading-normal bg-gray-50 dark:bg-slate-950 p-2.5 rounded border border-gray-100 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    - description (string)<br />
                    - questionsJson (JSON string array of 15 items)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* AI Prompt Generator Section */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">AI Generator Prompt Builder</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Configure and copy a prompt to generate compliant JSON templates from any AI chatbot.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Profession:
                </label>
                <select
                  value={promptProfession}
                  onChange={(e) => setPromptProfession(e.target.value)}
                  className="text-xs font-semibold py-1.5 px-2.5 rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-gray-800 dark:text-gray-200 outline-none cursor-pointer"
                >
                  {PROFESSIONS.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Level:
                </label>
                <select
                  value={promptLevel}
                  onChange={(e) => setPromptLevel(e.target.value as any)}
                  className="text-xs font-semibold py-1.5 px-2.5 rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-gray-800 dark:text-gray-200 outline-none cursor-pointer"
                >
                  {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="relative bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
            <pre className="text-xs text-gray-700 dark:text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto pr-8">
              {generatePromptText()}
            </pre>
            
            <button
              onClick={handleCopyPrompt}
              className={`absolute top-4 right-4 p-2 rounded-lg border transition-all cursor-pointer ${
                copied
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
              title="Copy prompt"
            >
              {copied ? (
                <span className="text-[10px] font-bold px-1">Copied!</span>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-5 4h5m-5 4h5m-9-4h.01M5 14h.01" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
