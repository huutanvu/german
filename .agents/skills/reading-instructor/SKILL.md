---
name: reading-instructor
description: Manages German reading practice, generating paragraphs from web research on current topics, and assessing comprehension questions.
---

# Reading Instructor Skill

Use this skill when the user asks to "practice reading".

## 1. Preparation & Source Retrieval
- **Case A: User provides a paragraph or a URL link**:
  1. Retrieve the text content (if a URL, fetch content using reading/browsing tools).
  2. Analyze the text and break it down into vocabulary words.
  3. Filter vocabulary: Skip all A1 level words (e.g. *ich*, *du*, *arbeiten*, *sein*). For all remaining words, trigger the `vocabulary-instructor` capture workflow (assigning CEFR levels; routing level <= B1 to `inbox/` and B2+ to `complicated/`).
  4. Use this text as the reading practice text.
- **Case B: User asks generally**:
  1. Retrieve the current topic and target CEFR level from `/mnt/d/german/.agents/learning-context.md`.
  2. Perform a web search to find recent German articles/news w.r.t. the topic (focusing on professional software engineering).
  3. Draft/retrieve 1-2 paragraphs in German targeted at the B1 level (aim for **250–350 words**).
  4. Generate the corresponding audio read-out-loud file for the drafted text using the TTS helper script:
     `/mnt/d/german/.venv/bin/python /mnt/d/german/.agents/skills/speaking-instructor/scripts/generate_tts.py "Clean Text (without [[]] brackets)" "/mnt/d/german/speaking/YYYYMMDD_kebab-case-topic-name.mp3"`
  5. Analyze this text, extract non-A1 vocabularies, and route/save them following the `vocabulary-instructor` capture workflow.

## 2. Note Creation
1. Create a new note under the `reading/` directory named: `reading/YYYYMMDD_kebab-case-topic-name.md`.
2. Add YAML frontmatter:
   ```yaml
   ---
   date: YYYY-MM-DD
   type: reading
   tags: []
   ---
   ```
3. Insert the drafted 1-2 paragraphs.
4. Embed the generated audio file at the top of the note (or immediately below the title) using Obsidian link syntax: `![[speaking/YYYYMMDD_kebab-case-topic-name.mp3]]` so it is audible/playable directly in the note.
5. Add **at least 5 comprehension questions** at the bottom of the note (in German).
6. In chat, ask the user to read the note, draft answers to the questions fully in German, and reply when they are finished.

## 3. Evaluation & Correction Workflow
Once the user confirms they have finished:
1. Open the reading note and append the user's answers.
2. Go through the answers and:
   - Evaluate if the content of the answer is factually correct based on the reading text.
   - Write grammatical corrections and stylistic improvements directly below each answer in the note.
