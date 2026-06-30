---
name: vocabulary-instructor
description: Manages German vocabulary capture, testing, and spaced repetition review workflow.
---

# Vocabulary Instructor Skill

Use this skill when capturing new German vocabulary or reviewing existing vocabulary.

## 1. Vocabulary Capture & Processing Workflow
For new or unprocessed words (`isProcessed` = `false` in `Vocabulary` table):
1. Read the clicked `word` and its context from the table.
2. Reconstruct the correct infinitive (verb), nominative singular with gender article (noun), or base form (adjective/adverb) using Gemini.
3. Update the vocabulary fields:
   - `word`: Resolved dictionary form (e.g., "die Aufgabe" instead of "Aufgaben")
   - `meanings`: English translation(s)
   - `meanings_vn`: Vietnamese translation(s)
   - `level`: CEFR Level
   - `type`: `new`
   - `grammar`: Grammatical notes (articles, plurals, auxiliary verbs, etc.)
   - `grammar_vn`: Grammatical notes in Vietnamese
   - `dailyUse`: Example sentence in daily context
   - `dailyUse_vn`: Same daily example sentence translated to Vietnamese
   - `dailyUseTokensJson`: JSON object matching the `AnnotatedText` schema for `dailyUse` (do not stringify, pass as a raw JSON object)
   - `dailyUseTokensJson_vn`: JSON object matching the `AnnotatedText` schema for `dailyUse_vn` (do not stringify, pass as a raw JSON object)
   - `professionalUse`: Example sentence in software engineering context
   - `professionalUse_vn`: Same professional example sentence translated to Vietnamese
   - `professionalUseTokensJson`: JSON object matching the `AnnotatedText` schema for `professionalUse` (do not stringify, pass as a raw JSON object)
   - `professionalUseTokensJson_vn`: JSON object matching the `AnnotatedText` schema for `professionalUse_vn` (do not stringify, pass as a raw JSON object)
   - `tips`: Associated prepositions/cases
   - `tips_vn`: Tips in Vietnamese
   - `caution`: Common pitfalls or false friends
   - `caution_vn`: Cautions in Vietnamese
   - `isProcessed`: `true`

   *AnnotatedText Schema for tokensJson fields*:
   - `text`: Exact raw text.
   - `tokens`: Array of objects:
     - `index`: 0-based sequential index.
     - `spans`: Array of `[start, end)` character offsets (inclusive start, exclusive end). For separable verbs, use exactly 2 spans: `[stem_span, prefix_span]`. For all other tokens, use exactly 1 span.
     - `type`: `"word" | "verb" | "separable" | "name" | "space" | "punctuation"`.
     - `lemma` (omitted for name, space, and punctuation): Nouns must include definite article (e.g., "der Hund"), verbs must be bare infinitive (e.g., "abholen"), adjectives must be uninflected base form (e.g., "schnell").
4. Update the Grist record using `update_vocabulary`.

## 2. Vocabulary Review Workflow
When the user does vocabulary reviews:
1. Fetch pending reviews using `list_reviews` with status `pending_correction`.
2. For each review, evaluate the user's sentence and generate corrected sentences + grammar feedback.
3. Update vocabulary review using `update_review` and update the status to `corrected` or `failed`.
4. Adjust `correctCount` in the `Vocabulary` table accordingly (increment for success, reset for failure, mastery at 5).
