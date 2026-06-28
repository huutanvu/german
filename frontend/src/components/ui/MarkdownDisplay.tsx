"use client";

import React, { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { getVocabularyByWord, lookupAndAddWord, resolveWordWithGemini } from "@/lib/grist";

interface MarkdownDisplayProps {
  content: string;
  onWordLookup: (word: string, sentence: string) => void;
  className?: string;
}

export function MarkdownDisplay({
  content,
  onWordLookup,
  className = "",
}: MarkdownDisplayProps) {
  // Strip Obsidian-style double bracket links: e.g. [[word]] or [[word|display]] -> display/word
  const cleanContent = content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, display) => {
    return display || target;
  });

  // Split text by double newlines to find block paragraphs
  const blocks = cleanContent.split(/\n\s*\n/);

  return (
    <div className={`space-y-4 markdown-preview select-text ${className}`}>
      {blocks.map((block, blockIdx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Skip markdown media embeds like ![[...]]
        if (trimmed.startsWith("![[")) return null;

        // Render Headings
        if (trimmed.startsWith("#")) {
          const depth = (trimmed.match(/^#+/) || ["#"])[0].length;
          const text = trimmed.replace(/^#+\s*/, "");
          const Tag = `h${Math.min(depth + 1, 6)}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
          return (
            <Tag key={blockIdx} className="font-bold text-gray-900 dark:text-gray-100 mt-4 mb-2">
              <TextBlock text={text} onWordLookup={onWordLookup} />
            </Tag>
          );
        }

        // Render Lists
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const items = trimmed.split(/\n[-*]\s+/).map((item) => item.replace(/^[-*]\s+/, ""));
          return (
            <ul key={blockIdx} className="list-disc pl-5 space-y-1 my-2">
              {items.map((item, itemIdx) => (
                <li key={itemIdx} className="text-sm text-gray-800 dark:text-gray-200">
                  <TextBlock text={item} onWordLookup={onWordLookup} />
                </li>
              ))}
            </ul>
          );
        }

        // Standard Paragraph
        return (
          <p key={blockIdx} className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed font-sans">
            <TextBlock text={trimmed} onWordLookup={onWordLookup} />
          </p>
        );
      })}
    </div>
  );
}

// Sub-component to split a block of text into sentences, and sentences into words
function TextBlock({
  text,
  onWordLookup,
}: {
  text: string;
  onWordLookup: (word: string, sentence: string) => void;
}) {
  // Regex to split sentences while preserving boundaries: matches punctuation followed by space or end
  const sentenceRegex = /[^.!?]+[.!?]?(?:\s+|$)/g;
  const sentences = text.match(sentenceRegex) || [text];

  return (
    <>
      {sentences.map((sentence, sIdx) => {
        // Split sentence by "**" to detect bold sections
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
                    if (!isWord) {
                      return <span key={tIdx}>{token}</span>;
                    }

                    return (
                      <WordSpan
                        key={tIdx}
                        word={token}
                        sentence={sentence}
                        onWordLookup={onWordLookup}
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
}: {
  word: string;
  sentence: string;
  onWordLookup: (word: string, sentence: string) => void;
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
      // Step 1: Gemini resolves the canonical form
      const canonical = await resolveWordWithGemini(word, sentence);

      // Step 2: Look up in Grist using exactly what Gemini returned
      const item = await getVocabularyByWord([canonical]);

      if (item) {
        onWordLookup(canonical, sentence);
        setOpen(false);
        setStatus("idle");
      } else {
        // Not found — auto-generate with Gemini
        setStatus("processing");
        const newItem = await lookupAndAddWord(canonical, sentence);
        if (newItem) {
          onWordLookup(newItem.fields.word, sentence);
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
          className="hover:bg-blue-100 hover:text-blue-900 dark:hover:bg-blue-950/40 dark:hover:text-blue-200 cursor-pointer rounded px-0.5 transition-colors duration-150"
          title="Click to lookup or add"
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


