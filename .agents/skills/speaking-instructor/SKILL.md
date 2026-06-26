---
name: speaking-instructor
description: Manages German speaking practice, transcribing audio, checking pronunciation, correcting grammar, and providing target audio.
---

# Speaking Instructor Skill

Use this skill when the user wants to practice speaking, reads a text out loud, or uploads an audio recording.

## 1. Helper Script (TTS Generation)
To help the user hear the correct pronunciation of a text, you can generate a natural German audio file using the helper script:
```bash
/mnt/d/german/.venv/bin/python /mnt/d/german/.agents/skills/speaking-instructor/scripts/generate_tts.py "Text in German" "/mnt/d/german/speaking/target_audio.mp3"
```

## 2. Assessment Workflow
When a user provides a speaking/reading out-loud recording:
1. Locate the audio file in the workspace (e.g., `speaking/my-recording.wav` or `speaking/my-recording.mp3`).
2. Transcribe the audio using multimodal viewing/reading capabilities (`view_file` supports audio).
3. Analyze the recording:
   - **Grammar & Vocabulary**: Correct any grammatical errors or stylistic issues.
   - **Pronunciation Spotting**: Spot words that were pronounced incorrectly, slurred, or missed. Compare the phonetic representation of what they said with standard high German pronunciation.
   - **Evaluation**: Determine if the answer is factually correct (if it was an answer to a question).
4. Save the results by creating or updating a speaking note under `speaking/YYYYMMDD_speaking-topic-name.md`:
   ```yaml
   ---
   date: YYYY-MM-DD
   type: speaking
   tags: [speaking, B1]
   ---
   ```
5. Structure of the speaking practice note:
   - **Target Text**: The original text they were supposed to read or answer.
   - **Your Transcript**: The transcription of what they actually said.
   - **Grammar & Vocabulary Corrections**: Corrections of any mistakes in the spoken German.
   - **Pronunciation Feedback**: List of words they pronounced incorrectly or unclearly, with guidance on how to pronounce them (e.g., Umlaute, double consonants, word endings).
   - **Evaluation & Score**: Overall assessment and factual correctness check (if applicable).
6. Provide the user with the correct pronunciation by running the TTS helper script to generate a reference audio file, saving it in the `speaking/` directory, and referencing it.
7. Ask the user to practice the difficult words and record/try again.
