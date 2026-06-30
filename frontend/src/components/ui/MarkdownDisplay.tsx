"use client";

import React, { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { getVocabularyByWord, lookupAndAddWord, resolveWordWithGemini } from "@/lib/grist";
import { detectSeparablePrefix } from "@/lib/german";
import { useLanguage } from "@/lib/language-context";

// Tokens to highlight across the whole text when a word is looked up (legacy fallback)
interface HighlightState {
  sentence: string;      // which sentence the click came from
  tokens: string[];      // lowercased tokens to highlight (clicked word + separable prefix)
}

interface MarkdownDisplayProps {
  content: string;
  tokensJson?: string;   // Optional pre-computed tokens structure
  // canonical: resolved form | sentence | original clicked token | separable prefix if any
  onWordLookup: (canonical: string, sentence: string, clickedWord: string, separablePrefix?: string) => void;
  className?: string;
}

export function MarkdownDisplay({
  content,
  tokensJson,
  onWordLookup,
  className = "",
}: MarkdownDisplayProps) {
  const [highlight, setHighlight] = useState<HighlightState | null>(null);
  const [highlightedTokenIndex, setHighlightedTokenIndex] = useState<number | null>(null);

  // 1. If pre-computed tokenization is provided, render using token segments
  let annotatedText: any = null;
  if (tokensJson) {
    try {
      annotatedText = JSON.parse(tokensJson);
    } catch (e) {
      console.error("Failed to parse tokensJson", e);
    }
  }

  if (annotatedText && Array.isArray(annotatedText.tokens) && annotatedText.text) {
    const segments = buildTokenSegments(annotatedText);
    return (
      <div className={`space-y-4 markdown-preview select-text leading-relaxed font-sans text-sm text-gray-800 dark:text-gray-200 ${className}`}>
        {renderSegments(
          segments,
          annotatedText.text,
          highlightedTokenIndex,
          setHighlightedTokenIndex,
          onWordLookup
        )}
      </div>
    );
  }

  // 2. Legacy fallback: Split by sentences/words at runtime
  // Strip Obsidian-style double bracket links
  const cleanContent = content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, display) =>
    display || target
  );

  const blocks = cleanContent.split(/\n\s*\n/);

  function handleInternalWordLookup(
    canonical: string,
    sentence: string,
    clickedWord: string,
    separablePrefix?: string
  ) {
    const tokens = [
      clickedWord.replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "").toLowerCase(),
      ...(separablePrefix ? [separablePrefix.toLowerCase()] : []),
    ];
    setHighlight({ sentence, tokens });
    onWordLookup(canonical, sentence, clickedWord, separablePrefix);
  }

  return (
    <div className={`space-y-4 markdown-preview select-text ${className}`}>
      {blocks.map((block, blockIdx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("![[")) return null;

        if (trimmed.startsWith("#")) {
          const depth = (trimmed.match(/^#+/) || ["#"])[0].length;
          const text = trimmed.replace(/^#+\s*/, "");
          const Tag = `h${Math.min(depth + 1, 6)}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
          return (
            <Tag key={blockIdx} className="font-bold text-gray-900 dark:text-gray-100 mt-4 mb-2">
              <TextBlock text={text} onWordLookup={handleInternalWordLookup} highlight={highlight} />
            </Tag>
          );
        }

        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const items = trimmed.split(/\n[-*]\s+/).map(item => item.replace(/^[-*]\s+/, ""));
          return (
            <ul key={blockIdx} className="list-disc pl-5 space-y-1 my-2">
              {items.map((item, itemIdx) => (
                <li key={itemIdx} className="text-sm text-gray-800 dark:text-gray-200">
                  <TextBlock text={item} onWordLookup={handleInternalWordLookup} highlight={highlight} />
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={blockIdx} className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed font-sans">
            <TextBlock text={trimmed} onWordLookup={handleInternalWordLookup} highlight={highlight} />
          </p>
        );
      })}
    </div>
  );
}

// ─── Token Helper Functions ───

function buildTokenSegments(annotatedText: { text: string; tokens: any[] }) {
  const text = annotatedText.text;
  const tokens = annotatedText.tokens;

  // Create a map from character index to token
  const charToToken = new Array(text.length).fill(null);

  for (const token of tokens) {
    if (!token.spans) continue;
    for (const span of token.spans) {
      const [start, end] = span;
      for (let i = start; i < end; i++) {
        charToToken[i] = token;
      }
    }
  }

  // Group contiguous characters belonging to the same token
  const segments: { start: number; end: number; token: any }[] = [];
  if (text.length === 0) return segments;

  let currentToken = charToToken[0];
  let startIdx = 0;

  for (let i = 1; i < text.length; i++) {
    if (charToToken[i] !== currentToken) {
      segments.push({
        start: startIdx,
        end: i,
        token: currentToken,
      });
      currentToken = charToToken[i];
      startIdx = i;
    }
  }

  segments.push({
    start: startIdx,
    end: text.length,
    token: currentToken,
  });

  return segments;
}

function findSentenceContext(text: string, pos: number): string {
  let start = 0;
  for (let i = pos - 1; i >= 0; i--) {
    if (text[i] === "." || text[i] === "?" || text[i] === "!" || text[i] === "\n") {
      start = i + 1;
      break;
    }
  }
  while (start < text.length && /\s/.test(text[start])) {
    start++;
  }

  let end = text.length;
  for (let i = pos; i < text.length; i++) {
    if (text[i] === "." || text[i] === "?" || text[i] === "!" || text[i] === "\n") {
      end = i + 1;
      break;
    }
  }

  return text.slice(start, end).trim();
}

function renderSegments(
  segments: any[],
  fullText: string,
  highlightedTokenIndex: number | null,
  setHighlightedTokenIndex: (index: number | null) => void,
  onWordLookup: (canonical: string, sentence: string, clickedWord: string, separablePrefix?: string) => void
) {
  return segments.map((seg, idx) => {
    const segmentText = fullText.slice(seg.start, seg.end);
    const token = seg.token;

    if (!token) {
      return <span key={idx}>{segmentText}</span>;
    }

    if (token.type === "space") {
      if (segmentText.includes("\n")) {
        const parts = segmentText.split("\n");
        return (
          <React.Fragment key={idx}>
            {parts.map((part, pIdx) => (
              <React.Fragment key={pIdx}>
                {pIdx > 0 && <br className="my-2 block content-['']" />}
                {part}
              </React.Fragment>
            ))}
          </React.Fragment>
        );
      }
      return <span key={idx}>{segmentText}</span>;
    }

    if (token.type === "punctuation") {
      return <span key={idx}>{segmentText}</span>;
    }

    const sentence = findSentenceContext(fullText, seg.start);
    const isHighlighted = highlightedTokenIndex === token.index;

    return (
      <TokenWordSpan
        key={idx}
        text={segmentText}
        token={token}
        sentence={sentence}
        isHighlighted={isHighlighted}
        fullText={fullText}
        onWordLookup={onWordLookup}
        onHighlightToken={setHighlightedTokenIndex}
      />
    );
  });
}

// ─── Component: TokenWordSpan ───

function TokenWordSpan({
  text,
  token,
  sentence,
  isHighlighted,
  fullText,
  onWordLookup,
  onHighlightToken,
}: {
  text: string;
  token: any;
  sentence: string;
  isHighlighted: boolean;
  fullText: string;
  onWordLookup: (canonical: string, sentence: string, clickedWord: string, separablePrefix?: string) => void;
  onHighlightToken: (index: number | null) => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "resolving" | "processing">("idle");

  const isInteractive = token && (token.type === "word" || token.type === "verb" || token.type === "separable");

  if (!isInteractive) {
    return <span>{text}</span>;
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) setStatus("idle");
  }

  async function handleLookup() {
    setStatus("resolving");
    try {
      const canonical = token.lemma || text;
      
      // Determine if this is a separable verb and extract prefix from second span
      let separablePrefix = undefined;
      if (token.type === "separable" && Array.isArray(token.spans) && token.spans.length > 1) {
        const [pStart, pEnd] = token.spans[1];
        separablePrefix = fullText.slice(pStart, pEnd);
      }

      const item = await getVocabularyByWord([canonical]);

      if (item) {
        onHighlightToken(token.index);
        onWordLookup(canonical, sentence, text, separablePrefix);
        setOpen(false);
        setStatus("idle");
      } else {
        setStatus("processing");
        const newItem = await lookupAndAddWord(canonical, sentence);
        if (newItem) {
          onHighlightToken(token.index);
          onWordLookup(newItem.fields.word, sentence, text, separablePrefix);
        }
        setOpen(false);
        setStatus("idle");
      }
    } catch (err) {
      console.error("Lookup failed:", err);
      setOpen(false);
      setStatus("idle");
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <span
          className={[
            "cursor-pointer rounded px-0.5 transition-colors duration-150 border-b border-dotted border-gray-400 dark:border-slate-500",
            isHighlighted
              ? "bg-yellow-200 dark:bg-yellow-700/60 text-yellow-900 dark:text-yellow-100"
              : "hover:bg-blue-100 hover:text-blue-900 dark:hover:bg-blue-950/40 dark:hover:text-blue-200",
          ].join(" ")}
          title="Click to lookup"
        >
          {text}
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="center"
          sideOffset={6}
          className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg shadow-xl p-2 z-50 flex flex-col gap-1 min-w-[150px] font-sans text-xs outline-none"
        >
          {status === "idle" && (
            <button
              onClick={handleLookup}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-800 dark:text-gray-200 rounded font-semibold transition-colors cursor-pointer"
            >
              {t("Lookup", "Tra cứu")}
            </button>
          )}
          {status === "resolving" && (
            <div className="py-2 px-3 text-center text-gray-400 animate-pulse font-medium">
              {t("Looking up...", "Đang tra cứu...")}
            </div>
          )}
          {status === "processing" && (
            <div className="py-2 px-3 text-center text-gray-400 animate-pulse font-medium">
              {t("Generating...", "Đang tạo...")}
            </div>
          )}
          <Popover.Arrow className="fill-white dark:fill-slate-900 stroke-gray-200 dark:stroke-slate-800 stroke-[1px]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ─── Legacy TextBlock / WordSpan fallback components ───

function TextBlock({
  text,
  onWordLookup,
  highlight,
}: {
  text: string;
  onWordLookup: (canonical: string, sentence: string, clickedWord: string, separablePrefix?: string) => void;
  highlight: HighlightState | null;
}) {
  const sentenceRegex = /[^.!?]+[.!?]?(?:\s+|$)/g;
  const sentences = text.match(sentenceRegex) || [text];

  return (
    <>
      {sentences.map((sentence, sIdx) => {
        const boldParts = sentence.split(/\*\*/);
        return (
          <span key={sIdx} className="sentence-block">
            {boldParts.map((part, pIdx) => {
              const isBold = pIdx % 2 !== 0;
              const tokens = part.split(/(\s+)/);
              return (
                <span key={pIdx} className={isBold ? "font-bold text-gray-950 dark:text-white" : ""}>
                  {tokens.map((token, tIdx) => {
                    const isWord = /\w+/.test(token);
                    if (!isWord) return <span key={tIdx}>{token}</span>;

                    const clean = token.replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "").toLowerCase();
                    const isHighlighted =
                      highlight?.sentence === sentence &&
                      highlight.tokens.includes(clean);

                    return (
                      <WordSpan
                        key={tIdx}
                        word={token}
                        sentence={sentence}
                        onWordLookup={onWordLookup}
                        isHighlighted={isHighlighted}
                      />
                    );
                  })}
                </span>
              );
            })}
          </span>
        );
      })}
    </>
  );
}

function WordSpan({
  word,
  sentence,
  onWordLookup,
  isHighlighted,
}: {
  word: string;
  sentence: string;
  onWordLookup: (canonical: string, sentence: string, clickedWord: string, separablePrefix?: string) => void;
  isHighlighted: boolean;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "resolving" | "processing">("idle");

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) setStatus("idle");
  }

  async function handleLookup() {
    setStatus("resolving");
    try {
      const canonical = await resolveWordWithGemini(word, sentence);

      const separablePrefix = detectSeparablePrefix(canonical) ?? undefined;

      const item = await getVocabularyByWord([canonical]);

      if (item) {
        onWordLookup(canonical, sentence, word, separablePrefix);
        setOpen(false);
        setStatus("idle");
      } else {
        setStatus("processing");
        const newItem = await lookupAndAddWord(canonical, sentence);
        if (newItem) {
          onWordLookup(newItem.fields.word, sentence, word, separablePrefix);
        }
        setOpen(false);
        setStatus("idle");
      }
    } catch (err) {
      console.error("Lookup failed:", err);
      setOpen(false);
      setStatus("idle");
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <span
          className={[
            "cursor-pointer rounded px-0.5 transition-colors duration-150",
            isHighlighted
              ? "bg-yellow-200 dark:bg-yellow-700/60 text-yellow-900 dark:text-yellow-100"
              : "hover:bg-blue-100 hover:text-blue-900 dark:hover:bg-blue-950/40 dark:hover:text-blue-200",
          ].join(" ")}
          title="Click to lookup"
        >
          {word}
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="center"
          sideOffset={6}
          className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg shadow-xl p-2 z-50 flex flex-col gap-1 min-w-[150px] font-sans text-xs outline-none"
        >
          {status === "idle" && (
            <button
              onClick={handleLookup}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-800 dark:text-gray-200 rounded font-semibold transition-colors cursor-pointer"
            >
              {t("Lookup", "Tra cứu")}
            </button>
          )}
          {status === "resolving" && (
            <div className="py-2 px-3 text-center text-gray-400 animate-pulse font-medium">
              {t("Looking up...", "Đang tra cứu...")}
            </div>
          )}
          {status === "processing" && (
            <div className="py-2 px-3 text-center text-gray-400 animate-pulse font-medium">
              {t("Generating...", "Đang tạo...")}
            </div>
          )}
          <Popover.Arrow className="fill-white dark:fill-slate-900 stroke-gray-200 dark:stroke-slate-800 stroke-[1px]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
