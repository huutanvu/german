---
name: vocabulary-instructor
description: Manages German vocabulary capture, testing, and spaced repetition review workflow.
---

# Vocabulary Instructor Skill

Use this skill when capturing new German vocabulary or reviewing existing vocabulary.

## 1. Frontmatter YAML Format
Every vocabulary note in `inbox/`, `revised/`, `permanent/`, or `complicated/` must start with:
```yaml
---
type: new | revised | permanent
correct_count: 0
level: A2 | B1 | B2 | C1
tags: []
---
```

## 2. Vocabulary Capture Workflow
When a new German word/phrase is identified or entered:
1. Determine the CEFR level of the word (A1, A2, B1, B2, C1, C2).
2. Route and filter the word based on how it was entered:
   - **If explicitly requested/entered by the user**: Do NOT skip the word (even if it is A1 level). Create the note in the `inbox/` directory as `inbox/german-word.md` for levels <= B1, and in the `complicated/` directory as `complicated/german-word.md` for levels > B1 (B2+).
   - **If automatically extracted from a paragraph/URL**: Skip A1 level words entirely (e.g. *ich*, *du*, *arbeiten*, *sein* are skipped). For non-A1 words, create the note in the `inbox/` directory for levels <= B1, and in the `complicated/` directory for levels > B1 (B2+).
3. Set frontmatter: `type: new`, `correct_count: 0`, and the determined `level` value.
4. Put the following content (English explanations, short, bulleted):
   - **Meanings**: Direct translations.
   - **Grammar**:
     - *Nouns*: Article (der/die/das), plural form, and genitive form.
     - *Verbs*: Perfekt auxiliary verb (haben/sein) + past participle, and major irregular conjugations.
     - *Other parts of speech*: Part of speech details, and comparative/superlative if applicable.
   - **Daily Use Case**: Example sentence in daily life.
   - **Professional Use Case**: Example sentence in a professional working environment (focusing on Software Engineering if context applies).
   - **Tips**: Correct usage, associated prepositions, and grammatical cases.
   - **Caution**: Pitfalls, false friends, or common mistakes.

## 3. Vocabulary Review Workflow
When the user asks to "review":
1. Pick up the latest maximum 10 words to review from the `inbox/` or `revised/` folders whose level is **<= user's current level (B1)**. Go through them **1-by-1**. Do NOT review any words in the `complicated/` folder until the user's level is updated.
2. For each word, ask the user to write a sample sentence.
3. Correct the user's sentence. Keep corrections and explanations extremely short and concise, unless the user asks for more explanation.
4. Evaluate:
   - **If they fail or cannot answer**: Set `type` to `revised` and reset `correct_count` to 0.
   - **If they answer correctly**: Increment `correct_count` by 1.
   - **If `correct_count` reaches 5**: Change `type` to `permanent` and move the file to the `permanent/` folder.
