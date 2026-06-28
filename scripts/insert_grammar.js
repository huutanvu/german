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

const topic = "Akkusativ, Dativ und Adjektivendungen im Team";
const description = "Test your German grammar skills on genders, case declensions (Dativ/Akkusativ/Genitiv), adjective endings, relative pronouns, and word ordering in the context of team code reviews.";

const questions = [
  {
    id: 1,
    type: "yes_no",
    question: "Heißt es 'das Code'?",
    options: ["Ja", "Nein"],
    correct_answer: "Nein",
    difficulty: 1,
    explanation: "Code is masculine in German: der Code.",
    explanation_vn: "Từ Code là giống đực trong tiếng Đức: der Code."
  },
  {
    id: 2,
    type: "fill_in_gap",
    question: "Er liest ____ Code des Kollegen.",
    options: ["den", "dem", "der"],
    correct_answer: "den",
    difficulty: 2,
    explanation: "lesen takes accusative. Code is masculine, so 'der' becomes 'den'.",
    explanation_vn: "Động từ 'lesen' yêu cầu tân ngữ accusative. 'Code' là giống đực, nên 'der' đổi thành 'den'."
  },
  {
    id: 3,
    type: "fill_in_gap",
    question: "Wir arbeiten an ein____ neuen Projekt.",
    options: ["-em", "-en", "-er"],
    correct_answer: "-em",
    difficulty: 3,
    explanation: "arbeiten an (static location) takes Dativ. Projekt is neuter (das Projekt), so the ending is -em (einem neuen Projekt).",
    explanation_vn: "'arbeiten an' đi với Dativ khi chỉ vị trí tĩnh. 'Projekt' là giống trung, vì vậy đuôi là -em."
  },
  {
    id: 4,
    type: "single_selection",
    question: "Wir schicken Feedback zu den Entwickler____.",
    options: ["-n", "-s", "-e", " (keine Endung)"],
    correct_answer: "-n",
    difficulty: 4,
    explanation: "Plural nouns in Dative (after 'zu den') take an extra -n ending (Entwickler -> Entwicklern).",
    explanation_vn: "Danh từ số nhiều ở cách Dativ (sau 'zu den') nhận đuôi -n (Entwickler -> Entwicklern)."
  },
  {
    id: 5,
    type: "fill_in_gap",
    question: "Ich checke den Code in ____ Repository ein.",
    options: ["das", "dem", "der"],
    correct_answer: "das",
    difficulty: 5,
    explanation: "Checking in (einchecken in) implies movement into a place, requiring Accusative. Repository is neuter (das Repository), remaining 'das'.",
    explanation_vn: "Hành động check-in (einchecken in) có hướng chuyển động, yêu cầu Accusative. Repository là giống trung, giữ nguyên 'das'."
  },
  {
    id: 6,
    type: "fill_in_gap",
    question: "Das Tool, mit ____ wir arbeiten, ist gut.",
    options: ["dem", "das", "den", "denen"],
    correct_answer: "dem",
    difficulty: 6,
    explanation: "mit is a Dative-only preposition. Tool is neuter (das Tool), so the relative pronoun is 'dem'.",
    explanation_vn: "'mit' là giới từ luôn đi với Dativ. 'Tool' là giống trung, nên đại từ quan hệ tương ứng là 'dem'."
  },
  {
    id: 7,
    type: "single_selection",
    question: "Wir machen heute ein____ groß____ Code-Review.",
    options: ["-en / -en", "-er / -es", "-es / -en", "-em / -er"],
    correct_answer: "-en / -en",
    difficulty: 7,
    explanation: "machen takes Accusative. Code-Review is masculine (der Code-Review), leading to 'einen großen Code-Review'.",
    explanation_vn: "'machen' đi với Accusative. 'Code-Review' là giống đực, cho ra kết quả 'einen großen Code-Review'."
  },
  {
    id: 8,
    type: "yes_no",
    question: "Ist das Partizip II von 'schreiben' 'geschreibt'?",
    options: ["Ja", "Nein"],
    correct_answer: "Nein",
    difficulty: 8,
    explanation: "No, schreiben is a strong verb. Its Partizip II is 'geschrieben'.",
    explanation_vn: "Không, 'schreiben' là động từ mạnh. Phân từ II của nó là 'geschrieben'."
  },
  {
    id: 9,
    type: "fill_in_gap",
    question: "Der Autor ____ Pull-Requests muss den Code anpassen.",
    options: ["des", "dem", "den", "der"],
    correct_answer: "des",
    difficulty: 9,
    explanation: "Possession uses Genitive. Pull-Request is masculine (der Pull-Request), so the genitive article is 'des'.",
    explanation_vn: "Mối quan hệ sở hữu dùng Genitive. Pull-Request là giống đực, mạo từ tương ứng là 'des'."
  },
  {
    id: 10,
    type: "single_selection",
    question: "Ich lade den Code hoch, weil ich fertig ____.",
    options: ["bin", "habe", "werde", "zu sein"],
    correct_answer: "bin",
    difficulty: 10,
    explanation: "weil is a subordinating conjunction that sends the conjugated verb (bin) to the end of the clause.",
    explanation_vn: "'weil' là liên từ phụ gửi động từ được chia (bin) xuống cuối câu phụ."
  },
  {
    id: 11,
    type: "fill_in_gap",
    question: "Wir ____ das Meeting verschieben, wenn wir keine Zeit haben.",
    options: ["sollten", "solltenen", "solltenet", "gesollt"],
    correct_answer: "sollten",
    difficulty: 11,
    explanation: "A polite recommendation uses Konjunktiv II of sollen: 'sollten'.",
    explanation_vn: "Lời khuyên lịch sự sử dụng Konjunktiv II của sollen: 'sollten'."
  },
  {
    id: 12,
    type: "multi_selection",
    question: "Welche Präpositionen fordern IMMER den Dativ? (Wähle alle richtigen)",
    options: ["mit", "zu", "nach", "für", "durch"],
    correct_answer: ["mit", "zu", "nach"],
    difficulty: 12,
    explanation: "mit, zu, and nach are strictly Dative prepositions. für and durch require Accusative.",
    explanation_vn: "'mit', 'zu', và 'nach' luôn đi với Dativ. 'für' và 'durch' đi với Accusative."
  },
  {
    id: 13,
    type: "fill_in_gap",
    question: "Ich muss ____ diesen Befehl merken.",
    options: ["mir", "mich", "sich", "dir"],
    correct_answer: "mir",
    difficulty: 13,
    explanation: "The reflexive verb phrase is 'sich (Dativ) etwas merken'. Thus: Ich merke mir.",
    explanation_vn: "Cụm động từ phản thân là 'sich (Dativ) etwas merken'. Do đó: Ich merke mir."
  },
  {
    id: 14,
    type: "single_selection",
    question: "Die Behebung ____ Fehler ist wichtig.",
    options: ["schwerer", "schwere", "schweren", "schwerem"],
    correct_answer: "schwerer",
    difficulty: 14,
    explanation: "Genitive plural without an article takes the -er ending (schwerer Fehler).",
    explanation_vn: "Genitive số nhiều không có mạo từ đi kèm tính từ kết thúc bằng đuôi -er."
  },
  {
    id: 15,
    type: "fill_in_gap",
    question: "Der Bug ____ heute behoben. (Passiv Präsens)",
    options: ["wird", "wurde", "ist", "hat"],
    correct_answer: "wird",
    difficulty: 15,
    explanation: "Present Passive voice uses werden + Partizip II. Singular third person is 'wird'.",
    explanation_vn: "Thể bị động ở hiện tại sử dụng werden + Partizip II. Ngôi thứ ba số ít là 'wird'."
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
