"use client";

import { useEffect, useState } from "react";
import { getVocabularyByWord, createVocabulary, getReviewsForWord, addWordToCollection, updateVocabulary } from "@/lib/grist";
import { useLanguage } from "@/lib/language-context";
import type { Vocabulary } from "@/lib/types";
import { UploadVocabAudioButton } from "./UploadVocabAudioButton";

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
  const boldParts = sentence.split(/\*\*/);
  return (
    <span>
      {boldParts.map((boldPart, bpIdx) => {
        const isBold = bpIdx % 2 !== 0;
        const italicParts = boldPart.split(/\*/);

        return (
          <span key={bpIdx} className={isBold ? "font-bold text-gray-950 dark:text-white" : ""}>
            {italicParts.map((italicPart, ipIdx) => {
              const isItalic = ipIdx % 2 !== 0;
              const tokens = italicPart.split(/(\s+)/);

              return (
                <span key={ipIdx} className={isItalic ? "italic text-gray-900 dark:text-slate-200" : ""}>
                  {tokens.map((token, tIdx) => {
                    const clean = token.replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "").toLowerCase();
                    const highlighted = tokensToHighlight.includes(clean);
                    return highlighted ? (
                      <mark
                        key={tIdx}
                        className="bg-yellow-200 dark:bg-yellow-700/60 text-yellow-900 dark:text-yellow-100 rounded px-0.5 not-italic"
                      >
                        {token}
                      </mark>
                    ) : (
                      <span key={tIdx}>{token}</span>
                    );
                  })}
                </span>
              );
            })}
          </span>
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
  const [addingToCollection, setAddingToCollection] = useState(false);
  const [inCollection, setInCollection] = useState(false);
  const [checkingCollection, setCheckingCollection] = useState(false);
  const [added, setAdded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Tokens to highlight in the sentence (clicked word + separable prefix if any)
  const highlightTokens = [
    clickedWord.replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "").toLowerCase(),
    ...(separablePrefix ? [separablePrefix.toLowerCase()] : []),
  ];

  useEffect(() => {
    async function checkAdmin() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setIsAdmin(data.userId === 'd68f7a67-42fb-43b2-a1c7-1108eb99150a');
        }
      } catch (err) {
        console.error("Failed to check admin status:", err);
      }
    }
    checkAdmin();
  }, []);

  useEffect(() => {
    if (!isOpen || !word) return;

    async function lookup() {
      setLoading(true);
      setAdded(false);
      setVocabItem(null);
      setInCollection(false);
      try {
        const item = await getVocabularyByWord([word]);
        setVocabItem(item);
        if (item) {
          setCheckingCollection(true);
          const reviews = await getReviewsForWord(item.id);
          const hasPending = reviews.some(r => r.fields.status === 'pending_correction');
          setInCollection(hasPending);
        }
      } catch (err) {
        console.error("Failed to fetch vocabulary word:", err);
      } finally {
        setLoading(false);
        setCheckingCollection(false);
      }
    }

    lookup();
  }, [isOpen, word, sentence]);

  async function handleAddToCollection() {
    if (!word) return;
    setAddingToCollection(true);
    try {
      let vocabId = vocabItem?.id;
      if (!vocabId) {
        // Word not in global dictionary yet, create it globally first
        const res = await createVocabulary({
          word,
          type: "new",
          level: "B1",
          meanings: "",
          grammar: "",
          isProcessed: false,
        });
        vocabId = res.records[0].id;
        // Fetch it again to update UI
        const item = await getVocabularyByWord([word]);
        setVocabItem(item);
      }
      
      // Add to personal collection/reviews
      await addWordToCollection(vocabId);
      setInCollection(true);
      setAdded(true);
      if (onWordAdded) onWordAdded();
    } catch (err) {
      console.error("Failed to add word to collection:", err);
    } finally {
      setAddingToCollection(false);
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
              {/* Word title & details */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">
                      {vocabItem.fields.word}
                    </h3>
                    <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded">
                      {vocabItem.fields.level}
                    </span>
                    {vocabItem.fields.audioFileId && (
                      <button
                        onClick={() => {
                          const audio = new Audio(`https://media.publit.io/file/german/${vocabItem.fields.audioFileId}.wav`);
                          audio.play().catch(err => console.error("Failed to play pronunciation audio:", err));
                        }}
                        className="p-1 text-gray-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center"
                        title={t("Listen", "Nghe")}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {vocabItem.fields.partOfSpeech && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium italic">
                      {vocabItem.fields.partOfSpeech}
                    </p>
                  )}
                </div>

                {/* Small icon button for reviews */}
                <div className="shrink-0">
                  {inCollection ? (
                    <div 
                      className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-900/40 shadow-xs" 
                      title={t("In Reviews", "Đang ôn tập")}
                    >
                      <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <button
                      onClick={handleAddToCollection}
                      disabled={addingToCollection || checkingCollection}
                      className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-50 flex items-center justify-center"
                      title={t("Add to review", "Learn")}
                    >
                      {addingToCollection ? (
                        <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Audio upload controls for admin */}
              {isAdmin && !vocabItem.fields.audioFileId && (
                <div className="bg-gray-50 dark:bg-slate-950/50 p-3 rounded-lg border border-gray-100 dark:border-slate-800 shadow-2xs">
                  <span className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 block mb-1">
                    {t("Upload Audio (Admin)", "Tải lên phát âm (Admin)")}
                  </span>
                  <UploadVocabAudioButton
                    vocabId={vocabItem.id}
                    wordName={vocabItem.fields.word}
                    onUploadSuccess={(newAudioId) => {
                      setVocabItem(prev => prev ? {
                        ...prev,
                        fields: {
                          ...prev.fields,
                          audioFileId: newAudioId
                        }
                      } : null);
                    }}
                  />
                </div>
              )}



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
                  <p className="text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-slate-950 p-3 rounded border border-gray-100 dark:border-slate-800 whitespace-pre-wrap">
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
                  <div className="text-sm bg-gray-50 dark:bg-slate-950 p-3 rounded border border-gray-100 dark:border-slate-800 space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block">
                      {t("Daily context", "Ngữ cảnh hàng ngày")}
                    </span>
                    <p className="text-gray-900 dark:text-gray-200 italic">"{dailyUseVal}"</p>
                  </div>
                )}
                {professionalUseVal && (
                  <div className="text-sm bg-gray-50 dark:bg-slate-950 p-3 rounded border border-gray-100 dark:border-slate-800 space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block">
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
                    <div className="text-sm bg-emerald-50/50 dark:bg-emerald-950/10 p-3 rounded border border-emerald-200 dark:border-emerald-950/20">
                      <strong className="text-emerald-800 dark:text-emerald-300 block mb-1">
                        {t("Tips", "Mẹo học")}
                      </strong>
                      <p className="text-gray-700 dark:text-slate-300">{tipsVal}</p>
                    </div>
                  )}
                  {cautionVal && (
                    <div className="text-sm bg-red-50/50 dark:bg-red-950/10 p-3 rounded border border-red-200 dark:border-red-950/20">
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
              {added || inCollection ? (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs p-3 rounded border border-emerald-200 dark:border-emerald-900/40 font-semibold italic">
                  {t(
                    "Added to review queue! Detail contents will be generated offline.",
                    "Đã thêm vào hàng đợi ôn tập! Nội dung chi tiết sẽ được cập nhật sau."
                  )}
                </div>
              ) : (
                <button
                  onClick={handleAddToCollection}
                  disabled={addingToCollection}
                  className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-sm font-bold rounded cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {addingToCollection
                    ? t("Adding to library...", "Đang thêm vào kho từ vựng...")
                    : t("Add to review", "Learn")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
