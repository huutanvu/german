"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getWritingPractice, upsertWritingPractice } from "@/lib/grist";
import type { WritingPractice } from "@/lib/types";
import { MarkdownDisplay } from "@/components/ui/MarkdownDisplay";
import { WordLookupSidebar } from "@/components/ui/WordLookupSidebar";
import { useLanguage } from "@/lib/language-context";

export default function WritingDetail({ id }: { id: number }) {
  const router = useRouter();

  const [exercise, setExercise] = useState<WritingPractice | null>(null);
  const [paragraph, setParagraph] = useState("");
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
      const ex = await getWritingPractice(id);
      if (!ex) {
        console.error("Exercise not found");
        return;
      }
      setExercise(ex);
      setParagraph(ex.fields.userParagraph || "");
    } catch (err) {
      console.error("Failed to load writing exercise details:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadExerciseData();
  }, [id]);

  async function handleSubmit() {
    if (!exercise || !paragraph.trim()) return;

    setSubmitting(true);
    try {
      await upsertWritingPractice(exercise.fields.topic, {
        userParagraph: paragraph,
        status: "pending_correction",
      });
      await loadExerciseData();
    } catch (err) {
      console.error("Failed to submit writing:", err);
    } finally {
      setSubmitting(false);
    }
  }

  const { language, t } = useLanguage();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-950 text-gray-700 dark:text-gray-200">
        <div className="animate-pulse text-lg font-medium">{t("Loading writing module...", "Đang tải bài viết...")}</div>
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-950 text-gray-700 dark:text-gray-200">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold">{t("Writing module not found.", "Không tìm thấy bài viết.")}</p>
          <button
            onClick={() => router.push("/writing")}
            className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded text-xs font-bold cursor-pointer"
          >
            {t("Back to Dashboard", "Quay lại Bảng điều khiển")}
          </button>
        </div>
      </div>
    );
  }

  // Resolve description and corrections JSON columns based on language setting
  const descriptionVal = language === "vi" && exercise.fields.description_vn ? exercise.fields.description_vn : exercise.fields.description || "Write exactly one paragraph on the topic.";

  const correctionsVal = language === "vi" && exercise.fields.correctionsJson_vn
    ? exercise.fields.correctionsJson_vn
    : exercise.fields.correctionsJson;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Link */}
        <button
          onClick={() => router.push("/writing")}
          className="flex items-center text-xs font-bold text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-gray-200 cursor-pointer gap-1 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          {t("Back to Writing Dashboard", "Quay lại Trang luyện viết")}
        </button>

        {/* Header */}
        <div className="border-b border-gray-200 dark:border-slate-800 pb-4">
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 leading-snug">{exercise.fields.topic}</h1>
          <span className="text-xs text-gray-400 font-mono block mt-1">{exercise.fields.date}</span>
        </div>

        {/* Topic Guidelines */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-xs leading-relaxed text-sm text-gray-600 dark:text-slate-300">
          <strong>{t("Instructions:", "Hướng dẫn:")}</strong> {descriptionVal}
        </div>

        {/* Input or displays depending on status */}
        {exercise.fields.status === "pending_user" ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-xs flex flex-col gap-4">
            <textarea
              rows={10}
              placeholder={t("Draft your paragraph here in German...", "Bản nháp đoạn văn của bạn ở đây bằng tiếng Đức...")}
              value={paragraph}
              onChange={(e) => setParagraph(e.target.value)}
              className="w-full text-sm p-3 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
            />
            <button
              onClick={handleSubmit}
              disabled={submitting || !paragraph.trim()}
              className="self-end px-5 py-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-xs font-bold rounded disabled:opacity-50 cursor-pointer"
            >
              {submitting ? t("Submitting...", "Đang nộp...") : t("Submit Paragraph", "Nộp đoạn văn")}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Draft Display */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
              <div>
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block mb-1">
                  {t("Your Paragraph Draft", "Đoạn văn của bạn")}
                </span>
                <div className="bg-gray-50 dark:bg-slate-950 p-4 rounded border border-gray-200 dark:border-slate-800">
                  <MarkdownDisplay content={exercise.fields.userParagraph} onWordLookup={handleWordLookup} />
                </div>
              </div>

              {exercise.fields.status === "pending_correction" && (
                <div className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs p-3 rounded border border-amber-200 dark:border-amber-900/40 font-medium italic">
                  {t(
                    "Submitted. Waiting for offline AI sentence corrections...",
                    "Đã nộp bài. Đang chờ AI sửa lỗi ngữ pháp..."
                  )}
                </div>
              )}
            </div>

            {/* Corrections display if graded */}
            {exercise.fields.status === "corrected" && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider border-b border-gray-100 dark:border-slate-800 pb-2">
                  {t("AI Corrections & Feedback", "Sửa lỗi & Nhận xét từ AI")}
                </h3>

                <div>
                  <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block mb-1">
                    {t("Suggested Final Version", "Bản sửa đổi đề xuất")}
                  </span>
                  <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded border border-emerald-200 dark:border-emerald-900/40 font-medium">
                    <MarkdownDisplay
                      content={exercise.fields.correctedParagraph}
                      tokensJson={exercise.fields.correctedTokensJson}
                      onWordLookup={handleWordLookup}
                    />
                  </div>
                </div>

                {correctionsVal && (
                  <div>
                    <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block mb-1">
                      {t("Detailed Analysis", "Phân tích chi tiết lỗi")}
                    </span>
                    <div className="bg-gray-50 dark:bg-slate-950 p-4 rounded border border-gray-100 dark:border-slate-800">
                      <MarkdownDisplay content={correctionsVal} onWordLookup={handleWordLookup} />
                    </div>
                  </div>
                )}
              </div>
            )}
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
