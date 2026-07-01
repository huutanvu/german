'use client';

import { useEffect, useState } from 'react';
import { addPracticeTemplate } from '@/lib/grist';

const SAMPLES = {
  reading: `{
  "profession": "nurse",
  "level": "B1",
  "topic": "Patientenaufnahme im Krankenhaus",
  "germanText": "Bei der Patientenaufnahme ist es wichtig, alle relevanten Informationen wie Vorerkrangungen und aktuelle Symptome genau zu dokumentieren.",
  "tokensJson": {
    "tokens": [
      { "t": "Bei", "type": "word", "lemma": "bei" },
      { "t": " " },
      { "t": "der", "type": "word", "lemma": "der" },
      { "t": " " },
      { "t": "Patientenaufnahme", "type": "word", "lemma": "die Patientenaufnahme" },
      { "t": " " },
      { "t": "ist", "type": "verb", "lemma": "sein" },
      { "t": " " },
      { "t": "es", "type": "word", "lemma": "es" },
      { "t": " " },
      { "t": "wichtig", "type": "word", "lemma": "wichtig" },
      { "t": "," }
    ]
  },
  "audioFileId": "example_audio_id",
  "questionsJson": [{"id":1,"type":"single_selection","question":"Was ist bei der Aufnahme wichtig?","options":["Dokumentation der Symptome","Nichts","Kaffee trinken"],"correct_answer":"Dokumentation der Symptome","difficulty":1,"explanation":"Documentation is key.","explanation_vn":"Ghi chép bệnh án là quan trọng nhất."}]
}`,
  writing: `{
  "profession": "nurse",
  "level": "B1",
  "topic": "Dokumentation der Wundversorgung",
  "description": "Describe the process of changing a wound dressing for a diabetic patient in German. Focus on hygiene and sterile procedures."
}`,
  speaking: `{
  "profession": "nurse",
  "level": "B1",
  "topic": "Beantwortung eines Patientenrufs",
  "targetText": "Guten Tag, Herr Müller.",
  "targetTokensJson": {
    "tokens": [
      { "t": "Guten", "type": "word", "lemma": "gut" },
      { "t": " " },
      { "t": "Tag", "type": "word", "lemma": "der Tag" },
      { "t": "," },
      { "t": " " },
      { "t": "Herr", "type": "word", "lemma": "Herr" },
      { "t": " " },
      { "t": "Müller", "type": "name" },
      { "t": "." }
    ]
  },
  "targetAudioFileId": "tts_audio_id"
}`,
  grammar: `{
  "profession": "nurse",
  "level": "B1",
  "topic": "Präpositionen mit Dativ in der Pflege",
  "description": "Practice prepositions that take the dative case (mit, nach, bei, seit, von, zu) in a medical context.",
  "questionsJson": [{"id":1,"type":"fill_in_gap","question":"Ich gehe zu___ Arzt (dem Arzt).","options":["m","r","n"],"correct_answer":"m","difficulty":1,"explanation":"zu + dem = zum","explanation_vn":"zu đi với Dativ, der Arzt -> dem Arzt, viết tắt là zum."}]
}`
};

const PROFESSIONS = [
  { slug: '', label: 'All / Shared (Visible to everyone)' },
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handlePayloadChange(text);
    };
    reader.readAsText(file);
  };

  const compileAnnotatedText = (seqTokens: any[]) => {
    let text = "";
    let currentPos = 0;

    let isBold = false;
    let isItalic = false;

    const tempTokens: any[] = [];

    for (let i = 0; i < seqTokens.length; i++) {
      const st = seqTokens[i];
      const t = st.t || "";

      // Check if this is a bold toggle (double asterisks/underscores)
      if (t === "**" || t === "__") {
        isBold = !isBold;
        continue;
      }

      // Check if it is two adjacent single asterisks/underscores representing bold
      if ((t === "*" && i + 1 < seqTokens.length && seqTokens[i + 1].t === "*") ||
        (t === "_" && i + 1 < seqTokens.length && seqTokens[i + 1].t === "_")) {
        isBold = !isBold;
        i++; // skip next asterisk
        continue;
      }

      // Check if this is an italic toggle (single asterisk/underscore)
      if (t === "*" || t === "_") {
        isItalic = !isItalic;
        continue;
      }

      // Check if the token text itself is wrapped in bold/italic (e.g. "**Quellcode**")
      let cleanText = t;
      let tokenBold = isBold;
      let tokenItalic = isItalic;

      if ((cleanText.startsWith("**") && cleanText.endsWith("**")) || (cleanText.startsWith("__") && cleanText.endsWith("__"))) {
        tokenBold = true;
        cleanText = cleanText.slice(2, -2);
      } else if ((cleanText.startsWith("*") && cleanText.endsWith("*")) || (cleanText.startsWith("_") && cleanText.endsWith("_"))) {
        tokenItalic = true;
        cleanText = cleanText.slice(1, -1);
      }

      const start = currentPos;
      const end = currentPos + cleanText.length;
      text += cleanText;
      currentPos = end;

      tempTokens.push({
        index: tempTokens.length, // temporary index
        text: cleanText,
        spans: [[start, end]],
        type: st.type || (cleanText.trim() ? "word" : "space"),
        lemma: st.lemma,
        sepId: st.sepId,
        bold: tokenBold,
        italic: tokenItalic
      });
    }

    const sepMap = new Map<number, number>();
    tempTokens.forEach((t, idx) => {
      t.index = idx;
      if (t.sepId !== undefined) {
        if (t.type === "separable" || t.type === "verb" || (t.lemma && !t.type?.includes("prefix"))) {
          sepMap.set(t.sepId, t.index);
        }
      }
    });

    const finalTokens: any[] = [];
    tempTokens.forEach((t) => {
      if (t.sepId !== undefined) {
        const primaryIdx = sepMap.get(t.sepId);
        if (primaryIdx !== undefined && primaryIdx !== t.index) {
          const primaryToken = tempTokens[primaryIdx];
          if (primaryToken) {
            primaryToken.spans.push(t.spans[0]);
            primaryToken.type = "separable";
          }
          return;
        }
      }
      finalTokens.push({
        index: finalTokens.length,
        spans: t.spans,
        type: t.type,
        lemma: t.lemma,
        bold: t.bold || undefined,
        italic: t.italic || undefined
      });
    });

    finalTokens.forEach((t, idx) => {
      t.index = idx;
    });

    return {
      text,
      tokens: finalTokens
    };
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

    if (!parsed.level || !['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(parsed.level)) {
      setJsonError('JSON must include a valid "level" property (A1, A2, B1, B2, C1, or C2).');
      return;
    }
    if (parsed.questionsJson) {
      parsed.questionsJson = JSON.stringify(parsed.questionsJson);
    }

    // Process Reading practice tokens
    if (parsed.tokensJson && typeof parsed.tokensJson === 'object') {
      const tokensObj = parsed.tokensJson;
      if (Array.isArray(tokensObj.tokens) && tokensObj.tokens.length > 0 && tokensObj.tokens[0].t !== undefined) {
        const compiled = compileAnnotatedText(tokensObj.tokens);
        parsed.germanText = compiled.text;
        parsed.tokensJson = JSON.stringify(compiled);
      } else {
        parsed.tokensJson = JSON.stringify(tokensObj);
      }
    } else if (parsed.tokensJson && typeof parsed.tokensJson === 'string') {
      try {
        const tokensObj = JSON.parse(parsed.tokensJson);
        if (Array.isArray(tokensObj.tokens) && tokensObj.tokens.length > 0 && tokensObj.tokens[0].t !== undefined) {
          const compiled = compileAnnotatedText(tokensObj.tokens);
          parsed.germanText = compiled.text;
          parsed.tokensJson = JSON.stringify(compiled);
        }
      } catch { }
    }

    // Process Speaking practice tokens
    if (parsed.targetTokensJson && typeof parsed.targetTokensJson === 'object') {
      const tokensObj = parsed.targetTokensJson;
      if (Array.isArray(tokensObj.tokens) && tokensObj.tokens.length > 0 && tokensObj.tokens[0].t !== undefined) {
        const compiled = compileAnnotatedText(tokensObj.tokens);
        parsed.targetText = compiled.text;
        parsed.targetTokensJson = JSON.stringify(compiled);
      } else {
        parsed.targetTokensJson = JSON.stringify(tokensObj);
      }
    } else if (parsed.targetTokensJson && typeof parsed.targetTokensJson === 'string') {
      try {
        const tokensObj = JSON.parse(parsed.targetTokensJson);
        if (Array.isArray(tokensObj.tokens) && tokensObj.tokens.length > 0 && tokensObj.tokens[0].t !== undefined) {
          const compiled = compileAnnotatedText(tokensObj.tokens);
          parsed.targetText = compiled.text;
          parsed.targetTokensJson = JSON.stringify(compiled);
        }
      } catch { }
    }

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
    const sharedNote = promptProfession === ""
      ? "Since the profession slug is empty (\"\"), this exercise is a shared/general topic for everyone. Do NOT tailor it to a specific profession; make it general, universally applicable, and suitable for all learners."
      : `Make the content specifically relevant to the professional field of a ${profLabel}.`;

    const newsResearchDirective = promptProfession === ""
      ? "CRITICAL REQUIREMENT: Before generating the content, you must search and research the latest daily news, actual developments, or factual reports suitable for all audiences (general context). The German text and sentences must be strictly based on actual, real-world factual reports retrieved from reliable newspapers, websites, or forums. Do NOT use fake, generic, or fictional news."
      : `CRITICAL REQUIREMENT: Before generating the content, you must search and research the latest daily news, actual developments, or factual reports related specifically to the professional field of a "${profLabel}" (profession slug: "${promptProfession}"). The German text and sentences must be strictly based on actual, real-world current news events or factual reports retrieved from reliable newspapers, websites, or forums within this professional field. Do NOT use fake, generic, or fictional news.`;

    if (type === 'reading') {
      return `You are a German language teacher fluent in English and Vietnamese.
Generate a German reading practice exercise tailored for a "${profLabel}" at level "${promptLevel}" (profession slug: "${promptProfession}", level: "${promptLevel}").

${sharedNote}
${newsResearchDirective}
Return a downloadable json file, do not print to the user.

Provide the output as a single, valid JSON object matching this schema:
{
  "profession": "${promptProfession}",
  "level": "${promptLevel}",
  "topic": "[Choose a unique topic title in German, NOT English or Vietnamese]",
  "germanText": "[A German reading passage of 250-350 words, structured in at least 2 paragraphs.]",
  "tokensJson": {
    "tokens": [
      { "t": "Bei", "type": "word", "lemma": "bei" },
      { "t": " " },
      { "t": "der", "type": "word", "lemma": "der" },
      { "t": "Patientenaufnahme", "type": "word", "lemma": "die Patientenaufnahme" },
      { "t": " " },
      { "t": "ist", "type": "verb", "lemma": "sein" },
      { "t": " " },
      { "t": "es", "type": "word", "lemma": "es" },
      { "t": " " },
      { "t": "wichtig", "type": "word", "lemma": "wichtig" },
      { "t": "," },
      ...
    ]
  },
  "audioFileId": "",
  "questionsJson": [
    {
      "id": 1,
      "type": "single_selection",
      "question": "question text in German",
      "options": ["Option A", "Option B", ...],
      "correct_answer": "Option A",
      "difficulty": 1,
      "explanation": "English explanation",
      "explanation_vn": "Vietnamese explanation"
    },
    ...
  ]
}

Tokenization Rules:
1. Every character in the germanText (including spaces and punctuation) must be represented as a token in sequence inside the "tokens" array.
2. The "t" property must contain the exact text slice.
3. If it is a word or verb, specify type "word" or "verb" and provide the "lemma" (nominative singular with article for nouns e.g., "die Patientenaufnahme", bare infinitive for verbs e.g., "sein", uninflected base form for adjectives/adverbs e.g., "wichtig", and for articles e.g. der/die/das/dem/den/des/ein/eine/einem/einen/einer the lemma must match exactly the clean clicked word itself e.g., "dem" -> "dem", "den" -> "den").
4. For proper names (people, places, brands), use type "name" and omit the lemma. Proper names are non-interactive.
5. For space or punctuation tokens, omit the lemma and use type "space" or "punctuation".
6. For separable verbs (e.g. "abholen" split into "hole" and "ab"), assign the same integer "sepId" to both tokens. For example, the stem token is {"t": "hole", "type": "verb", "lemma": "abholen", "sepId": 1} and the prefix token is {"t": "ab", "type": "prefix", "sepId": 1}. Do NOT calculate character offsets/spans yourself.

CRITICAL Tokenization Example for Separable Verbs:
Sentence: "Ich hole ihn ab."
The separable verb "abholen" consists of stem "hole" and prefix "ab".
The tokens list MUST be:
[
  { "t": "Ich", "type": "word", "lemma": "ich" },
  { "t": " " },
  { "t": "hole", "type": "verb", "lemma": "abholen", "sepId": 1 },
  { "t": " " },
  { "t": "ihn", "type": "word", "lemma": "er" },
  { "t": " " },
  { "t": "ab", "type": "prefix", "sepId": 1 },
  { "t": "." }
]

CRITICAL: 
1. Both tokensJson and questionsJson must be raw JSON objects/arrays (not stringified or escaped). We stringify them later.
2. The questionsJson array must contain exactly 10 questions of increasing difficulty (1 to 10) testing both comprehension and German grammar.
3. The output must be pure JSON with NO markdown code blocks (fences like \`\`\`json) and NO comments or ellipsis (...). All placeholders must be fully generated.
4. The "topic" field value MUST be written in German.
5. The "germanText" must be at least 2 paragraphs long and MUST be strictly based on current news facts related to this topic.
`;
    }

    if (type === 'writing') {
      return `You are a German language teacher fluent in English and Vietnamese.
Generate a German writing practice topic tailored for a "${profLabel}" at level "${promptLevel}" (profession slug: "${promptProfession}", level: "${promptLevel}").

${sharedNote}
${newsResearchDirective}
Return a downloadable json file, do not print to the user.

Provide the output as a single, valid JSON object matching this schema:
{
  "profession": "${promptProfession}",
  "level": "${promptLevel}",
  "topic": "[Choose a unique topic title in German, NOT English or Vietnamese]",
  "description": "[A detailed description and instructions in English guiding the user on what to write in German, specifying grammar/lexical goals]",
  "description_vn": "[A detailed description and instructions in Vietnamese guiding the user on what to write in German, specifying grammar/lexical goals]"
}

CRITICAL: 
1. The output must be pure JSON with NO markdown code blocks (fences like \`\`\`json) and NO comments or ellipsis (...). The "topic" field value MUST be written in German.
`;
    }

    if (type === 'speaking') {
      return `You are a German language teacher fluent in English and Vietnamese.
Generate a German speaking practice prompt tailored for a "${profLabel}" at level "${promptLevel}" (profession slug: "${promptProfession}", level: "${promptLevel}").

${sharedNote}
${newsResearchDirective}
Return a downloadable json file, do not print to the user.

Provide the output as a single, valid JSON object matching this schema:
{
  "profession": "${promptProfession}",
  "level": "${promptLevel}",
  "topic": "[Choose a unique topic title in German, NOT English or Vietnamese]",
  "targetText": "[A natural German sentence or short paragraph representing a speaking or dialogue prompt for the user to read out loud]",
  "targetTokensJson": {
    "tokens": [
      { "t": "Guten", "type": "word", "lemma": "gut" },
      { "t": " " },
      { "t": "Tag", "type": "word", "lemma": "der Tag" },
      { "t": "," },
      { "t": " " },
      { "t": "Herr", "type": "word", "lemma": "Herr" },
      { "t": " " },
      { "t": "Müller", "type": "name" },
      { "t": "." }
    ]
  },
  "targetAudioFileId": ""
}

Tokenization Rules:
1. Every character in the targetText (including spaces and punctuation) must be represented as a token in sequence inside the "tokens" array.
2. The "t" property must contain the exact text slice.
3. If it is a word or verb, specify type "word" or "verb" and provide the "lemma" (nominative singular with article for nouns, bare infinitive for verbs, uninflected base form for adjectives/adverbs, and for articles e.g. der/die/das/dem/den/des/ein/eine/einem/einen/einer the lemma must match exactly the clean clicked word itself e.g., "dem" -> "dem", "den" -> "den").
4. For proper names, use type "name" and omit the lemma. Proper names are non-interactive.
5. For space or punctuation tokens, omit the lemma and use type "space" or "punctuation".
6. For separable verbs (e.g. "abholen" split into "hole" and "ab"), assign the same integer "sepId" to both tokens. For example, the stem token is {"t": "hole", "type": "verb", "lemma": "abholen", "sepId": 1} and the prefix token is {"t": "ab", "type": "prefix", "sepId": 1}. Do NOT calculate character offsets/spans yourself.

CRITICAL Tokenization Example for Separable Verbs:
Sentence: "Ich hole ihn ab."
The separable verb "abholen" consists of stem "hole" and prefix "ab".
The tokens list MUST be:
[
  { "t": "Ich", "type": "word", "lemma": "ich" },
  { "t": " " },
  { "t": "hole", "type": "verb", "lemma": "abholen", "sepId": 1 },
  { "t": " " },
  { "t": "ihn", "type": "word", "lemma": "er" },
  { "t": " " },
  { "t": "ab", "type": "prefix", "sepId": 1 },
  { "t": "." }
]

CRITICAL: 
1. The targetTokensJson must be a raw JSON object (not stringified or escaped). We stringify it later.
2. The output must be pure JSON with NO markdown code blocks (fences like \`\`\`json) and NO comments or ellipsis (...). The "topic" field value MUST be written in German.
`;
    }

    // grammar
    return `You are a German language teacher fluent in English and Vietnamese.
Generate a German grammar practice drill tailored for a "${profLabel}" at level "${promptLevel}" (profession slug: "${promptProfession}", level: "${promptLevel}").

${sharedNote}
${newsResearchDirective}
Return a downloadable json file, do not print to the user.

Provide the output as a single, valid JSON object matching this schema:
{
  "profession": "${promptProfession}",
  "level": "${promptLevel}",
  "topic": "[Choose a unique topic title in German, NOT English or Vietnamese]",
  "description": "[Short grammar guidelines/explanation in English]",
  "description_vn": "[Short grammar guidelines/explanation in Vietnamese]",
  "questionsJson": [
    {
      "id": 1,
      "type": "fill_in_gap",
      "question": "The question in German or English+German. For 'fill_in_gap', use '____' for the missing grammar element (e.g., article, ending, preposition). Do NOT include options in brackets in the question string.",
      "question_vn": "The Vietnamese version of the question. Translate only the English instructional/commentary parts into Vietnamese, leaving all German words, phrases, and sentences verbatim and untranslated (e.g. if question is 'Is this sentence grammatically correct? \"Ich bin Anna\"', the question_vn MUST be 'Câu này có đúng ngữ pháp không? \"Ich bin Anna\"').",
      "options": ["Option A", "Option B", ...],
      "correct_answer": "Option A",
      "difficulty": 1,
      "explanation": "Brief explanation of the grammatical rule in English",
      "explanation_vn": "Brief explanation of the grammatical rule in Vietnamese"
    },
    ...
  ]
}

CRITICAL: 
1. The questionsJson array must contain exactly 15 questions of increasing difficulty (1 to 15) testing case endings, prepositions, articles, etc.
2. The questionsJson must be a raw JSON array of objects (not stringified or escaped). We stringify them later.
3. The output must be pure JSON with NO markdown code blocks (fences like \`\`\`json) and NO comments or ellipsis (...). All placeholders must be fully generated.
4. The "topic" field value MUST be written in German.
5. The "fill_in_gap" question must always provide a list of options, 1 of them must be the correct_answer.
6. The question_vn field must only translate the English parts of the question, keeping all German words and sentences intact (e.g. Is this sentence grammatically correct? "Ich bin Anna" becomes Câu này có đúng ngữ pháp không? "Ich bin Anna").
`;
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
                      className={`py-2 px-3 text-xs font-bold rounded-lg border capitalize transition-all cursor-pointer ${type === t
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                    JSON Payload
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="json-file-upload"
                    />
                    <label
                      htmlFor="json-file-upload"
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer border border-gray-200 dark:border-slate-700"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Upload JSON File
                    </label>
                  </div>
                </div>
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
                  className={`p-3.5 border rounded-xl text-xs font-semibold leading-relaxed ${message.isError
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
              className={`absolute top-4 right-4 p-2 rounded-lg border transition-all cursor-pointer ${copied
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
