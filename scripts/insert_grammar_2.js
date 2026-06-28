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

const topic = "Nebensätze, Relativsätze und Modalverben";
const description = "Master complex German sentences: subordinating conjunctions (weil, dass, wenn, obwohl, damit), relative clauses with dative/genitive pronouns, and modal verb usage in software contexts.";

const questions = [
  {
    id: 1,
    type: "yes_no",
    question: "Konjugiert man 'müssen' für 'wir' als 'wir müsst'?",
    options: ["Ja", "Nein"],
    correct_answer: "Nein",
    difficulty: 1,
    explanation: "The first person plural conjugation is: wir müssen.",
    explanation_vn: "Cách chia ngôi thứ nhất số nhiều là: wir müssen."
  },
  {
    id: 2,
    type: "fill_in_gap",
    question: "Er sagt, ____ er den Bug behoben hat.",
    options: ["dass", "das", "was"],
    correct_answer: "dass",
    difficulty: 2,
    explanation: "dass is the subordinating conjunction meaning 'that'. das is a relative pronoun or article.",
    explanation_vn: "'dass' là liên từ phụ có nghĩa là 'rằng'. 'das' là đại từ quan hệ hoặc mạo từ."
  },
  {
    id: 3,
    type: "fill_in_gap",
    question: "____ wir Zeit haben, machen wir ein Code-Review.",
    options: ["Wenn", "Wann", "Weil"],
    correct_answer: "Wenn",
    difficulty: 3,
    explanation: "Wenn introduces a conditional clause ('if/when we have time'). Wann is only used for questions about time.",
    explanation_vn: "'Wenn' bắt đầu mệnh đề điều kiện ('nếu/khi chúng tôi có thời gian'). 'Wann' chỉ được sử dụng cho câu hỏi về thời gian."
  },
  {
    id: 4,
    type: "single_selection",
    question: "Der Kollege, ____ uns hilft, ist nett.",
    options: ["der", "den", "dem", "dessen"],
    correct_answer: "der",
    difficulty: 4,
    explanation: "The relative clause subject is masculine singular, so it uses 'der' in Nominative.",
    explanation_vn: "Chủ ngữ của mệnh đề quan hệ là giống đực số ít, vì vậy nó dùng 'der' ở Nominative."
  },
  {
    id: 5,
    type: "fill_in_gap",
    question: "Der Code ist gut, aber er ____ noch optimiert werden.",
    options: ["muss", "gemusst", "müsse", "zu müssen"],
    correct_answer: "muss",
    difficulty: 5,
    explanation: "aber does not change word order (position 0). The verb (muss) occupies position 2.",
    explanation_vn: "'aber' không làm thay đổi vị trí từ (vị trí 0). Động từ (muss) đứng ở vị trí số 2."
  },
  {
    id: 6,
    type: "fill_in_gap",
    question: "Die Kollegen, mit ____ wir arbeiten, sind erfahren.",
    options: ["denen", "die", "den", "deren"],
    correct_answer: "denen",
    difficulty: 6,
    explanation: "After 'mit' (Dative), the plural relative pronoun is 'denen'.",
    explanation_vn: "Sau giới từ 'mit' (yêu cầu Dativ), đại từ quan hệ số nhiều là 'denen'."
  },
  {
    id: 7,
    type: "single_selection",
    question: "Wir machen Code-Reviews, weil wir Fehler vermeiden ____.",
    options: ["wollen", "gewollt", "haben wollen", "wollten"],
    correct_answer: "wollen",
    difficulty: 7,
    explanation: "Subordinating conjunction weil requires the conjugated verb (wollen) at the end of the clause.",
    explanation_vn: "Liên từ phụ 'weil' yêu cầu động từ được chia (wollen) đứng cuối câu."
  },
  {
    id: 8,
    type: "yes_no",
    question: "Bedeutet 'ob' 'weil'?",
    options: ["Ja", "Nein"],
    correct_answer: "Nein",
    difficulty: 8,
    explanation: "ob means 'whether/if' (indirect questions), while weil means 'because'.",
    explanation_vn: "'ob' có nghĩa là 'liệu rằng' (câu hỏi gián tiếp), trong khi 'weil' có nghĩa là 'bởi vì'."
  },
  {
    id: 9,
    type: "fill_in_gap",
    question: "Der Entwickler, ____ Code ich reviewed habe, ist fleißig.",
    options: ["dessen", "deren", "dem", "den"],
    correct_answer: "dessen",
    difficulty: 9,
    explanation: "The genitive relative pronoun for masculine singular is 'dessen' (whose code).",
    explanation_vn: "Đại từ quan hệ cách Genitive của giống đực số ít là 'dessen'."
  },
  {
    id: 10,
    type: "single_selection",
    question: "Er ____ gestern nach Hause gegangen.",
    options: ["ist", "hat", "wird", "war"],
    correct_answer: "ist",
    difficulty: 10,
    explanation: "Verbs of motion like gehen form their Perfect tense with sein ('ist gegangen').",
    explanation_vn: "Các động từ chỉ sự di chuyển như gehen tạo thời quá khứ Perfect với sein ('ist gegangen')."
  },
  {
    id: 11,
    type: "fill_in_gap",
    question: "Wir checken den Code ein, ____ es noch Fehler gibt.",
    options: ["obwohl", "trotz", "weil", "deshalb"],
    correct_answer: "obwohl",
    difficulty: 11,
    explanation: "obwohl introduces a concessive clause ('although there are still errors').",
    explanation_vn: "'obwohl' mở đầu mệnh đề nhượng bộ ('mặc dù vẫn còn lỗi')."
  },
  {
    id: 12,
    type: "multi_selection",
    question: "Welche Verben ändern den Vokal in der 2. und 3. Person Singular? (Wähle alle richtigen)",
    options: ["lesen", "sehen", "schreiben", "helfen", "machen"],
    correct_answer: ["lesen", "sehen", "helfen"],
    difficulty: 12,
    explanation: "lesen -> du liest, sehen -> er sieht, helfen -> du hilfst. schreiben and machen do not change vowel.",
    explanation_vn: "lesen -> du liest, sehen -> er sieht, helfen -> du hilfst. Các từ còn lại không thay đổi nguyên âm."
  },
  {
    id: 13,
    type: "fill_in_gap",
    question: "____ Sie mir bitte bei diesem Bug helfen?",
    options: ["Könnten", "Konnten", "Könntet", "Gekonnt"],
    correct_answer: "Könnten",
    difficulty: 13,
    explanation: "Polite request uses Konjunktiv II: 'Könnten Sie...' (Could you please).",
    explanation_vn: "Yêu cầu lịch sự sử dụng Konjunktiv II: 'Könnten Sie...' (Bạn có thể giúp...)."
  },
  {
    id: 14,
    type: "single_selection",
    question: "Wir müssen ____ den Code testen ____ dokumentieren.",
    options: ["sowohl / als auch", "entweder / oder", "weder / noch", "nicht nur / sondern"],
    correct_answer: "sowohl / als auch",
    difficulty: 14,
    explanation: "sowohl... als auch connects two requirements ('both test and document').",
    explanation_vn: "'sowohl... als auch' kết nối hai yêu cầu đồng thời ('cả test lẫn viết tài liệu')."
  },
  {
    id: 15,
    type: "fill_in_gap",
    question: "Ich schreibe Kommentare, ____ der Code verständlich ist.",
    options: ["damit", "um zu", "weil", "obwohl"],
    correct_answer: "damit",
    difficulty: 15,
    explanation: "damit introduces a purpose clause with subject agreement/change ('so that the code is understandable').",
    explanation_vn: "'damit' giới thiệu mệnh đề chỉ mục đích ('để cho code dễ hiểu')."
  }
];

async function run() {
  console.log("Upserting grammar practice record...");
  const today = new Date().toISOString().split("T")[0];
  const res = await fetch(`${base}/tables/GrammarPractice/records`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      records: [
        {
          require: { topic },
          fields: {
            description,
            questionsJson: JSON.stringify(questions),
            status: "pending_user",
            date: today,
            userAnswersJson: "[]",
            correctionsJson: "",
            correctionsJson_vn: ""
          }
        }
      ]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to upsert: ${res.status} ${text}`);
  }

  const data = await res.json();
  console.log("Upload successful:", JSON.stringify(data, null, 2));
}

run().catch(err => {
  console.error("Execution failed:", err);
  process.exit(1);
});
