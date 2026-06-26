# Project Rules: German Learning Zettelkasten Vault

This folder `/mnt/d/german/` is a dedicated Obsidian vault for learning German, focusing on vocabulary, grammar, writing, and professional working environments. All agents MUST strictly follow these rules.

## 1. Directory Structure
- `inbox/`: Capture zone for new vocabulary words and phrases to be tested/processed.
- `permanent/`: For vocabulary words mastered (answered correctly 5 times).
- `revised/`: For vocabulary words that need active review.
- `complicated/`: For vocabulary words above the user's current level (e.g. B2+).
- `writing/`: For writing practice notes.
- `reading/`: For reading practice notes.
- `speaking/`: For speaking practice notes and recordings.

## 2. File Naming Conventions
- **Vocabulary Notes**: Lower kebab-case of the German word, e.g., `arbeiten.md`. (No dates).
- **Writing Practice Notes**: Date prefixed kebab-case of the topic, e.g., `YYYYMMDD_topic-name.md`.
- **Reading Practice Notes**: Date prefixed kebab-case of the topic, e.g., `YYYYMMDD_reading-topic-name.md`.
- **Speaking Practice Notes**: Date prefixed kebab-case of the topic, e.g., `YYYYMMDD_speaking-topic-name.md`.

## 3. Session Context & Memory
- Read `/mnt/d/german/.agents/learning-context.md` at the start of every session to fetch the current topic, target level (default B1), and user context (Software Engineer).
- Update the topic in this file when the user inputs new vocabularies that reveal a specific topic/context.
- Ensure all practice (reading and writing) aligns with the current topic, focusing on software engineering and professional environments.
- The user is currently at B1 level for review filtering purposes.

## 4. Specialized Skills
For executing specific learning modules, activate and refer to the custom skills in `.agents/skills/`:
- **Vocabulary Review**: Trigger the `vocabulary-instructor` skill.
- **Writing Practice**: Trigger the `writing-instructor` skill.
- **Reading Practice**: Trigger the `reading-instructor` skill.
- **Speaking Practice**: Trigger the `speaking-instructor` skill.

## 5. Note Writing Styles
- **No Emojis or Icons**: Do not use emojis, icons, or emoticons.
- **Formatting Tools**: Use bold, quotes, code blocks, and italics for clean structure.
- **Cleanliness**: Keep notes short, clean, bulleted, and focused.

## 6. Interaction Rules & Output Constraints
- **Clarification Over Guessing**: Ask if unsure.
- **Concise Chat Responses**: Keep chat responses extremely short and clean. Do not print note contents or verbose explanations. Only output a brief pointer of what note was created or updated.
