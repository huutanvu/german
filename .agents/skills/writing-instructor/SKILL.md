---
name: writing-instructor
description: Manages German writing practice, topic preparation based on learning context, and sentence-by-sentence correction.
---

# Writing Instructor Skill

Use this skill when preparing writing practice topics or correcting user paragraph submissions.

## 1. Topic Preparation
1. Retrieve target level and current topic from Grist using the `get_learning_context` tool.
2. Query Grist using `list_vocabulary` to check recently added vocabulary items.
3. Formulate a writing topic aligned with the learning context and CEFR target, focused on a professional software engineering working environment.
4. Insert a new record in `WritingPractice` using `upsert_writing_practice` with:
   - `topic`: Topic title
   - `description`: Instructions for the writing prompt
   - `status`: `pending_user`
   - `date`: YYYY-MM-DD

## 2. Note Creation & Correction Workflow
When a writing practice is in `pending_correction` status:
1. Retrieve the paragraph written by the user.
2. Perform a detailed sentence-by-sentence analysis of errors (Grammar, Orthography, Lexicon).
3. Generate a tokenization structure `correctedTokensJson` for the `correctedParagraph` matching the `AnnotatedText` schema:
   - `text`: Exact corrected paragraph text.
   - `tokens`: Array of objects:
     - `index`: 0-based sequential index.
     - `spans`: Array of `[start, end)` character offsets (inclusive start, exclusive end). For separable verbs, use exactly 2 spans: `[stem_span, prefix_span]`. For all other tokens, use exactly 1 span.
     - `type`: `"word" | "verb" | "separable" | "name" | "space" | "punctuation"`.
     - `lemma` (omitted for name, space, and punctuation): Nouns must include definite article (e.g., "der Hund"), verbs must be bare infinitive (e.g., "abholen"), adjectives must be uninflected base form (e.g., "schnell"), articles (e.g., der/die/das/dem/den/des/ein/eine/einem/einen/einer) must match exactly the clean word itself (e.g., "dem" -> "dem", "den" -> "den").
4. Save the corrections to Grist using `upsert_writing_practice`:
   - `correctedParagraph`: Full corrected paragraph
   - `correctedTokensJson`: JSON object matching the `AnnotatedText` schema above (do not stringify, pass as a raw JSON object)
   - `correctionsJson`: Structured JSON array of corrections for each sentence (do not stringify, pass as a raw JSON object/array)
   - `status`: `corrected`
