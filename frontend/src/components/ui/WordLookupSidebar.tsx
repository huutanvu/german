"use client";

import { useEffect, useState } from "react";
import { getVocabularyByWord, createVocabulary } from "@/lib/grist";
import { useLanguage } from "@/lib/language-context";
import type { Vocabulary } from "@/lib/types";

interface WordLookupSidebarProps {
  isOpen: boolean;
  word: string;           // canonical form from Gemini (e.g. "abholen", "die Aufgabe")
  sentence: string;       // the sentence the user clicked in
  clickedWord: string;    // the raw clicked token (e.g. "hole")
  separablePrefix?: string; // e.g. "ab" if word is separable
  onClose: () => void;
  onWordAdded?: () => void;
}

/** Render a sentence with specific tokens highlighted in yellow. */
function HighlightedSentence({
  sentence,
  tokensToHighlight,
}: {
  sentence: string;
  tokensToHighlight: string[];
}) {
  const parts = sentence.split(/(\s+)/);
  return (
    <span>
      {parts.map((part, i) => {
        const clean = part.replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "").toLowerCase();
        const highlighted = tokensToHighlight.includes(clean);
        return highlighted ? (
          <mark
            key={i}
            className="bg-yellow-200 dark:bg-yellow-700/60 text-yellow-900 dark:text-yellow-100 rounded px-0.5 not-italic"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </span>
  );
}

export function WordLookupSidebar({
  isOpen,
  word,
  sentence,
  clickedWord,
  separablePrefix,
  onClose,
  onWordAdded,
}: WordLookupSidebarProps) {
  const { language, t } = useLanguage();
  const [vocabItem, setVocabItem] = useState<Vocabulary | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  // Tokens to highlight in the sentence (clicked word + separable prefix if any)
  const highlightTokens = [
    clickedWord.replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "").toLowerCase(),
    ...(separablePrefix ? [separablePrefix.toLowerCase()] : []),
  ];

  useEffect(() => {
    if (!isOpen || !word) return;

    async function lookup() {
      setLoading(true);
      setAdded(false);
      setVocabItem(null);
      try {
        const item = await getVocabularyByWord([word]);
        setVocabItem(item);
      } catch (err) {
        console.error("Failed to fetch vocabulary word:", err);
      } finally {
        setLoading(false);
      }
    }

    lookup();
  }, [isOpen, word, sentence]);

  async function handleAddToQueue() {
    if (!word) return;
    setAdding(true);
    try {
      await createVocabulary({
        word,
        type: "new",
        level: "B1",
        meanings: "",
        grammar: "",
        dailyUse: "",
        professionalUse: "",
        tips: "",
        caution: "",
        isProcessed: false,
      });
      setAdded(true);
      if (onWordAdded) onWordAdded();
    } catch (err) {
      console.error("Failed to add word to vocabulary queue:", err);
    } finally {
      setAdding(false);
    }
  }

  if (!isOpen) return null;

  // Resolve values dynamically based on active language setting (fall back to English if Vietnamese not processed)
  const meaningVal = language === "vi" && vocabItem?.fields.meanings_vn
    ? vocabItem.fields.meanings_vn
    : vocabItem?.fields.meanings;

  const grammarVal = language === "vi" && vocabItem?.fields.grammar_vn
    ? vocabItem.fields.grammar_vn
    : vocabItem?.fields.grammar;

  const dailyUseVal = language === "vi" && vocabItem?.fields.dailyUse_vn
    ? vocabItem.fields.dailyUse_vn
    : vocabItem?.fields.dailyUse;

  const professionalUseVal = language === "vi" && vocabItem?.fields.professionalUse_vn
    ? vocabItem.fields.professionalUse_vn
    : vocabItem?.fields.professionalUse;

  const tipsVal = language === "vi" && vocabItem?.fields.tips_vn
    ? vocabItem.fields.tips_vn
    : vocabItem?.fields.tips;

  const cautionVal = language === "vi" && vocabItem?.fields.caution_vn
    ? vocabItem.fields.caution_vn
    : vocabItem?.fields.caution;

  return (
    <div className="fixed inset-0 z-50 flex justify-end font-sans">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-md h-full bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 shadow-2xl flex flex-col z-10 overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">
              {t("Word Lookup", "Tra cứu từ")}
            </span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-0.5">"{word}"</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sentence context — always shown */}
        {sentence && (
          <div className="px-6 pt-4 pb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 block mb-1.5">
              {t("From sentence", "Ngữ cảnh của câu")}
            </span>
            <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed italic border-l-2 border-yellow-400 pl-3">
              <HighlightedSentence
                sentence={sentence.trim()}
                tokensToHighlight={highlightTokens}
              />
            </p>
          </div>
        )}

        {/* Content */}
        <div className="p-6 flex-1 space-y-6">
          {loading ? (
            <div className="py-20 text-center text-sm text-gray-500 dark:text-slate-400 animate-pulse font-medium">
              {t("Checking vocabulary library...", "Đang kiểm tra kho từ vựng...")}
            </div>
          ) : vocabItem ? (
            <div className="space-y-6">
              {/* Word title & level */}
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">
                  {vocabItem.fields.word}
                </h3>
                <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded">
                  {vocabItem.fields.level} | {vocabItem.fields.type}
                </span>
              </div>

              {/* Unprocessed banner */}
              {!vocabItem.fields.meanings && (
                <div className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs p-4 rounded border border-amber-200 dark:border-amber-900/40 leading-relaxed font-medium">
                  {t(
                    "This word is in your review queue. The AI instructor will generate definitions, examples, and grammatical tips during the next offline run.",
                    "Từ này đang nằm trong hàng đợi ôn tập của bạn. Giáo viên AI sẽ tự động tạo nghĩa, ví dụ và ngữ pháp trong lần quét tiếp theo."
                  )}
                </div>
              )}

              {/* Meanings */}
              {meaningVal && (
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    {t("Meanings", "Ý nghĩa")}
                  </h4>
                  <p className="text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-slate-950 p-3 rounded border border-gray-100 dark:border-slate-800 font-medium">
                    {meaningVal}
                  </p>
                </div>
              )}

              {/* Grammar */}
              {grammarVal && (
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    {t("Grammar", "Ngữ pháp")}
                  </h4>
                  <p className="text-xs text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-slate-950 p-3 rounded border border-gray-100 dark:border-slate-800 whitespace-pre-wrap">
                    {grammarVal}
                  </p>
                </div>
              )}

              {/* Examples */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  {t("Example Sentences", "Câu ví dụ")}
                </h4>
                {dailyUseVal && (
                  <div className="text-xs bg-gray-50 dark:bg-slate-950 p-3 rounded border border-gray-100 dark:border-slate-800 space-y-1">
                    <span className="font-semibold text-gray-500 dark:text-slate-400">
                      {t("Daily context", "Ngữ cảnh hàng ngày")}
                    </span>
                    <p className="text-gray-900 dark:text-gray-200 italic">"{dailyUseVal}"</p>
                  </div>
                )}
                {professionalUseVal && (
                  <div className="text-xs bg-gray-50 dark:bg-slate-950 p-3 rounded border border-gray-100 dark:border-slate-800 space-y-1">
                    <span className="font-semibold text-gray-500 dark:text-slate-400">
                      {t("Professional context", "Ngữ cảnh công việc")}
                    </span>
                    <p className="text-gray-900 dark:text-gray-200 italic">"{professionalUseVal}"</p>
                  </div>
                )}
              </div>

              {/* Tips & Caution */}
              {(tipsVal || cautionVal) && (
                <div className="space-y-3 pt-2">
                  {tipsVal && (
                    <div className="text-xs bg-emerald-50/50 dark:bg-emerald-950/10 p-3 rounded border border-emerald-200 dark:border-emerald-950/20">
                      <strong className="text-emerald-800 dark:text-emerald-300 block mb-1">
                        {t("Tips", "Mẹo học")}
                      </strong>
                      <p className="text-gray-700 dark:text-slate-300">{tipsVal}</p>
                    </div>
                  )}
                  {cautionVal && (
                    <div className="text-xs bg-red-50/50 dark:bg-red-950/10 p-3 rounded border border-red-200 dark:border-red-950/20">
                      <strong className="text-red-800 dark:text-red-300 block mb-1">
                        {t("Caution / Pitfall", "Lưu ý / Lỗi thường gặp")}
                      </strong>
                      <p className="text-gray-700 dark:text-slate-300">{cautionVal}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 text-center py-10">
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                  {t("Word Not Found", "Không tìm thấy từ")}
                </h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 px-4 leading-relaxed">
                  {t(
                    `"${word}" is not yet in your vocabulary library.`,
                    `"${word}" chưa có trong kho từ vựng của bạn.`
                  )}
                </p>
              </div>
              {added ? (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs p-3 rounded border border-emerald-200 dark:border-emerald-900/40 font-semibold italic">
                  {t(
                    "Added to review queue! Detail contents will be generated offline.",
                    "Đã thêm vào hàng đợi ôn tập! Nội dung chi tiết sẽ được cập nhật sau."
                  )}
                </div>
              ) : (
                <button
                  onClick={handleAddToQueue}
                  disabled={adding}
                  className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-sm font-bold rounded cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {adding
                    ? t("Adding to library...", "Đang thêm vào kho từ vựng...")
                    : t("Add to Review Queue", "Thêm vào Hàng đợi Ôn tập")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
