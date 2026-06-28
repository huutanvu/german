# Feature Roadmap: German Learning Vault

This document outlines the planned feature set designed to align the German Learning Vault more closely with the scientific language learning principles described in [learning_methodology.md](file:///home/tvu/work/german/learning_methodology.md).

---

## 1. Time-Based Spaced Repetition (SM2 Algorithm)
### The Science
Exponential memory decay requires expanding review intervals based on feedback quality.
### Proposed Implementation
Add scheduling columns to the `Vocabulary` table and implement an offline/client-side interval calculator (similar to Anki's SM-2):
*   **Database Schema Updates**:
    *   `lastReviewedAt` (DateTime): Epoch timestamp of the last review.
    *   `intervalDays` (Integer): Current spacing interval (1, 2, 4, 8, 16 days, etc.).
    *   `easeFactor` (Float): Ease of recall multiplier (starts at 2.50).
*   **UI Integration**:
    *   Add grading buttons after writing a sentence: **Again** (incorrect), **Hard**, **Good**, **Easy**.
    *   Calculate the next review date dynamically:
        $$\text{New Interval} = \text{Current Interval} \times \text{Ease Factor}$$
    *   Filter the Vocabulary Review Queue to show only items where $\text{Date.now()} \ge \text{Next Review Date}$.

---

## 2. Dedicated Grammar Drill Board (Active Recall & Declensions)
### The Science
Comprehension does not equal grammatical production. Targeted exercises help solidify gender markers (der/die/das), case endings (Dativ/Akkusativ), and verb conjugations.
### Proposed Implementation
Create a new dashboard tab `/grammar` using a new Grist table `GrammarDrills`:
*   **Weekly Drills**:
    *   AI automatically generates 15 quick-fire grammar drills based on the user's active software engineering context.
    *   Focus on declensions (e.g., *"Wir arbeiten an ein____ neuen Feature (Optionen: -em, -en, -er)"*).
*   **Interactive Inputs**:
    *   Leverage the multi-type question layouts (single/multi/yes-no/gap fill) for rapid execution.
    *   Instant offline evaluation showing grammatical rules (e.g., explaining why *an* + *Dativ* is required for static locations).

---

## 3. Interactive Dialogue Simulator (Coworker Chat)
### The Science
Output practice is most effective when it mimics real-world scenarios. Dialogues prepare learners for actual professional interactions.
### Proposed Implementation
Extend the `WritingPractice` module into a multi-turn chat-like environment:
*   **Scenarios**:
    *   *Daily Standup Update*, *Asking for a Code Review*, *Discussing a Bug on Slack*.
*   **Implementation**:
    *   Introduce `WritingPracticeThread` table to store messages.
    *   The UI renders as a Slack/Teams chat interface.
    *   The user writes a message; the AI coworker replies (B1 German) and attaches inline grammatical corrections to the user's previous message.

---

## 4. Sentence-by-Sentence Translation Toggles
### The Science
Comprehensible input ($i+1$) is only effective if it remains comprehensible. Toggling translations on and off prevents cognitive fatigue.
### Proposed Implementation
Improve the `MarkdownDisplay` component to support sentence-level translation toggling:
*   Clicking a translation icon next to any German sentence in the reading passage opens a inline tool-tip showing the English or Vietnamese translation for just that sentence.
*   Keeps the text fully immersive in German while providing a safety net for difficult grammatical structures.

---

## 5. Visual Audio Playback Word Synchronization
### The Science
Connecting phonetics with spelling builds stronger word recognition pathways.
### Proposed Implementation
*   Generate audio files with word-level timestamps (using Speech-to-Text or forced aligner models).
*   Highlight the active word in the German text passage in real-time as the audio player progresses.

---

## Next Steps
> [!IMPORTANT]
> Please select which feature set should be prioritized for the next iteration:
> 1. **Time-Based Spaced Repetition (Anki-style Scheduler)**
> 2. **Dedicated Grammar Drill Board**
> 3. **Interactive Dialogue Simulator (Coworker Chat)**
