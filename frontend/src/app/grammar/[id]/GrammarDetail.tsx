"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getGrammarPractice, upsertGrammarPractice } from "@/lib/grist";
import type { GrammarPractice } from "@/lib/types";
import { useLanguage } from "@/lib/language-context";

export default function GrammarDetail({ id }: { id: number }) {
  const router = useRouter();
  const { language, t } = useLanguage();

  const [exercise, setExercise] = useState<GrammarPractice | null>(null);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Parse questions dynamically
  let questions: any[] = [];
  try { questions = JSON.parse(exercise?.fields.questionsJson || "[]"); } catch {}

  async function loadExerciseData() {
    if (isNaN(id)) return;
    try {
      setLoading(true);
      const ex = await getGrammarPractice(id);
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

      await upsertGrammarPractice(exercise.fields.topic, {
        userAnswersJson: JSON.stringify(answers),
        correctionsJson: JSON.stringify(enCorrections),
        correctionsJson_vn: JSON.stringify(vnCorrections),
        status: "evaluated",
      });

      await loadExerciseData();
    } catch (err) {
      //console.error("Failed to submit answers:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRedo() {
    if (!exercise || !questions.length) return;
    try {
      const clearedAnswers = questions.map(q => q.type === "multi_selection" ? [] : "");
      await upsertGrammarPractice(exercise.fields.topic, {
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

  if (loading || !exercise) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-950 text-gray-700 dark:text-gray-200">
        <div className="animate-pulse text-lg font-medium">{t("Loading grammar drills...", "Đang tải bài tập ngữ pháp...")}</div>
      </div>
    );
  }

  const isPendingUser = exercise.fields.status === "pending_user";
  const totalCorrect = isPendingUser ? 0 : answers.reduce((acc, current, idx) => {
    const correct = questions[idx]?.correct_answer;
    if (questions[idx]?.type === "multi_selection") {
      const uArr = Array.isArray(current) ? current : [];
      const cArr = Array.isArray(correct) ? correct : [];
      return acc + (uArr.length === cArr.length && uArr.every(x => cArr.includes(x)) ? 1 : 0);
    }
    return acc + (String(current || "").trim().toLowerCase() === String(correct || "").trim().toLowerCase() ? 1 : 0);
  }, 0);

  const q = questions[activeQuestionIdx];
  const currentAnswer = answers[activeQuestionIdx];

  const renderQuestionInput = () => {
    if (isPendingUser) {
      if (q.type === "yes_no" || q.type === "single_selection" || q.type === "fill_in_gap") {
        const options = q.type === "yes_no" ? ["Ja", "Nein"] : (q.options || []);
        return (
          <div className="space-y-2 mt-4">
            {options.map((opt: string) => {
              const isSelected = currentAnswer === opt;
              return (
                <label
                  key={opt}
                  className={`flex items-center gap-3 p-3.5 rounded-lg border text-sm font-medium transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 ${
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
          <div className="space-y-2 mt-4">
            {options.map((opt: string) => {
              const isSelected = selectedList.includes(opt);
              return (
                <label
                  key={opt}
                  className={`flex items-center gap-3 p-3.5 rounded-lg border text-sm font-medium transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 ${
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
        <div className="space-y-2 mt-4">
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
                className={`flex items-center gap-3 p-3.5 rounded-lg border text-sm opacity-90 transition-all ${optStyle}`}
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
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 font-sans p-6 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Back navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-slate-800 pb-5 gap-4">
          <div className="space-y-2">
            <button
              onClick={() => router.push("/grammar")}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-500 dark:text-slate-400 dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              {t("Back to list", "Trở lại danh sách")}
            </button>
            <h1 className="text-xl font-black text-gray-900 dark:text-gray-100">{exercise.fields.topic}</h1>
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed font-sans">{language === "vi" ? exercise.fields.description_vn : exercise.fields.description}</p>
              {exercise.fields.level && (
                <span className="shrink-0 px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  {exercise.fields.level}
                </span>
              )}
            </div>
          </div>

          {!isPendingUser && (
            <div className="flex items-center gap-2 bg-emerald-100/50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-lg px-4 py-2 text-sm font-extrabold text-emerald-800 dark:text-emerald-300 self-start sm:self-center">
              <span>{t("Result", "Kết quả")}:</span>
              <span>{totalCorrect} / {questions.length}</span>
            </div>
          )}
        </div>

        {/* Dynamic Card Container */}
        {questions.length > 0 && (() => {
          const isCorrect = !isPendingUser && (() => {
            const correct = q.correct_answer;
            if (q.type === "multi_selection") {
              const uArr = Array.isArray(currentAnswer) ? currentAnswer : [];
              const cArr = Array.isArray(correct) ? correct : [];
              return uArr.length === cArr.length && uArr.every(x => cArr.includes(x));
            }
            return String(currentAnswer || "").trim().toLowerCase() === String(correct || "").trim().toLowerCase();
          })();

          const explanation = language === "vi" && q.explanation_vn
            ? q.explanation_vn
            : (q.explanation || "");

          return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
              
              {/* Paginated Question Card */}
              <div className="md:col-span-3 space-y-6">
                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800/60 mb-4">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest font-mono">
                      {t(`Drill ${activeQuestionIdx + 1} of ${questions.length}`, `Câu ${activeQuestionIdx + 1} / ${questions.length}`)}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 font-mono">
                      {t("Difficulty", "Độ khó")}: {q.difficulty}
                    </span>
                  </div>

                  <p className="text-base font-extrabold text-gray-900 dark:text-gray-100 leading-relaxed font-sans mb-3">
                    {language === "vi" ? q.question_vn : q.question}
                  </p>

                  {renderQuestionInput()}

                  {/* Grammar Explanation Box */}
                  {!isPendingUser && (
                    <div className={`mt-6 p-4 rounded-xl border leading-relaxed text-xs transition-all ${
                      isCorrect
                        ? "bg-emerald-50/20 border-emerald-500/30 text-emerald-950 dark:text-emerald-200"
                        : "bg-red-50/10 border-red-500/30 text-red-950 dark:text-red-200"
                    }`}>
                      <div className="flex items-center gap-1.5 font-bold mb-2 text-sm">
                        {isCorrect ? (
                          <span className="text-emerald-600">✓ {t("Correct Answer!", "Trả lời chính xác!")}</span>
                        ) : (
                          <span className="text-red-600">✗ {t("Incorrect Answer.", "Chưa chính xác.")}</span>
                        )}
                      </div>
                      <p className="mt-1 font-sans">{explanation}</p>
                    </div>
                  )}
                </div>

                {/* Submissions Section */}
                <div className="flex items-center justify-between pt-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setActiveQuestionIdx(prev => Math.max(0, prev - 1))}
                      disabled={activeQuestionIdx === 0}
                      className="px-4 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-xs font-bold text-gray-600 dark:text-slate-300 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                    >
                      {t("Previous", "Quay lại")}
                    </button>
                    <button
                      onClick={() => setActiveQuestionIdx(prev => Math.min(questions.length - 1, prev + 1))}
                      disabled={activeQuestionIdx === questions.length - 1}
                      className="px-4 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-xs font-bold text-gray-600 dark:text-slate-300 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                    >
                      {t("Next", "Kế tiếp")}
                    </button>
                  </div>

                  {isPendingUser ? (
                    <button
                      onClick={handleSubmit}
                      disabled={submitting || answers.some(a => {
                        if (Array.isArray(a)) return a.length === 0;
                        return !String(a || "").trim();
                      })}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                    >
                      {submitting ? t("Submitting...", "Đang chấm...") : t("Submit All Answers", "Nộp tất cả bài làm")}
                    </button>
                  ) : (
                    <button
                      onClick={handleRedo}
                      className="px-6 py-2.5 bg-gray-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
                    >
                      {t("Redo / Try Again", "Làm lại bài")}
                    </button>
                  )}
                </div>
              </div>

              {/* Navigation Grid Sidebar */}
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest">
                  {t("Navigation", "Danh sách câu")}
                </h3>
                <div className="grid grid-cols-5 gap-3">
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
                          return uArr.length === cArr.length && uArr.every(x => cArr.includes(x));
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
    </div>
  );
}
