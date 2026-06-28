# German Word Interactive Lookup and Separable Verb Reconstruction Plan

This document outlines the UX design and algorithm structure for implementing interactive word lookups (via right-click or long-press) and separable verb parsing in the German Learning Vault frontend.

---

## 1. User Experience (UX) Flow

### Interactive Sentence Parsing
- German texts (in reading or writing views) will be split into sentences and then into individual words.
- Each word is wrapped in an interactive `<span>` element:
  - Supports hover highlighting.
  - Listeners for `onContextMenu` (to override browser right-click on desktop).
  - Touch event listeners (`onTouchStart`, `onTouchEnd`) to trigger long-press events on mobile devices.

### Sidebar Lookup Panel
- A drawer slides in from the right edge of the screen when a word is clicked/triggered.
- **State A: Word Exists in Vocabulary**:
  - Displays word, CEFR level, grammar classification, meanings list, daily use case, professional use case, tips, and cautions.
- **State B: Word Does Not Exist**:
  - Displays a message: "Word not found in your library."
  - Displays a button: **[Add to Review Queue]**.
  - Clicking this button registers the word in Grist's `Vocabulary` table with `type: "new"`. The offline CLI agent will populate its details during the next execution.

---

## 2. Separable Verb Detection Algorithm

Separable verbs (*trennbare Verben*) split their prefixes to the end of the clause in main clauses. For example:
- *anstehen* -> "Welche Aufgaben steht heute **an**?" (Clicked: *steht*, Prefix: *an*)
- *übertragen* -> "...Code auf die Server **übertragen**." (Infinitive form, no split)

### Step-by-Step Reconstruction Helper
We define a utility function `findGermanInfinitive(clickedWord, sentenceText)`:

1. **Clean Input**: Strip punctuation from the clicked word and lower-case it.
2. **Verb Root Mapping**: Check if the clicked word is a conjugated verb form. Maintain a dictionary of common verb conjugate mappings to their roots:
   - *steht* / *stand* / *gestanden* -> *stehen*
   - *trägt* / *trug* / *getragen* -> *tragen*
   - *gibt* / *gab* / *gegeben* -> *geben*
   - *nimmt* / *nahm* / *genommen* -> *nehmen*
   - *geht* / *ging* / *gegangen* -> *gehen*
   - *sieht* / *sah* / *gesehen* -> *sehen*
   - *kommt* / *kam* / *gekommen* -> *kommen*
   - *bringt* / *brachte* / *gebracht* -> *bringen*
3. **Prefix Extraction**:
   - Split the sentence into words and clean punctuation.
   - List common separable prefixes: *ab*, *an*, *auf*, *aus*, *bei*, *ein*, *los*, *mit*, *nach*, *her*, *hin*, *vor*, *weg*, *zu*, *zurück*, *zusammen*.
   - Check if any prefix appears at the end of the sentence or clause (before commas, periods, or question marks).
4. **Reconstruct Infinitive**:
   - If a root is found and a prefix is matched at the end of the clause, combine them: `prefix + root` (e.g. *an* + *stehen* = *anstehen*).
   - Otherwise, fall back to the clicked word or its direct infinitive.

---

## 3. Database & Offline Workflow Integration

### Grist Updates
- When the user clicks **[Add to Review Queue]**, a record is inserted into the `Vocabulary` table.
- Initial fields:
  - `word`: Reconstructed infinitive
  - `type`: `new`
  - `correctCount`: 0
  - `level`: Current learning context level (e.g. `B1`)
  - All other fields (meanings, grammar, uses) are left blank.

### Offline CLI Agent (AGY) Processing
- During the next local run, the CLI agent scans for Vocabulary records where meanings are empty or `type == "new"`.
- It performs LLM queries using the word and the original sentence context to generate:
  - Correct grammar details.
  - English translations.
  - Targeted professional (software engineering) and daily example sentences.
- Updates Grist with these fields.
