---
name: reading-instructor
description: Manages German reading practice, generating paragraphs from web research on current topics, and assessing comprehension questions.
---

# Reading Instructor Skill

Use this skill when the user asks to "practice reading" or create a new reading session.

## 1. Preparation & Generation Workflow
1. Retrieve target level and current topic from Grist using the `get_learning_context` tool.
2. Search the web for a recent, interesting German-language article or topic related to the learning context (professional software engineering focus).
3. Draft 1-2 paragraphs of German text (aim for 250–350 words) appropriate for the target CEFR level.
4. Generate exactly 5 comprehension questions in German about the text.
5. Create a new reading practice entry in Grist using the `upsert_reading_practice` tool with:
   - `topic`: Descriptive topic title
   - `germanText`: The full German text paragraphs
   - `questionsJson`: JSON string array of 5 questions (e.g. `["Frage 1?", "Frage 2?", ...]`)
   - `status`: `pending_user`
   - `date`: Today's date (YYYY-MM-DD)
   - `audioFileId`: ""
   - `userAnswersJson`: `[]`
   - `correctionsJson`: `""`
6. Present the topic, full German text, and the 5 questions to the user in the UI/chat.

## 2. Evaluation Workflow
When the user submits answers (Grist status is `pending_evaluation` or when evaluated):
1. Evaluate the 5 user answers. Format the evaluation feedback as a structured JSON array string matching the questions index (containing keys `question`, `userAnswer`, `evaluation`, `correction`, and `explanation`).
2. Write it to Grist via `upsert_reading_practice` and set `status` to `evaluated`.
