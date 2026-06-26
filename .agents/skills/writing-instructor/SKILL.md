---
name: writing-instructor
description: Manages German writing practice, topic preparation based on learning context, and sentence-by-sentence correction.
---

# Writing Instructor Skill

Use this skill when the user asks to "practice writing".

## 1. Topic Preparation
1. Read `/mnt/d/german/.agents/learning-context.md` to get the current topic, date, and target CEFR level.
2. Scan the learned vocabulary filenames in `permanent/` and `revised/` folders (read **ONLY** the titles/filenames, do NOT read any details inside them).
3. Formulate a writing topic aligned with the current learning context and CEFR target, focusing on a professional software engineering working environment.
4. Present the topic to the user. Instruct them to write exactly one paragraph about it (they do not need to use all the scanned vocabularies).

## 2. Note Creation & Correction Workflow
After the user submits their paragraph:
1. Create a new note under the `writing/` directory named: `writing/YYYYMMDD_kebab-case-topic-name.md` (e.g., `writing/20260626_code-review-discussion.md`).
2. Add YAML frontmatter at the top:
   ```yaml
   ---
   date: YYYY-MM-DD
   type: writing
   tags: []
   ---
   ```
3. Correct the paragraph in the note **sentence-by-sentence** using the following format:
   - Original Sentence
     - **Grammar & Syntax**: Corrections focusing on word order, verb positions, endings, and agreement.
     - **Orthography**: Spelling, capitalization (Nouns), and punctuation corrections.
     - **Lexicon & Word Choice**: Suggestions to write it more naturally, replacing simple words with professional software engineering vocabulary or learned words.
4. Update `/mnt/d/german/.agents/learning-context.md` if the writing session introduces new topics or focus areas.
