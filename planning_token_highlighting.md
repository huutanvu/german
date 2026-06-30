# Token Highlighting System: Design and Planning

This document defines the architecture for **AI-pre-computed text tokenization** in the German Learning Vault. Instead of parsing German text at runtime in the browser, the AI generates structured token metadata at creation time and stores it in Grist. The frontend becomes a pure renderer.

> **Key invariant**: The `lemma` field on every token is the **exact string that will be written to the `word` column of the `Vocabulary` table** when the user saves the word. It is therefore also the primary lookup key used by the drawer. The AI must produce a `lemma` that is Vocabulary-ready, not just linguistically canonical.

---

## 1. Motivation

The current approach reconstructs word boundaries and separable verb spans at runtime using heuristics (regex, prefix lookups). This has several weaknesses:

- Separable verb prefix detection is fragile and cannot reliably resolve ambiguous prefixes.
- Runtime parsing must repeat the same linguistic analysis on every page load.
- The browser has no ground truth about which tokens are semantically linked.

**The new approach**: the AI generates a `tokensJson` field for each text at creation time. Tokens are encoded as character-offset spans. The frontend renders purely from that data structure, with no linguistic logic of its own.

---

## 2. Core Data Types

### 2.1 `TokenSpan`

A single contiguous range within a string, expressed as a half-open `[start, end)` pair of **byte-safe Unicode character offsets** (0-indexed, counting from the first character of the full text string).

```ts
type TokenSpan = [number, number]; // [inclusive start, exclusive end]
```

**Examples for `"ich bin Anna"`:**

| Slice | Span |
|-------|------|
| `ich` | `[0, 3)` |
| ` ` (space) | `[3, 4)` |
| `bin` | `[4, 7)` |
| ` ` (space) | `[7, 8)` |
| `Anna` | `[8, 12)` |

> Spaces and punctuation are modelled as their own tokens with `type: "space"` or `type: "punctuation"`. This guarantees the union of all spans covers the entire string without gaps.

### 2.2 `Token`

Represents one linguistic unit. A token holds one or more spans. Tokens with a single span are simple words. Tokens with multiple spans are **separable verbs** whose prefix has been displaced to another position in the sentence.

```ts
interface Token {
  /** Unique sequential index within the annotated text (0-based). */
  index: number;

  /**
   * One or more character-offset spans.
   * Simple word: one span.
   * Separable verb: two spans — [verb-stem span, prefix span].
   * Order within the array is always [primary span, ...secondary spans].
   */
  spans: TokenSpan[];

  /**
   * Linguistic category of this token.
   * - "word"         : regular content word (noun, adjective, adverb, pronoun, etc.)
   * - "verb"         : non-separable finite/infinitive verb
   * - "separable"    : separable (trennbar) verb; spans.length === 2
   * - "name"         : proper noun (person, place, brand); non-interactive, no lookup
   * - "space"        : whitespace between tokens
   * - "punctuation"  : comma, period, question mark, etc.
   */
  type: "word" | "verb" | "separable" | "name" | "space" | "punctuation";

  /**
   * The Vocabulary-table word key for this token.
   * This is the exact value saved to the `Vocabulary.word` column on "Add to Queue"
   * and the primary lookup key in the drawer.
   *
   * Rules:
   * - Nouns      -> article + nominative singular  (e.g. "die Aufgabe", "der Code", "das Meeting")
   * - Verbs      -> bare infinitive                (e.g. "abholen", "sein", "übertragen")
   * - Adjectives -> uninflected base form          (e.g. "schnell", "wichtig")
   * - Pronouns, adverbs, conjunctions -> as-written surface form
   * - Omitted for tokens of type "name", "space", and "punctuation".
   */
  lemma?: string;
}
```

### 2.3 `AnnotatedText`

The top-level container stored as a JSON string in Grist.

```ts
interface AnnotatedText {
  /** The raw German text exactly as displayed. */
  text: string;

  /** Ordered array of tokens covering the full text. */
  tokens: Token[];
}
```

---

## 3. Encoding Examples

### 3.1 Simple sentence — `"ich bin Anna"`

```json
{
  "text": "ich bin Anna",
  "tokens": [
    { "index": 0, "spans": [[0, 3]],  "type": "word", "lemma": "ich" },
    { "index": 1, "spans": [[3, 4]],  "type": "space" },
    { "index": 2, "spans": [[4, 7]],  "type": "verb", "lemma": "sein" },
    { "index": 3, "spans": [[7, 8]],  "type": "space" },
    { "index": 4, "spans": [[8, 12]], "type": "name" }
  ]
}
```

*`Anna` is a proper noun — `type: "name"`, no `lemma`. The frontend renders it as plain non-interactive text.*

### 3.2 Separable verb — `"Ich hole Anna ab."`

The verb *abholen* is split: stem *hole* at `[4, 8)`, prefix *ab* at `[14, 16)`.

```json
{
  "text": "Ich hole Anna ab.",
  "tokens": [
    { "index": 0, "spans": [[0, 3]],           "type": "word",      "lemma": "ich" },
    { "index": 1, "spans": [[3, 4]],           "type": "space" },
    { "index": 2, "spans": [[4, 8], [14, 16]], "type": "separable", "lemma": "abholen" },
    { "index": 3, "spans": [[8, 9]],           "type": "space" },
    { "index": 4, "spans": [[9, 13]],          "type": "word",      "lemma": "Anna" },
    { "index": 5, "spans": [[13, 14]],         "type": "space" },
    { "index": 6, "spans": [[16, 17]],         "type": "punctuation" }
  ]
}
```

> The prefix span `[14, 16)` is **owned by the separable token at index 2**. It has no independent token of its own. The frontend highlights both spans simultaneously when the user interacts with token index 2. Saving this token writes `"abholen"` to `Vocabulary.word`.

### 3.3 Noun with article — `"Der Hund läuft schnell."`

Nouns carry their definite article in `lemma` regardless of the case used in the sentence.

```json
{
  "text": "Der Hund läuft schnell.",
  "tokens": [
    { "index": 0, "spans": [[0, 3]],   "type": "word",        "lemma": "der" },
    { "index": 1, "spans": [[3, 4]],   "type": "space" },
    { "index": 2, "spans": [[4, 8]],   "type": "word",        "lemma": "der Hund" },
    { "index": 3, "spans": [[8, 9]],   "type": "space" },
    { "index": 4, "spans": [[9, 15]],  "type": "verb",        "lemma": "laufen" },
    { "index": 5, "spans": [[15, 16]], "type": "space" },
    { "index": 6, "spans": [[16, 23]], "type": "word",        "lemma": "schnell" },
    { "index": 7, "spans": [[23, 24]], "type": "punctuation" }
  ]
}
```

*`Der` (index 0) is the article token — its lemma is `"der"`. `Hund` (index 2) is the noun token — its lemma is `"der Hund"`, which is the exact string saved to `Vocabulary.word`. The article in the sentence and the article embedded in the lemma are independent; the AI must always use the **nominative singular** article.*

### 3.3 Multi-clause text

For reading passages containing multiple sentences, spans continue incrementing across the full concatenated string. There is no per-sentence offset reset.

---

## 4. AI Generation Contract

When the AI generates or revises any German text (reading passages, writing corrections, speaking targets, vocabulary example sentences), it **must** also output the corresponding `AnnotatedText` object.

### 4.1 Required fields

| Field | Requirement |
|---|---|
| `text` | Exact copy of the German string as it will be stored and displayed |
| `tokens` | Complete, gapless coverage of every character in `text` |
| `spans` | Half-open `[start, end)` offsets; `end - start` equals the character count of the slice |
| `type: "separable"` | Exactly 2 spans: primary (verb stem) first, secondary (displaced prefix) second |
| `lemma` | Present on all `word`, `verb`, and `separable` tokens; absent on `space` and `punctuation` |

### 4.2 Validation rules

The following rules must be met before saving to Grist:

1. Every character index in `[0, text.length)` must be covered by exactly one token's span.
2. Spans within a single token must not overlap each other.
3. For `type: "separable"`, `spans.length` must equal exactly 2.
4. For all other types, `spans.length` must equal 1.
5. `token.index` values must be 0-based and strictly sequential with no gaps.

---

## 5. Grist Schema Changes

The following columns are added to each table that stores German text. No existing columns are removed or altered.

### `ReadingPractice`

| Column | Type | Notes |
|---|---|---|
| `tokensJson` | Text (new) | `JSON.stringify(AnnotatedText)` for `germanText` |

### `WritingPractice`

| Column | Type | Notes |
|---|---|---|
| `correctedTokensJson` | Text (new) | Tokens for `correctedParagraph` |

### `Vocabulary`

| Column | Type | Notes |
|---|---|---|
| `dailyUseTokensJson` | Text (new) | Tokens for `dailyUse` |
| `dailyUseTokensJson_vn` | Text (new) | Tokens for `dailyUse_vn` |
| `professionalUseTokensJson` | Text (new) | Tokens for `professionalUse` |
| `professionalUseTokensJson_vn` | Text (new) | Tokens for `professionalUse_vn` |

### `SpeakingPractice`

| Column | Type | Notes |
|---|---|---|
| `targetTokensJson` | Text (new) | Tokens for `targetText` |

---

## 6. Frontend Rendering Pipeline

The frontend's text rendering is reduced to a pure mapping step. No linguistic heuristics remain in the browser.

```
AnnotatedText
    |
    v
Build spanOwnerMap: Map<characterStart, tokenIndex>
    |
    v
Walk tokens sequentially:
    - type "space" | "punctuation"  -> render plain <span> (non-interactive)
    - type "name"                   -> render plain <span> (non-interactive, no hover, no drawer)
    - type "word"  | "verb"         -> render <InteractiveSpan tokenIndex={i}>
    - type "separable"              -> render stem span as <InteractiveSpan tokenIndex={i}>
                                       AND prefix span as <InteractiveSpan tokenIndex={i}>
                                       both share the same tokenIndex, same hover/active state
```

### 6.1 `InteractiveSpan` component contract

```tsx
interface InteractiveSpanProps {
  tokenIndex: number;
  text: string;           // substring from AnnotatedText.text[span[0]:span[1]]
  isActive: boolean;      // true when this token or any co-span is hovered/selected
  onActivate: () => void; // sets the active token and opens the lookup drawer
}
```

For a `separable` token, two `InteractiveSpan` elements are rendered with the same `tokenIndex`. When either is hovered, both activate (shared `isActive` state keyed by `tokenIndex`).

### 6.2 Lookup drawer

No changes to the drawer's data-fetching logic. The drawer receives the `lemma` string from the active token and queries Grist's `Vocabulary` table exactly as before.

---

## 7. Offline CLI Tokenization Workflow

The CLI agent is responsible for generating `AnnotatedText` whenever it writes German text to Grist.

```
AI generates German text
        |
        v
AI tokenizes the text -> produces AnnotatedText
        |
        +-> Validate: full coverage, no gaps, separable tokens have exactly 2 spans
        |
        v
upsert_* MCP tool call
        |
        +- germanText / correctedParagraph / targetText / etc. = AnnotatedText.text
        +- tokensJson / correctedTokensJson / targetTokensJson / etc. = JSON.stringify(AnnotatedText)
```

### Retroactive tokenization of existing records

Any record where a `tokensJson` column is `null` or empty string falls back to the legacy runtime parser on the frontend. The CLI agent can retroactively populate these columns by:

1. Querying all records where the relevant `*TokensJson` column is empty.
2. Running the tokenization step on the raw text.
3. Writing the result back with the appropriate `upsert_*` MCP tool.

---

## 8. Design Decisions and Rationale

| Decision | Rationale |
|---|---|
| Half-open `[start, end)` spans | Consistent with standard string slicing (`text.slice(start, end)`); avoids off-by-one errors |
| Spaces and punctuation as explicit tokens | Guarantees gapless coverage; frontend rendering is a simple sequential walk |
| Prefix span owned by the separable verb token | Avoids a ghost token with no independent meaning; one `token.index` = one lookup |
| `lemma` on every content token | Lookup drawer always queries by canonical dictionary form, not the inflected surface form |
| `AnnotatedText.text` must exactly match the stored raw text | Prevents offset drift between what is displayed and what the span numbers reference |
| JSON stored as Text in Grist | Grist has no native JSON column type; Text is the correct choice |
| No sentence-level offset reset | A single global offset space simplifies cross-sentence separable verb detection and avoids split-sentence edge cases |

---

## 9. Migration Path

1. Add all new `*TokensJson` columns to Grist tables. No existing data is disrupted.
2. Deploy the updated frontend. Records without tokens fall back silently to the legacy runtime parser.
3. On the next CLI run, the agent retroactively tokenizes all existing records.
4. Once all records carry tokens, remove the legacy runtime parser from the frontend codebase.

