"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getReadingPractice, upsertReadingPractice } from "@/lib/grist";
import type { ReadingPractice } from "@/lib/types";
import { MarkdownDisplay } from "@/components/ui/MarkdownDisplay";
import { WordLookupSidebar } from "@/components/ui/WordLookupSidebar";

export default function ReadingDetail({ id }: { id: number }) {
  const router = useRouter();

  const [exercise, setExercise] = useState<ReadingPractice | null>(null);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<string[]>(["", "", "", "", ""]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Word lookup states
  const [lookupWord, setLookupWord] = useState("");
  const [lookupSentence, setLookupSentence] = useState("");
  const [lookupClickedWord, setLookupClickedWord] = useState("");
  const [lookupSeparablePrefix, setLookupSeparablePrefix] = useState<string | undefined>(undefined);
  const [isLookupOpen, setIsLookupOpen] = useState(false);

  function handleWordLookup(canonical: string, sentence: string, clickedWord: string, separablePrefix?: string) {
    setLookupWord(canonical);
    setLookupSentence(sentence);
    setLookupClickedWord(clickedWord);
    setLookupSeparablePrefix(separablePrefix);
    setIsLookupOpen(true);
  }

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

      try {
        const qs = JSON.parse(ex.fields.questionsJson || "[]");
        setQuestions(qs);
      } catch {
        setQuestions([]);
      }

      try {
        const ans = JSON.parse(ex.fields.userAnswersJson || '["", "", "", "", ""]');
        setAnswers(ans);
      } catch {
        setAnswers(["", "", "", "", ""]);
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
    if (!exercise) return;

    setSubmitting(true);
    try {
      await upsertReadingPractice(exercise.fields.topic, {
        userAnswersJson: JSON.stringify(answers),
        status: "pending_evaluation",
      });
      // Reload
      await loadExerciseData();
    } catch (err) {
      console.error("Failed to submit answers:", err);
    } finally {
      setSubmitting(false);
    }
  }

  function handleAnswerChange(val: string) {
    setAnswers((prev) => {
      const next = [...prev];
      next[activeQuestionIdx] = val;
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-950 text-gray-700 dark:text-gray-200">
        <div className="animate-pulse text-lg font-medium">Loading reading module...</div>
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-950 text-gray-700 dark:text-gray-200">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold">Reading module not found.</p>
          <button
            onClick={() => router.push("/reading")}
            className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded text-xs font-bold cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const audioUrl = exercise.fields.audioFileId
    ? `https://media.publit.io/file/${exercise.fields.audioFileId}.mp3`
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
          Back to Reading Dashboard
        </button>

        {/* Header */}
        <div className="border-b border-gray-200 dark:border-slate-800 pb-4">
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 leading-snug">{exercise.fields.topic}</h1>
          <span className="text-xs text-gray-400 font-mono block mt-1">{exercise.fields.date}</span>
        </div>

        {/* Audio Player */}
        {audioUrl && (
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-xs flex flex-col gap-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Audio Narration</span>
            <audio controls src={audioUrl} className="w-full h-8" />
          </div>
        )}

        {/* German Text Passage */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-xs">
          <MarkdownDisplay content={exercise.fields.germanText} onWordLookup={handleWordLookup} />
        </div>

        {/* Paginated Questions section */}
        {questions.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                Questions & Feedback
              </h3>
              <span className="text-xs text-gray-500 dark:text-slate-400 font-mono font-bold">
                Question {activeQuestionIdx + 1} of {questions.length}
              </span>
            </div>

            <div className="space-y-4">
              {/* Current Question */}
              <div className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-snug">
                {questions[activeQuestionIdx]}
              </div>

              {/* Answering fields */}
              {exercise.fields.status === "pending_user" ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    rows={4}
                    placeholder="Schreiben Sie Ihre Antwort auf Deutsch..."
                    value={answers[activeQuestionIdx] || ""}
                    onChange={(e) => handleAnswerChange(e.target.value)}
                    className="w-full text-sm p-3 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block mb-1">Your Answer</span>
                    <div className="text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-slate-950 p-3 rounded border border-gray-200 dark:border-slate-800 italic leading-relaxed">
                      "{answers[activeQuestionIdx]}"
                    </div>
                  </div>

                  {exercise.fields.status === "pending_evaluation" && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold block italic">
                      Waiting for offline AI evaluation...
                    </span>
                  )}

                  {exercise.fields.status === "evaluated" && (() => {
                    let corrections = [];
                    try {
                      corrections = JSON.parse(exercise.fields.correctionsJson || "[]");
                    } catch {
                      corrections = [];
                    }
                    const currentCorrection = corrections[activeQuestionIdx];
                    if (!currentCorrection) return null;

                    return (
                      <div className="space-y-3 mt-2">
                        <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block mb-1">AI Correction & Feedback</span>
                        
                        <div className="p-4 bg-emerald-50/30 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-lg text-xs space-y-3">
                          {currentCorrection.correction && (
                            <div>
                              <span className="font-bold text-emerald-800 dark:text-emerald-300 block">Corrected Version</span>
                              <p className="mt-0.5 text-gray-900 dark:text-gray-100 font-semibold italic">
                                "{currentCorrection.correction}"
                              </p>
                            </div>
                          )}

                          {currentCorrection.evaluation && (
                            <div>
                              <span className="font-bold text-slate-500 dark:text-slate-400 block">Inhaltliche Bewertung</span>
                              <p className="mt-0.5 text-gray-800 dark:text-gray-200 font-medium">
                                {currentCorrection.evaluation}
                              </p>
                            </div>
                          )}

                          {currentCorrection.explanation && (
                            <div className="pt-2.5 border-t border-emerald-200/50 dark:border-emerald-900/20">
                              <span className="font-bold text-slate-500 dark:text-slate-400 block">Grammatik & Erklärung</span>
                              <p className="mt-1 text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line font-medium font-sans">
                                {currentCorrection.explanation}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t border-gray-100 dark:border-slate-800 pt-4 mt-2">
              <button
                onClick={() => setActiveQuestionIdx(prev => Math.max(0, prev - 1))}
                disabled={activeQuestionIdx === 0}
                className="px-3 py-1.5 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded disabled:opacity-30 cursor-pointer"
              >
                Previous
              </button>

              {activeQuestionIdx < questions.length - 1 ? (
                <button
                  onClick={() => setActiveQuestionIdx(prev => Math.min(questions.length - 1, prev + 1))}
                  className="px-4 py-1.5 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-xs font-semibold rounded cursor-pointer"
                >
                  Next
                </button>
              ) : exercise.fields.status === "pending_user" ? (
                <button
                  onClick={handleSubmit}
                  disabled={submitting || answers.some(a => !a.trim())}
                  className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Submitting..." : "Submit All Answers"}
                </button>
              ) : null}
            </div>
          </div>
        )}
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
