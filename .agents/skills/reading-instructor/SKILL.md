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
4. Generate exactly 10 questions in German with increasing difficulties (1 to 10), focusing on text comprehension and German grammar (articles, endings, prepositions, case declensions like Dativ/Akkusativ/Genitiv, etc.).
5. Create a new reading practice entry in Grist using the `upsert_reading_practice` tool with:
   - `topic`: Descriptive topic title
   - `germanText`: The full German text paragraphs
   - `questionsJson`: JSON string array of 10 question objects matching the schema: `{"id": number, "type": "single_selection" | "multi_selection" | "yes_no" | "fill_in_gap", "question": string, "options": string[], "correct_answer": string | string[], "difficulty": number, "explanation": string, "explanation_vn": string}` (Note: for `yes_no`, options must be exactly `["Ja", "Nein"]`)
   - `status`: `pending_user`
   - `date`: Today's date (YYYY-MM-DD)
   - `audioFileId`: ""
   - `userAnswersJson`: `[]`
   - `correctionsJson`: `""`
   - `correctionsJson_vn`: `""`
6. Present the topic, full German text, and the 10 questions to the user in the UI.

## 2. Evaluation Workflow
When the user submits answers (Grist status becomes `evaluated`):
1. Answers are checked and graded offline directly on the client side against the `correct_answer` fields in `questionsJson`.
2. Evaluations and translations are stored in Grist's `correctionsJson` (English explanations) and `correctionsJson_vn` (Vietnamese explanations).
3. User can click "Redo" to reset `userAnswersJson` to initial values, clear corrections, and reset status to `pending_user` to redo the exercise.
