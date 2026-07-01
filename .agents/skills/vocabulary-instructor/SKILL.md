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
   - `partOfSpeech`: Categorized word type (`noun`, `verb`, `adjective`, `adverb`, `preposition`, `pronoun`, `conjunction`, `phrase`)
   - `type`: `new`
   - `grammar`: Grammatical notes (articles, plurals, auxiliary verbs, etc.)
   - `grammar_vn`: Grammatical notes in Vietnamese
   - `dailyUse`: Example sentence in daily context
   - `dailyUse_vn`: Same daily example sentence translated to Vietnamese
   - `professionalUse`: Example sentence in software engineering context
   - `professionalUse_vn`: Same professional example sentence translated to Vietnamese
   - `tips`: Associated prepositions/cases
   - `tips_vn`: Tips in Vietnamese
   - `caution`: Common pitfalls or false friends
   - `caution_vn`: Cautions in Vietnamese
   - `isProcessed`: `true`
4. Update the Grist record using `update_vocabulary`.

## 2. Vocabulary Review Workflow
When the user does vocabulary reviews:
1. Fetch pending reviews using `list_reviews` with status `pending_correction`.
2. For each review, check the `userSentence` field. If it is empty, blank, or contains only whitespace, skip it (this indicates the word has been added to the collection but the user hasn't written a review sentence yet). Otherwise, evaluate the user's sentence and generate corrected sentences + grammar feedback.
3. Update vocabulary review using `update_review` and update the status to `corrected` or `failed`.
4. Adjust `correctCount` in the `VocabularyReviews` table record itself (determine previous correctCount from the user's past reviews for this word, increment it for success, or reset to 0 for failure, mastery at 5).
