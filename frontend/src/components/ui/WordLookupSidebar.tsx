"use client";

import { useEffect, useState } from "react";
import { getVocabularyByWord, createVocabulary } from "@/lib/grist";
import { findGermanInfinitive } from "@/lib/german";
import type { Vocabulary } from "@/lib/types";

interface WordLookupSidebarProps {
  isOpen: boolean;
  word: string;
  sentence: string;
  onClose: () => void;
  onWordAdded?: () => void; // Optional callback to trigger list refresh in parent page
}

export function WordLookupSidebar({
  isOpen,
  word,
  sentence,
  onClose,
  onWordAdded,
}: WordLookupSidebarProps) {
  const [infinitive, setInfinitive] = useState("");
  const [vocabItem, setVocabItem] = useState<Vocabulary | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!isOpen || !word) return;

    async function lookup() {
      setLoading(true);
      setAdded(false);
      setVocabItem(null);

      // Reconstruct separable verb or base infinitive
      const resolvedInfinitive = findGermanInfinitive(word, sentence);
      setInfinitive(resolvedInfinitive);

      const cleanWord = word.trim().replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "");
      const lowerWord = cleanWord.toLowerCase();
      const capWord = cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1).toLowerCase();
      const lowerInfinitive = resolvedInfinitive.toLowerCase();
      const capInfinitive = resolvedInfinitive.charAt(0).toUpperCase() + resolvedInfinitive.slice(1).toLowerCase();

      const variations = Array.from(new Set([lowerWord, capWord, lowerInfinitive, capInfinitive]));

      try {
        const item = await getVocabularyByWord(variations);
        setVocabItem(item);
      } catch (err) {
        console.error("Failed to check vocabulary word:", err);
      } finally {
        setLoading(false);
      }
    }

    lookup();
  }, [isOpen, word, sentence]);

  async function handleAddToQueue() {
    if (!infinitive) return;

    setAdding(true);
    try {
      await createVocabulary({
        word: infinitive,
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end font-sans">
      {/* Backdrop overlay */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-md h-full bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 shadow-2xl flex flex-col z-10 transition-transform overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Word Lookup</span>
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

        {/* Content */}
        <div className="p-6 flex-1 space-y-6">
          {loading ? (
            <div className="py-20 text-center text-sm text-gray-500 dark:text-slate-400 animate-pulse font-medium">
              Checking vocabulary library...
            </div>
          ) : vocabItem ? (
            <div className="space-y-6">
              {/* Word Title & level */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">{vocabItem.fields.word}</h3>
                  {infinitive !== word.toLowerCase() && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
                      Parsed infinitive of "{word}"
                    </span>
                  )}
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded">
                  {vocabItem.fields.level} | {vocabItem.fields.type}
                </span>
              </div>

              {/* Unprocessed state banner */}
              {!vocabItem.fields.meanings && (
                <div className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs p-4 rounded border border-amber-200 dark:border-amber-900/40 leading-relaxed font-medium">
                  This word is in your review queue. The AI instructor will generate definitions, examples, and grammatical tips during the next offline run.
                  {vocabItem.fields.context && (
                    <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-900/30">
                      <span className="font-semibold text-amber-700 dark:text-amber-400 block mb-1">Sentence Context:</span>
                      <p className="italic">"{vocabItem.fields.context}"</p>
                    </div>
                  )}
                </div>
              )}

              {/* Meanings */}
              {vocabItem.fields.meanings && (
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Meanings</h4>
                  <p className="text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-slate-950 p-3 rounded border border-gray-100 dark:border-slate-800 font-medium">
                    {vocabItem.fields.meanings}
                  </p>
                </div>
              )}

              {/* Grammar */}
              {vocabItem.fields.grammar && (
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Grammar</h4>
                  <p className="text-xs text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-slate-950 p-3 rounded border border-gray-100 dark:border-slate-800 whitespace-pre-wrap">
                    {vocabItem.fields.grammar}
                  </p>
                </div>
              )}

              {/* Examples */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Example Sentences</h4>
                
                {vocabItem.fields.dailyUse && (
                  <div className="text-xs bg-gray-50 dark:bg-slate-950 p-3 rounded border border-gray-100 dark:border-slate-800 space-y-1">
                    <span className="font-semibold text-gray-500 dark:text-slate-400">Daily context</span>
                    <p className="text-gray-900 dark:text-gray-200 italic">"{vocabItem.fields.dailyUse}"</p>
                  </div>
                )}

                {vocabItem.fields.professionalUse && (
                  <div className="text-xs bg-gray-50 dark:bg-slate-950 p-3 rounded border border-gray-100 dark:border-slate-800 space-y-1">
                    <span className="font-semibold text-gray-500 dark:text-slate-400">Professional context</span>
                    <p className="text-gray-900 dark:text-gray-200 italic">"{vocabItem.fields.professionalUse}"</p>
                  </div>
                )}
              </div>

              {/* Tips & Caution */}
              {(vocabItem.fields.tips || vocabItem.fields.caution) && (
                <div className="space-y-3 pt-2">
                  {vocabItem.fields.tips && (
                    <div className="text-xs bg-emerald-50/50 dark:bg-emerald-950/10 p-3 rounded border border-emerald-200 dark:border-emerald-950/20">
                      <strong className="text-emerald-800 dark:text-emerald-300 block mb-1">Tips</strong>
                      <p className="text-gray-700 dark:text-slate-300">{vocabItem.fields.tips}</p>
                    </div>
                  )}

                  {vocabItem.fields.caution && (
                    <div className="text-xs bg-red-50/50 dark:bg-red-950/10 p-3 rounded border border-red-200 dark:border-red-950/20">
                      <strong className="text-red-800 dark:text-red-300 block mb-1">Caution / Pitfall</strong>
                      <p className="text-gray-700 dark:text-slate-300">{vocabItem.fields.caution}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 text-center py-10">
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Word Not Found</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 px-4 leading-relaxed">
                  "{infinitive}" is not yet in your German vocabulary database.
                </p>
              </div>

              {added ? (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs p-3 rounded border border-emerald-200 dark:border-emerald-900/40 font-semibold italic">
                  Added to review queue! Detail contents will be generated offline.
                </div>
              ) : (
                <button
                  onClick={handleAddToQueue}
                  disabled={adding}
                  className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-sm font-bold rounded cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {adding ? "Adding to library..." : "Add to Review Queue"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
