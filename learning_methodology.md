# Language Learning Methodology and App Feature Mapping

This document details the scientific principles of language learning and how they map to the specific functionalities of our Grist-only German Learning Application.

---

## 1. Scientific Principles of Language Learning

Cognitive science and applied linguistics highlight several core pillars for efficient language acquisition:

### Spaced Repetition System (SRS)
- **The Science**: Memory decays over time following an exponential forgetting curve. Reviewing information at expanding intervals (1 day, 3 days, 8 days, etc.) shifts data from short-term to long-term memory.
- **Application**: The review queue only queries words that are not yet marked as permanent (correct count < 5).

### Active Recall (Retrieval Practice)
- **The Science**: Passive study (reading or multiple-choice recognition) creates a false sense of fluency. Forcing the brain to produce the target language from scratch strengthens retrieval neural paths.
- **Application**: Instead of passive flashcards, the review interface requires the user to write a unique sentence containing the target vocabulary word.

### Comprehensible Input (i+1)
- **The Science**: Popularized by Stephen Krashen, the comprehensible input theory states that we acquire language when we understand messages that are slightly above our current level (current level $i$ + new challenge $1$).
- **Application**: The reading practice dynamically drafts native-style texts targeted specifically at level B1, featuring vocabulary relevant to the user's software engineering background.

### Output and Correction Feedback Loop
- **The Science**: Output practice (speaking and writing) forces learners to identify gaps in their knowledge. However, output must be paired with accurate corrections to prevent incorrect grammar or pronunciation from becoming fossilized in long-term memory.
- **Application**: The sentence-by-sentence writing, reading answer grading, and speaking transcription feedback loops provide corrections on grammar, orthography, and word choice.

---

## 2. Competitive Features and App Implementations

| App | Core Strength | Our Grist-Only UI Implementation |
| :--- | :--- | :--- |
| **Anki** | Spaced repetition algorithms | Vocabulary table status (`new`/`revised`/`permanent`) and `correctCount` tracking |
| **Babbel** | Real-world software context | Contextual software engineering topics mapped to vocabulary, writing, and speaking practices |
| **LingQ** | Immersive reading with audio | Reading practice module linking custom texts, target vocabulary extraction, and TTS audio playbacks |
| **Busuu** | Sentence-by-sentence corrections | Structured writing board that sends submissions to Grist for detailed AI corrections |
| **Pimsleur** | Speak-and-response training | Speaking practice page leveraging browser MediaRecorder to record audio, upload to Publitio, and receive pronunciation assessments |

---

## 3. Recommended Learning Workflow

The best way to learn German efficiently in this architecture is to follow a daily three-step loop:

### Input Phase (Reading & Listening)
1. Read the newly generated B1 text on the target software engineering topic.
2. Listen to the companion read-aloud TTS audio from Publitio to associate spelling with correct pronunciation.
3. Allow the system to extract and capture new words into the Grist Vocabulary table.

### Active Output Phase (Writing & Speaking)
1. Complete the vocabulary reviews by writing unique sentences for the daily 10 words.
2. Write a paragraph on the active writing topic.
3. Record yourself speaking/reading out loud.

### Correction Review Phase (Feedback)
1. After the offline CLI agent runs and grades the submissions, review the sentence-by-sentence corrections in the UI.
2. Re-practice the words that were flagged with pronunciation errors or grammatical issues.
