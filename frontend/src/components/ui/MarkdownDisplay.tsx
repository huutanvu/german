"use client";

import React, { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { getVocabularyByWord, lookupAndAddWord, resolveWordWithGemini } from "@/lib/grist";
import { detectSeparablePrefix } from "@/lib/german";

// Tokens to highlight across the whole text when a word is looked up
interface HighlightState {
  sentence: string;      // which sentence the click came from
  tokens: string[];      // lowercased tokens to highlight (clicked word + separable prefix)
}

interface MarkdownDisplayProps {
  content: string;
  // canonical: Gemini-resolved form | sentence | original clicked token | separable prefix if any
  onWordLookup: (canonical: string, sentence: string, clickedWord: string, separablePrefix?: string) => void;
  className?: string;
}

export function MarkdownDisplay({
  content,
  onWordLookup,
  className = "",
}: MarkdownDisplayProps) {
  const [highlight, setHighlight] = useState<HighlightState | null>(null);

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

      // Detect if Gemini returned a separable verb (e.g. "abholen" → prefix "ab")
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
              Lookup
            </button>
          )}
          {status === "resolving" && (
            <div className="py-2 px-3 text-center text-gray-400 animate-pulse font-medium">
              Looking up...
            </div>
          )}
          {status === "processing" && (
            <div className="py-2 px-3 text-center text-gray-400 animate-pulse font-medium">
              Generating...
            </div>
          )}
          <Popover.Arrow className="fill-white dark:fill-slate-900 stroke-gray-200 dark:stroke-slate-800 stroke-[1px]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
