"use client";

import { useEffect, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { getLearningContext, listVocabulary, listReviews, upsertReview, listVocabularyByIds } from "@/lib/grist";
import { useLanguage } from "@/lib/language-context";
import type { Vocabulary, VocabularyReview } from "@/lib/types";

export default function VocabularyPage() {
  const { language, t } = useLanguage();
  const [context, setContext] = useState<any>(null);
  const [words, setWords] = useState<Vocabulary[]>([]);
  const [reviews, setReviews] = useState<VocabularyReview[]>([]);
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);

  function playAudio(audioFileId: string) {
    const audio = new Audio(`https://media.publit.io/file/german/${audioFileId}.mp3`);
    audio.play().catch(err => console.error("Failed to play pronunciation audio:", err));
  }

  async function loadVocabData() {
    try {
      const ctx = await getLearningContext();
      setContext(ctx);

      const reviewsRes = await listReviews();
      setReviews(reviewsRes.records);

      const pendingReviews = reviewsRes.records.filter(r => r.fields.status === 'pending_correction');
      const pendingVocabIds = pendingReviews.map(r => Array.isArray(r.fields.vocabId) ? r.fields.vocabId[1] : r.fields.vocabId).filter(Boolean) as number[];

      const vocabRes = await listVocabularyByIds(pendingVocabIds);

      // Filter words level <= target level
      const targetLvl = ctx?.fields.targetLevel || "B1";
      const lvlWeights: Record<string, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
      const targetWeight = lvlWeights[targetLvl] || 3;

      const reviewable = vocabRes.records.filter((r) => {
        const wordLvlWeight = lvlWeights[r.fields.level] || 1;
        return wordLvlWeight <= targetWeight;
      });

      setWords(reviewable.slice(0, 10));
    } catch (err) {
      console.error("Failed to load vocabulary data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVocabData();
  }, []);

  async function handleSubmit(vocabId: number) {
    const text = inputs[vocabId]?.trim();
    if (!text) return;

    setSubmitting((prev) => ({ ...prev, [vocabId]: true }));
    try {
      await upsertReview(vocabId, text, "pending_correction");
      // Refresh list
      await loadVocabData();
      // Clear input
      setInputs((prev) => ({ ...prev, [vocabId]: "" }));
    } catch (err) {
      console.error("Failed to submit review:", err);
    } finally {
      setSubmitting((prev) => ({ ...prev, [vocabId]: false }));
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-950 text-gray-700 dark:text-gray-200">
        <div className="animate-pulse text-lg font-medium">{t("Loading vocabulary lists...", "Đang tải danh sách từ vựng...")}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 dark:bg-slate-950 min-h-screen">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-sans">
          {t("Vocabulary Review", "Ôn tập từ vựng")}
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          {t(
            "Review up to 10 vocabulary words matching your level. Write a German sentence for each.",
            "Ôn tập tối đa 10 từ vựng phù hợp với trình độ của bạn. Viết một câu tiếng Đức tương ứng với mỗi từ."
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active review forms */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t("Review Queue", "Hàng đợi ôn tập")}
          </h2>
          {words.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-gray-200 dark:border-slate-800 text-center shadow-sm">
              <p className="text-gray-500 dark:text-slate-400">
                {t("All clear! No words currently pending review.", "Tất cả đã hoàn thành! Không có từ nào đang chờ ôn tập.")}
              </p>
            </div>
          ) : (
            words.map((word) => {
              const pendingReview = reviews.find(
                (r) => {
                  const rVocabId = Array.isArray(r.fields.vocabId) ? r.fields.vocabId[1] : r.fields.vocabId;
                  return rVocabId === word.id && r.fields.status === "pending_correction";
                }
              );

              // Resolve translated fields
              const meaningVal = language === "vi" && word.fields.meanings_vn
                ? word.fields.meanings_vn
                : word.fields.meanings;

              const grammarVal = language === "vi" && word.fields.grammar_vn
                ? word.fields.grammar_vn
                : word.fields.grammar;

              const dailyUseVal = language === "vi" && word.fields.dailyUse_vn
                ? word.fields.dailyUse_vn
                : word.fields.dailyUse;

              const professionalUseVal = language === "vi" && word.fields.professionalUse_vn
                ? word.fields.professionalUse_vn
                : word.fields.professionalUse;

              const tipsVal = language === "vi" && word.fields.tips_vn
                ? word.fields.tips_vn
                : word.fields.tips;

              const cautionVal = language === "vi" && word.fields.caution_vn
                ? word.fields.caution_vn
                : word.fields.caution;

              const contextVal = word.fields.context;

              return (
                <div key={word.id} className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{word.fields.word}</h3>
                      {word.fields.audioFileId && (
                        <button
                          onClick={() => playAudio(word.fields.audioFileId!)}
                          className="p-1 text-gray-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title={t("Listen", "Nghe")}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <Popover.Root>
                      <Popover.Trigger asChild>
                        <button
                          className="p-1.5 text-gray-400 hover:text-amber-500 dark:text-slate-500 dark:hover:text-amber-400 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title={t("Show Definition", "Xem định nghĩa")}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </button>
                      </Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Content
                          side="bottom"
                          align="end"
                          sideOffset={6}
                          className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-xl p-4 z-50 flex flex-col gap-3 max-w-[320px] font-sans text-xs outline-none text-gray-900 dark:text-gray-100"
                        >
                          <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 text-[10px] font-bold rounded">
                              {word.fields.level}
                            </span>
                            {word.fields.partOfSpeech && (
                              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded uppercase tracking-wider">
                                {word.fields.partOfSpeech}
                              </span>
                            )}
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[10px] font-bold rounded">
                              {grammarVal}
                            </span>
                          </div>

                          <p className="text-sm font-medium italic text-gray-800 dark:text-gray-200">
                            {t("Meaning", "Ý nghĩa")}: {meaningVal}
                          </p>

                          <div className="text-[11px] text-gray-500 dark:text-slate-400 space-y-1.5 bg-gray-50 dark:bg-slate-950 p-3 rounded border border-gray-100 dark:border-slate-800">
                            <div><strong>{t("Daily Use", "Sử dụng hàng ngày")}</strong>: {dailyUseVal}</div>
                            <div><strong>{t("Professional Use", "Sử dụng công việc")}</strong>: {professionalUseVal}</div>
                            {tipsVal && <div><strong>{t("Tips / Prepositions", "Mẹo học / Giới từ")}</strong>: {tipsVal}</div>}
                            {cautionVal && <div><strong>{t("Caution", "Lưu ý")}</strong>: {cautionVal}</div>}
                            {contextVal && <div><strong>{t("Context Captured", "Ngữ cảnh gốc")}</strong>: {contextVal}</div>}
                          </div>
                          <Popover.Arrow className="fill-white dark:fill-slate-900 stroke-gray-200 dark:stroke-slate-800" />
                        </Popover.Content>
                      </Popover.Portal>
                    </Popover.Root>
                  </div>

                  {pendingReview && pendingReview.fields.userSentence !== "" ? (
                    <div className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs p-3 rounded border border-amber-200 dark:border-amber-900/40 font-medium">
                      {t("Sentence submitted", "Câu đã nộp")}: "{pendingReview.fields.userSentence}" ({t("Pending offline AI correction", "Đang chờ AI sửa lỗi offline")})
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        placeholder={t("Write a sentence in German using this word...", "Viết một câu bằng tiếng Đức sử dụng từ này...")}
                        value={inputs[word.id] || ""}
                        onChange={(e) => setInputs((prev) => ({ ...prev, [word.id]: e.target.value }))}
                        className="w-full text-sm px-3 py-2 bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={() => handleSubmit(word.id)}
                        disabled={submitting[word.id] || !inputs[word.id]?.trim()}
                        className="self-end px-4 py-1.5 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-xs font-semibold rounded disabled:opacity-50 cursor-pointer"
                      >
                        {submitting[word.id] ? t("Submitting...", "Đang nộp...") : t("Submit Sentence", "Nộp câu")}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Correction Feedback Sidebar */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t("Recent Corrections", "Sửa lỗi gần đây")}
          </h2>
          {reviews.filter((r) => r.fields.status !== "pending_correction").length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-gray-200 dark:border-slate-800 text-center shadow-sm">
              <p className="text-gray-500 dark:text-slate-400">
                {t("No corrections available yet.", "Chưa có nhận xét sửa lỗi nào.")}
              </p>
            </div>
          ) : (
            reviews
              .filter((r) => r.fields.status !== "pending_correction")
              .slice(0, 5)
              .map((review) => {
                const isCorrect = review.fields.status === "corrected";

                // Resolve feedback column based on language setting
                const feedbackVal = language === "vi" && review.fields.correctionFeedback_vn
                  ? review.fields.correctionFeedback_vn
                  : review.fields.correctionFeedback;

                return (
                  <div key={review.id} className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                        {review.fields.reviewedAt ? new Date(review.fields.reviewedAt).toLocaleDateString() : ""}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                        isCorrect
                          ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                          : "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300"
                      }`}>
                        {isCorrect ? t("Corrected", "Đã sửa") : t("Failed", "Sai")}
                      </span>
                    </div>

                    <div className="text-xs space-y-2">
                      <div>
                        <div className="text-gray-500 dark:text-slate-400 font-medium">{t("Your Sentence", "Câu của bạn")}</div>
                        <div className="text-gray-900 dark:text-gray-200 line-through mt-0.5">"{review.fields.userSentence}"</div>
                      </div>
                      <div>
                        <div className="text-gray-500 dark:text-slate-400 font-medium">{t("Corrected", "Đã sửa đổi")}</div>
                        <div className="text-gray-900 dark:text-gray-200 font-semibold mt-0.5">"{review.fields.correctedSentence}"</div>
                      </div>
                      {feedbackVal && (
                        <div>
                          <div className="text-gray-500 dark:text-slate-400 font-medium">{t("Feedback", "Nhận xét")}</div>
                          <div className="text-gray-700 dark:text-slate-300 mt-0.5 italic">{feedbackVal}</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
}
