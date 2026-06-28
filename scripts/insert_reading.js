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

const topic = "Vorteile von Code-Reviews im Team";
const germanText = `In der modernen Softwareentwicklung sind **Code-Reviews** ein wesentlicher Bestandteil der täglichen Arbeit im Team. Bei diesem Prozess liest und überprüft ein Entwickler den Quellcode eines anderen Teammitglieds, bevor dieser in den Hauptzweig integriert wird. Das Hauptziel besteht darin, Programmierfehler frühzeitig zu finden und die allgemeine Softwarequalität zu verbessern.

Ein großer Vorteil dieses Verfahrens ist der kontinuierliche **Wissenstransfer**. Durch das gemeinsame Anschauen des Programmcodes lernen Entwickler ständig voneinander. Jüngere Kollegen können von erfahrenen Programmierern wertvolle Tipps zu Entwurfsmustern und Best Practices erhalten, während Senior-Entwickler neue Lösungsansätze kennenlernen. Dies führt langfristig zu einer besseren **Codekonsistenz**, da sich das gesamte Team auf gemeinsame Standards und Formatierungen einigt.

Zudem helfen Code-Reviews dabei, schwerwiegende Logikfehler oder Sicherheitslücken rechtzeitig zu entdecken, noch bevor die Anwendung auf den Produktionsservern läuft. Wenn man einen Fehler erst beim Endkunden bemerkt, ist die Behebung meistens deutlich teurer und zeitaufwendiger. Darüber hinaus fördert das Review-System die **Kollaboration** und das Gefühl des gemeinsamen Eigentums am Quellcode. Niemand arbeitet isoliert an seinem eigenen Modul; das gesamte Entwicklerteam trägt die Verantwortung für die Stabilität des Produkts.

Um diesen Prozess im Arbeitsalltag effizient zu gestalten, sollten die einzelnen **Pull-Requests** möglichst klein gehalten werden. Kleinere Änderungen lassen sich wesentlich schneller, konzentrierter und gründlicher überprüfen als riesige Codeänderungen. Schließlich sollte das Feedback immer konstruktiv, sachlich und höflich formuliert sein, damit das Arbeitsklima im Team positiv bleibt. Code-Reviews sind keine persönliche Kritik, sondern eine hervorragende Gelegenheit, gemeinsam zu lernen und stetig zu wachsen.`;

const questions = [
  {
    id: 1,
    type: "yes_no",
    question: "Werden Code-Reviews durchgeführt, nachdem der Code in den Hauptzweig integriert wurde?",
    options: ["Ja", "Nein"],
    correct_answer: "Nein",
    difficulty: 1,
    explanation: "Code-reviews are done before the code is integrated into the main branch ('bevor dieser... integriert wird').",
    explanation_vn: "Code-review được thực hiện trước khi mã nguồn được tích hợp vào nhánh chính ('bevor...')."
  },
  {
    id: 2,
    type: "single_selection",
    question: "Was ist das Hauptziel von Code-Reviews?",
    options: [
      "Code schneller zu schreiben",
      "Programmierfehler zu finden und die Softwarequalität zu verbessern",
      "Die Arbeitszeit der Entwickler zu kontrollieren",
      "Mehr Programmcode zu produzieren"
    ],
    correct_answer: "Programmierfehler zu finden und die Softwarequalität zu verbessern",
    difficulty: 2,
    explanation: "The text states the main goal is to find programming errors early and improve software quality.",
    explanation_vn: "Mục tiêu chính là phát hiện lỗi lập trình sớm và cải thiện chất lượng phần mềm."
  },
  {
    id: 3,
    type: "yes_no",
    question: "Fördert das Review-System das Gefühl des gemeinsamen Eigentums am Quellcode?",
    options: ["Ja", "Nein"],
    correct_answer: "Ja",
    difficulty: 3,
    explanation: "Yes, it encourages collaborative ownership of the code ('gemeinsames Eigentum am Quellcode').",
    explanation_vn: "Có, hệ thống review thúc đẩy cảm giác sở hữu chung đối với mã nguồn."
  },
  {
    id: 4,
    type: "single_selection",
    question: "Wie sollten Pull-Requests idealerweise sein, um den Review-Prozess effizient zu machen?",
    options: [
      "Möglichst groß",
      "Möglichst klein",
      "Nur am Wochenende erstellt",
      "Ohne Kommentare"
    ],
    correct_answer: "Möglichst klein",
    difficulty: 4,
    explanation: "The text recommends keeping pull requests as small as possible ('möglichst klein') so they can be reviewed faster and more thoroughly.",
    explanation_vn: "Nên giữ các pull request nhỏ nhất có thể ('möglichst klein') để việc review nhanh hơn và kỹ lưỡng hơn."
  },
  {
    id: 5,
    type: "multi_selection",
    question: "Welche Vorteile von Code-Reviews werden im Text genannt? (Wähle alle richtigen Antworten)",
    options: [
      "Kontinuierlicher Wissenstransfer",
      "Erhöhte Codekonsistenz",
      "Automatische Code-Generierung",
      "Bessere Team-Kollaboration"
    ],
    correct_answer: ["Kontinuierlicher Wissenstransfer", "Erhöhte Codekonsistenz", "Bessere Team-Kollaboration"],
    difficulty: 5,
    explanation: "The text mentions knowledge transfer, code consistency, and collaboration. It does not mention automatic code generation.",
    explanation_vn: "Đề cập đến truyền đạt kiến thức, tính nhất quán của mã nguồn và sự hợp tác nhóm. Không đề cập đến tự động tạo mã."
  },
  {
    id: 6,
    type: "fill_in_gap",
    question: "Je früher man Fehler entdeckt, desto ____ ist die Behebung im Vergleich zum Produktionsserver.",
    options: ["günstiger", "teurer", "unwichtiger"],
    correct_answer: "günstiger",
    difficulty: 6,
    explanation: "Finding errors early makes fixing them cheaper ('günstiger') because fixing them in production is much more expensive ('deutlich teurer').",
    explanation_vn: "Phát hiện lỗi sớm giúp việc khắc phục rẻ hơn ('günstiger') vì sửa lỗi trên production đắt hơn nhiều."
  },
  {
    id: 7,
    type: "single_selection",
    question: "Was bedeutet 'gemeinsames Eigentum am Quellcode' im Kontext des Textes?",
    options: [
      "Niemand darf den Code ändern",
      "Jeder Entwickler besitzt einen Teil des Servers",
      "Das gesamte Team trägt die Verantwortung für das Produkt",
      "Der Code gehört nur dem Senior-Entwickler"
    ],
    correct_answer: "Das gesamte Team trägt die Verantwortung für das Produkt",
    difficulty: 7,
    explanation: "Joint ownership means that no one works in isolation; the entire team carries the responsibility for the product quality.",
    explanation_vn: "Sở hữu chung có nghĩa là không ai làm việc cô lập; toàn bộ nhóm chịu trách nhiệm về sản phẩm."
  },
  {
    id: 8,
    type: "fill_in_gap",
    question: "Code-Reviews sind keine persönliche ____, sondern eine Gelegenheit zu lernen.",
    options: ["Kritik", "Auszeichnung", "Unterstützung"],
    correct_answer: "Kritik",
    difficulty: 8,
    explanation: "The text concludes that code reviews are not personal criticism ('keine persönliche Kritik'), but a chance to learn and grow.",
    explanation_vn: "Code review không phải là sự chỉ trích cá nhân ('keine persönliche Kritik') mà là cơ hội học hỏi."
  },
  {
    id: 9,
    type: "multi_selection",
    question: "Welche Verhaltensweisen unterstützen ein positives Arbeitsklima bei Code-Reviews? (Wähle alle richtigen Antworten)",
    options: [
      "Das Feedback konstruktiv und sachlich formulieren",
      "Fehler ignorieren, um Konflikte zu vermeiden",
      "Höflich bleiben",
      "Pull-Requests so groß wie möglich machen"
    ],
    correct_answer: ["Das Feedback konstruktiv und sachlich formulieren", "Höflich bleiben"],
    difficulty: 9,
    explanation: "Constructive, objective, and polite feedback supports a positive working environment, while ignoring errors or making huge PRs does not.",
    explanation_vn: "Phản hồi mang tính xây dựng, khách quan và lịch sự hỗ trợ môi trường làm việc tích cực."
  },
  {
    id: 10,
    type: "fill_in_gap",
    question: "Jüngere Entwickler erhalten Tipps zu Entwurfsmustern, während Senior-Entwickler neue ____ kennenlernen.",
    options: ["Lösungsansätze", "Programmiersprachen", "Kollegen"],
    correct_answer: "Lösungsansätze",
    difficulty: 10,
    explanation: "The text mentions senior developers learn new solution approaches ('neue Lösungsansätze') during the review process.",
    explanation_vn: "Các nhà phát triển cấp cao học hỏi được các cách tiếp cận giải pháp mới ('neue Lösungsansätze')."
  }
];

async function run() {
  console.log("Upserting reading practice record...");
  const today = new Date().toISOString().split("T")[0];
  const res = await fetch(`${base}/tables/ReadingPractice/records`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      records: [
        {
          require: { topic },
          fields: {
            germanText,
            questionsJson: JSON.stringify(questions),
            status: "pending_user",
            date: today,
            audioFileId: "",
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
