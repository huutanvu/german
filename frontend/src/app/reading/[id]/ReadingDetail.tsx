"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getReadingPractice, upsertReadingPractice } from "@/lib/grist";
import type { ReadingPractice } from "@/lib/types";
import { MarkdownDisplay } from "@/components/ui/MarkdownDisplay";
import { WordLookupSidebar } from "@/components/ui/WordLookupSidebar";
import { UploadAudioButton } from "@/components/ui/UploadAudioButton";
import { useLanguage } from "@/lib/language-context";

export default function ReadingDetail({ id }: { id: number }) {
  const router = useRouter();
  const { language, t } = useLanguage();

  const [exercise, setExercise] = useState<ReadingPractice | null>(null);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Word lookup states
  const [lookupWord, setLookupWord] = useState("");
  const [lookupSentence, setLookupSentence] = useState("");
  const [lookupClickedWord, setLookupClickedWord] = useState("");
  const [lookupSeparablePrefix, setLookupSeparablePrefix] = useState<string | undefined>(undefined);
  const [isLookupOpen, setIsLookupOpen] = useState(false);

  useEffect(() => {
    async function checkUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setIsAdmin(data.userId === 'd68f7a67-42fb-43b2-a1c7-1108eb99150a');
        }
      } catch (err) {
        console.error("Failed to check user role:", err);
      }
    }
    checkUser();
  }, []);

  function handleWordLookup(canonical: string, sentence: string, clickedWord: string, separablePrefix?: string) {
    setLookupWord(canonical);
    setLookupSentence(sentence);
    setLookupClickedWord(clickedWord);
    setLookupSeparablePrefix(separablePrefix);
    setIsLookupOpen(true);
  }

  // Parse questions dynamically
  let questions: any[] = [];
  try { questions = JSON.parse(exercise?.fields.questionsJson || "[]"); } catch {}

  async function loadExerciseData() {
    if (isNaN(id)) return;
    try {
      setLoading(true);
      const ex = await getReadingPractice(id);
      if (!ex) {
        console.error("Exercise not found");
        return;
      }
      setExercise(ex);

      let qList: any[] = [];
      try { qList = JSON.parse(ex.fields.questionsJson || "[]"); } catch {}

      try {
        const ans = JSON.parse(ex.fields.userAnswersJson || "[]");
        if (Array.isArray(ans) && ans.length === qList.length) {
          setAnswers(ans);
        } else {
          setAnswers(qList.map(q => q.type === "multi_selection" ? [] : ""));
        }
      } catch {
        setAnswers(qList.map(q => q.type === "multi_selection" ? [] : ""));
      }
    } catch (err) {
      console.error("Failed to load exercise details:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadExerciseData();
  }, [id]);

  async function handleSubmit() {
    if (!exercise || !questions.length) return;

    setSubmitting(true);
    try {
      // Offline direct grading
      const enCorrections: any[] = [];
      const vnCorrections: any[] = [];

      questions.forEach((q: any, idx: number) => {
        const uAns = answers[idx];
        const cAns = q.correct_answer;
        
        let isCorrect = false;
        if (q.type === "multi_selection") {
          const uArr = Array.isArray(uAns) ? uAns : [];
          const cArr = Array.isArray(cAns) ? cAns : [];
          isCorrect = uArr.length === cArr.length && uArr.every(x => cArr.includes(x));
        } else {
          const uStr = String(uAns || "").trim().toLowerCase();
          const cStr = String(cAns || "").trim().toLowerCase();
          isCorrect = uStr === cStr;
        }

        const questionText = q.question;
        const correctStr = Array.isArray(cAns) ? cAns.join(", ") : String(cAns);
        const userStr = Array.isArray(uAns) ? uAns.join(", ") : String(uAns);

        enCorrections.push({
          question: questionText,
          userAnswer: userStr,
          evaluation: isCorrect ? "Correct! Well done." : "Incorrect.",
          correction: isCorrect ? "" : `Correct answer: ${correctStr}`,
          explanation: q.explanation || "No explanation provided."
        });

        vnCorrections.push({
          question: questionText,
          userAnswer: userStr,
          evaluation: isCorrect ? "Chính xác! Làm tốt lắm." : "Chưa chính xác.",
          correction: isCorrect ? "" : `Đáp án đúng là: ${correctStr}`,
          explanation: q.explanation_vn || q.explanation || "Không có giải thích."
        });
      });

      await upsertReadingPractice(exercise.fields.topic, {
        userAnswersJson: JSON.stringify(answers),
        correctionsJson: JSON.stringify(enCorrections),
        correctionsJson_vn: JSON.stringify(vnCorrections),
        status: "evaluated",
      });

      await loadExerciseData();
    } catch (err) {
      console.error("Failed to submit answers:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRedo() {
    if (!exercise || !questions.length) return;
    try {
      const clearedAnswers = questions.map(q => q.type === "multi_selection" ? [] : "");
      await upsertReadingPractice(exercise.fields.topic, {
        userAnswersJson: JSON.stringify(clearedAnswers),
        correctionsJson: "[]",
        correctionsJson_vn: "[]",
        status: "pending_user",
      });
      await loadExerciseData();
      setActiveQuestionIdx(0);
    } catch (err) {
      console.error("Failed to redo exercise:", err);
    }
  }

  function handleAnswerChange(val: any) {
    setAnswers((prev) => {
      const next = [...prev];
      next[activeQuestionIdx] = val;
      return next;
    });
  }

  let englishCorrections: any[] = [];
  let vietnameseCorrections: any[] = [];
  try { englishCorrections = JSON.parse(exercise?.fields.correctionsJson || "[]"); } catch {}
  try { vietnameseCorrections = JSON.parse(exercise?.fields.correctionsJson_vn || "[]"); } catch {}
  const corrections = language === "vi" && vietnameseCorrections.length > 0 ? vietnameseCorrections : englishCorrections;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-950 text-gray-700 dark:text-gray-200">
        <div className="animate-pulse text-lg font-medium">{t("Loading reading module...", "Đang tải bài đọc...")}</div>
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-950 text-gray-700 dark:text-gray-200">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold">{t("Reading module not found.", "Không tìm thấy bài đọc.")}</p>
          <button
            onClick={() => router.push("/reading")}
            className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded text-xs font-bold cursor-pointer"
          >
            {t("Back to Dashboard", "Quay lại Bảng điều khiển")}
          </button>
        </div>
      </div>
    );
  }

  const audioUrl = exercise.fields.audioFileId
    ? `https://media.publit.io/file/german/${exercise.fields.audioFileId}.mp3`
    : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Link */}
        <button
          onClick={() => router.push("/reading")}
          className="flex items-center text-xs font-bold text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-gray-200 cursor-pointer gap-1 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          {t("Back to Reading Dashboard", "Quay lại Trang đọc hiểu")}
        </button>

        {/* Header */}
        <div className="border-b border-gray-200 dark:border-slate-800 pb-4">
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 leading-snug">{exercise.fields.topic}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-400 font-mono">{exercise.fields.date}</span>
            {exercise.fields.level && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                {exercise.fields.level}
              </span>
            )}
          </div>
        </div>

        {/* Audio Player / Upload Voice Over */}
        {audioUrl ? (
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-xs flex flex-col gap-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">{t("Audio Narration", "Nghe bài đọc")}</span>
            <audio controls src={audioUrl} className="w-full h-8" />
          </div>
        ) : (
          isAdmin && (
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-xs flex flex-col gap-2">
              <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">{t("Upload Audio Narration (Admin)", "Tải lên tệp âm thanh (Admin)")}</span>
              <UploadAudioButton type="reading" id={id} onUploadSuccess={loadExerciseData} />
            </div>
          )
        )}

        {/* German Text Passage */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-xs">
          <MarkdownDisplay
            content={exercise.fields.germanText}
            tokensJson={exercise.fields.tokensJson || ""}
            onWordLookup={handleWordLookup}
            isLookupOpen={isLookupOpen}
          />
        </div>

        {/* Paginated Questions section */}
        {questions.length > 0 && (() => {
          const q = questions[activeQuestionIdx];
          const currentAnswer = answers[activeQuestionIdx];
          const isPendingUser = exercise.fields.status === "pending_user";

          const renderQuestionInput = () => {
            if (isPendingUser) {
              if (q.type === "yes_no" || q.type === "single_selection" || q.type === "fill_in_gap") {
                const options = q.type === "yes_no" ? ["Ja", "Nein"] : (q.options || []);
                return (
                  <div className="space-y-2 mt-3">
                    {options.map((opt: string) => {
                      const isSelected = currentAnswer === opt;
                      return (
                        <label
                          key={opt}
                          className={`flex items-center gap-3 p-3 rounded-lg border text-sm font-medium transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 ${
                            isSelected
                              ? "border-blue-500 bg-blue-50/30 dark:bg-blue-950/20 text-blue-950 dark:text-blue-200"
                              : "border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            value={opt}
                            checked={isSelected}
                            onChange={() => handleAnswerChange(opt)}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                );
              }

              if (q.type === "multi_selection") {
                const options = q.options || [];
                const selectedList = Array.isArray(currentAnswer) ? currentAnswer : [];
                return (
                  <div className="space-y-2 mt-3">
                    {options.map((opt: string) => {
                      const isSelected = selectedList.includes(opt);
                      return (
                        <label
                          key={opt}
                          className={`flex items-center gap-3 p-3 rounded-lg border text-sm font-medium transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 ${
                            isSelected
                              ? "border-blue-500 bg-blue-50/30 dark:bg-blue-950/20 text-blue-950 dark:text-blue-200"
                              : "border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            value={opt}
                            checked={isSelected}
                            onChange={() => {
                              let newList = [...selectedList];
                              if (newList.includes(opt)) {
                                newList = newList.filter(x => x !== opt);
                              } else {
                                newList.push(opt);
                              }
                              handleAnswerChange(newList);
                            }}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                );
              }
            } else {
              const selectedList = Array.isArray(currentAnswer) ? currentAnswer : (currentAnswer ? [currentAnswer] : []);
              const correctList = Array.isArray(q.correct_answer) ? q.correct_answer : (q.correct_answer ? [q.correct_answer] : []);
              const options = q.type === "yes_no" ? ["Ja", "Nein"] : (q.options || []);

              return (
                <div className="space-y-2 mt-3">
                  {options.map((opt: string) => {
                    const isSelected = selectedList.includes(opt);
                    const isCorrectOpt = correctList.includes(opt);
                    
                    let optStyle = "border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300";
                    if (isSelected) {
                      optStyle = isCorrectOpt
                        ? "border-emerald-500 bg-emerald-50/20 text-emerald-800 dark:text-emerald-300 font-semibold"
                        : "border-red-500 bg-red-50/10 text-red-800 dark:text-red-300 font-semibold";
                    } else if (isCorrectOpt) {
                      optStyle = "border-emerald-500 bg-emerald-50/5 text-emerald-700 dark:text-emerald-400 font-medium";
                    }

                    return (
                      <div
                        key={opt}
                        className={`flex items-center gap-3 p-3 rounded-lg border text-sm opacity-90 transition-all ${optStyle}`}
                      >
                        <input
                          type={q.type === "multi_selection" ? "checkbox" : "radio"}
                          checked={isSelected}
                          disabled
                          className="w-4 h-4 text-blue-600 border-gray-300"
                        />
                        <span>{opt}</span>
                        {isCorrectOpt && <span className="ml-auto text-emerald-600 text-xs font-bold font-mono">✓ {t("Correct", "Đúng")}</span>}
                        {isSelected && !isCorrectOpt && <span className="ml-auto text-red-600 text-xs font-bold font-mono">✗ {t("Your Choice", "Bạn chọn")}</span>}
                      </div>
                    );
                  })}
                </div>
              );
            }
            return null;
          };

          return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">

              {/* Main Question Card */}
              <div className="md:col-span-3 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                      {t("Questions & Feedback", "Câu hỏi & Nhận xét")}
                    </h3>
                    {q.difficulty && (
                      <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 text-[10px] font-bold rounded">
                        Level {q.difficulty}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-slate-400 font-mono font-bold">
                    {t("Question", "Câu")} {activeQuestionIdx + 1} {t("of", "trên")} {questions.length}
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Question Type Tag */}
                  <div className="flex">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                      {q.type === "yes_no" && t("Yes / No", "Đúng / Sai")}
                      {q.type === "single_selection" && t("Single Choice", "Chọn một đáp án")}
                      {q.type === "multi_selection" && t("Multiple Choice", "Chọn nhiều đáp án")}
                      {q.type === "fill_in_gap" && t("Fill in the Blank", "Điền vào chỗ trống")}
                    </span>
                  </div>

                  {/* Current Question Text */}
                  <div className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-snug">
                    {q.question}
                  </div>

                  {/* Answering Choice/Inputs */}
                  {renderQuestionInput()}

                  {/* AI Correction/Explanation Panel (if evaluated) */}
                  {exercise.fields.status === "evaluated" && (() => {
                    const currentCorrection = corrections[activeQuestionIdx];
                    if (!currentCorrection) return null;

                    return (
                      <div className="space-y-2 mt-4 pt-3 border-t border-gray-100 dark:border-slate-800">
                        <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block">{t("AI Explanation", "Giải thích chi tiết")}</span>
                        <div className="p-4 bg-emerald-50/20 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/20 rounded-lg text-xs">
                          <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                            {currentCorrection.explanation}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Pagination and Submission Controls */}
                <div className="flex items-center justify-between border-t border-gray-100 dark:border-slate-800 pt-4 mt-2">
                  <button
                    onClick={() => setActiveQuestionIdx(prev => Math.max(0, prev - 1))}
                    disabled={activeQuestionIdx === 0}
                    className="px-3 py-1.5 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded disabled:opacity-30 cursor-pointer"
                  >
                    {t("Previous", "Trước")}
                  </button>

                  <div className="flex gap-2">
                    {exercise.fields.status === "evaluated" && (
                      <button
                        onClick={handleRedo}
                        className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded cursor-pointer transition-colors"
                      >
                        {t("Redo / Try Again", "Làm lại / Thử lại")}
                      </button>
                    )}

                    {activeQuestionIdx < questions.length - 1 ? (
                      <button
                        onClick={() => setActiveQuestionIdx(prev => Math.min(questions.length - 1, prev + 1))}
                        className="px-4 py-1.5 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-xs font-semibold rounded cursor-pointer"
                      >
                        {t("Next", "Sau")}
                      </button>
                    ) : exercise.fields.status === "pending_user" ? (
                      <button
                        onClick={handleSubmit}
                        disabled={submitting || answers.some(a => {
                          if (Array.isArray(a)) return a.length === 0;
                          return !String(a || "").trim();
                        })}
                        className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded disabled:opacity-50 cursor-pointer"
                      >
                        {submitting ? t("Submitting...", "Đang nộp...") : t("Submit All Answers", "Nộp toàn bộ câu trả lời")}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Navigation Sidebar */}
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest">
                  {t("Navigation", "Danh sách câu")}
                </h3>
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((item: any, idx: number) => {
                    const ans = answers[idx];
                    const hasAnswer = Array.isArray(ans) ? ans.length > 0 : String(ans || "").trim() !== "";
                    const isActive = idx === activeQuestionIdx;

                    let btnStyle = "border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800";
                    if (isActive) {
                      btnStyle = "border-blue-600 bg-blue-600 text-white shadow-sm";
                    } else if (!isPendingUser) {
                      const correct = item.correct_answer;
                      const correctCheck = (() => {
                        if (item.type === "multi_selection") {
                          const uArr = Array.isArray(ans) ? ans : [];
                          const cArr = Array.isArray(correct) ? correct : [];
                          return uArr.length === cArr.length && uArr.every((x: string) => cArr.includes(x));
                        }
                        return String(ans || "").trim().toLowerCase() === String(correct || "").trim().toLowerCase();
                      })();
                      btnStyle = correctCheck
                        ? "border-emerald-500 bg-emerald-50/20 text-emerald-800 dark:text-emerald-300"
                        : "border-red-500 bg-red-50/10 text-red-800 dark:text-red-300";
                    } else if (hasAnswer) {
                      btnStyle = "border-blue-200 bg-blue-50/30 text-blue-900 dark:border-blue-900/50 dark:text-blue-300";
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => setActiveQuestionIdx(idx)}
                        className={`w-9 h-9 flex items-center justify-center rounded-lg border text-xs font-bold font-mono transition-all cursor-pointer ${btnStyle}`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          );
        })()}
      </div>

      <WordLookupSidebar
        isOpen={isLookupOpen}
        word={lookupWord}
        sentence={lookupSentence}
        clickedWord={lookupClickedWord}
        separablePrefix={lookupSeparablePrefix}
        onClose={() => setIsLookupOpen(false)}
      />
    </div>
  );
}
