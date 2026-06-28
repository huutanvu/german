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
   - `level`: CEFR Level
   - `type`: `new`
   - `grammar`: Grammatical notes (articles, plurals, auxiliary verbs, etc.)
   - `dailyUse`: Example sentence in daily context with English translation in brackets
   - `professionalUse`: Example sentence in software engineering context with English translation in brackets
   - `tips`: Associated prepositions/cases
   - `caution`: Common pitfalls or false friends
   - `isProcessed`: `true`
4. Update the Grist record using `update_vocabulary`.

## 2. Vocabulary Review Workflow
When the user does vocabulary reviews:
1. Fetch pending reviews using `list_reviews` with status `pending_correction`.
2. For each review, evaluate the user's sentence and generate corrected sentences + grammar feedback.
3. Update vocabulary review using `update_review` and update the status to `corrected` or `failed`.
4. Adjust `correctCount` in the `Vocabulary` table accordingly (increment for success, reset for failure, mastery at 5).
