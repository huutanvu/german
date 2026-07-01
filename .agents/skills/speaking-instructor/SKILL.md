---
name: speaking-instructor
description: Manages German speaking practice, transcribing audio, checking pronunciation, correcting grammar, and providing target audio.
---

# Speaking Instructor Skill

Use this skill when the user wants to practice speaking or read text out loud.

## 1. Helper Script (TTS Generation)
To generate high German audio for reference pronunciation, run the python script:
```bash
python /home/tvu/work/german/.agents/skills/speaking-instructor/scripts/generate_tts.py "Text in German" "/home/tvu/work/german/speaking/target_audio.mp3"
```

## 2. Assessment Workflow
When a speaking practice record is in `pending_assessment` status:
1. Retrieve the user's recorded audio file URL or ID.
2. Transcribe the audio.
3. Analyze pronunciation accuracy, identify mispronounced words, and correct grammar.
4. Use the TTS helper script to generate the correct pronunciation audio, upload it to Publitio, and retrieve the new file ID.
5. Save the assessment using `upsert_speaking_practice`:
   - `transcript`: Transcribed speech
   - `grammarFeedback`: Detailed grammatical corrections
   - `pronunciationFeedback`: Detailed pronunciation tips/corrections
   - `targetAudioFileId`: Publitio file ID of the generated TTS reference audio
   - `score`: Score out of 100
   - `status`: `assessed`

## 3. Speaking Exercise Generation Workflow
When creating a new speaking exercise:
1. Formulate the `targetText` (raw German text).
2. Generate the tokenization structure `targetTokensJson` matching the `AnnotatedText` schema:
   - `text`: Exact target text.
   - `tokens`: Array of objects:
     - `index`: 0-based sequential index.
     - `spans`: Array of `[start, end)` character offsets (inclusive start, exclusive end). For separable verbs, use exactly 2 spans: `[stem_span, prefix_span]`. For all other tokens, use exactly 1 span.
     - `type`: `"word" | "verb" | "separable" | "name" | "space" | "punctuation"`.
     - `lemma` (omitted for name, space, and punctuation): Nouns must include definite article (e.g., "der Hund"), verbs must be bare infinitive (e.g., "abholen"), adjectives must be uninflected base form (e.g., "schnell"), articles (e.g., der/die/das/dem/den/des/ein/eine/einem/einen/einer) must match exactly the clean word itself (e.g., "dem" -> "dem", "den" -> "den").
3. Create a speaking practice entry in Grist using the `upsert_speaking_practice` tool with:
   - `topic`: Descriptive topic title
   - `targetText`: The German reference text
   - `targetTokensJson`: JSON object matching the `AnnotatedText` schema above (do not stringify, pass as a raw JSON object)
   - `status`: `pending_recording`
