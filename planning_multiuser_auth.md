# Multi-User Auth & Service Architecture Plan
## German Learning Vault

---

## 1. Overview of Changes

Three orthogonal concerns are addressed here:

1. **Authentication** — Supabase Auth (JWT-based) gates the entire app.
2. **Multi-user data isolation** — every learning record is scoped to a `userId`.
3. **Profession-aware vocabulary** — a new `VocabularyUsage` table extends vocabulary entries with profession-specific examples, decoupled from the core word record.
4. **Service split** — Grist and Flotiq API call budgets are shared intelligently across projects to stay within subscription limits.

---

## 2. Authentication: Supabase

### Why Supabase
- Already referenced in the current `planning.md` (line 38).
- Provides JWT tokens usable for both frontend session management and server-side row-level security (RLS).
- Free tier: 50,000 monthly active users, 500 MB database — sufficient for a family/small-group app.

### Auth Flow

```
Browser → Supabase Auth (email/password or magic link)
        ← JWT access token (short-lived, 1h)
        ← Refresh token (stored in httpOnly cookie)

Browser → Next.js API Route (with Bearer token)
        → Middleware validates JWT via Supabase SDK
        → Grist / Flotiq calls are made server-side only
        ← Response JSON to browser
```

> [!IMPORTANT]
> Grist and Flotiq API keys must NEVER be exposed client-side. All data fetching must go through Next.js API routes (server-side) after JWT validation. This is a breaking change from the current direct-client architecture.

### User Profile Table (Supabase)

Supabase maintains its own `auth.users` table. We extend it with a `profiles` table in the Supabase public schema:

```sql
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  displayName text not null,
  profession  text not null default 'software_engineer',
  targetLevel text not null default 'B1',   -- A1..C2
  createdAt   timestamptz default now()
);

-- Row-level security: users can only read/update their own profile
alter table public.profiles enable row level security;
create policy "Own profile" on public.profiles
  using (auth.uid() = id);
```

**Profession values (extensible list):**
- `software_engineer`
- `healthcare_professional`
- `nurse`
- `teacher`
- `legal_professional`
- `finance_professional`
- `general`

### Session Propagation to Grist/Flotiq

Since Grist and Flotiq do not speak Supabase JWT, the mapping works like this:

```
Supabase JWT (userId) → Next.js API Route middleware
                      → Injects userId as a filter field on every Grist query
                      → Grist records already contain a userId text column
```

---

## 3. Data Model Redesign

### 3.1 Grist — What Stays, What Changes

Every existing table gains a `userId` text column (stores the Supabase `auth.users.id` UUID as a string). This is the only multi-tenancy mechanism at the Grist level — Grist has no native row-level security, so enforcement happens in the API route layer.

#### Modified Tables (add `userId` column)

| Table | New Column | Notes |
|-------|-----------|-------|
| `Vocabulary` | `userId` (Text) | Scopes words to a user |
| `VocabularyReviews` | `userId` (Text) | Scopes reviews |
| `WritingPractice` | `userId` (Text) | Scopes sessions |
| `ReadingPractice` | `userId` (Text) | Scopes sessions |
| `SpeakingPractice` | `userId` (Text) | Scopes sessions |
| `GrammarPractice` | `userId` (Text) | Scopes sessions |
| `LearningContext` | `userId` (Text) | One row per user (upsert by userId) |

#### Dropped from `LearningContext`
- `professionalEnvironment` — this moves to the Supabase `profiles.profession`.

### 3.2 New Grist Table: `VocabularyUsage`

This table links a vocabulary word to profession-specific example sentences and tips. One vocabulary word can have many usage rows (one per profession).

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer (auto) | Row ID |
| `vocabId` | Reference → `Vocabulary` | The base word |
| `profession` | Choice | `software_engineer`, `nurse`, `teacher`, etc. |
| `dailyUse` | Text | Daily example sentence (English translation in brackets) |
| `dailyUse_vn` | Text | Same sentence (Vietnamese translation in brackets) |
| `professionalUse` | Text | Profession-specific example sentence (English) |
| `professionalUse_vn` | Text | Same sentence (Vietnamese) |
| `tips` | Text | Profession-relevant prepositions/cases (English) |
| `tips_vn` | Text | Same tips (Vietnamese) |
| `caution` | Text | Common pitfalls in this professional context (English) |
| `caution_vn` | Text | Same (Vietnamese) |
| `createdAt` | DateTime | |

> [!NOTE]
> The existing `dailyUse`, `professionalUse`, `tips`, and `caution` columns on `Vocabulary` are **retained** as the "general/software_engineer" baseline. The `VocabularyUsage` table provides overrides for other professions. This avoids a breaking migration and lets the existing CLI workflow continue populating the base row while new profession-specific entries are generated on demand.

### 3.3 Fallback Logic for `Vocabulary` Core

The `professionalUse` and `professionalUse_vn` columns in `Vocabulary` serve as the **default profession** (software engineer) baseline. They remain as the fallback when no `VocabularyUsage` row exists for the user's profession.

### 3.4 Relationship Diagram

```
Supabase auth.users
       │ 1:1
       ▼
 profiles (Supabase)          LearningContext (Grist)
 ─ id (uuid)              ─── userId (Text FK)
 ─ displayName            ─── targetLevel
 ─ profession             ─── currentTopic
 ─ targetLevel            ─── updatedAt

Vocabulary (Grist)
 ─ id
 ─ userId
 ─ word
 ─ meanings / grammar / dailyUse / professionalUse (baseline)
 ─ isProcessed
        │ 1:N
        ▼
VocabularyUsage (Grist)
 ─ id
 ─ vocabId → Vocabulary.id
 ─ profession (Choice)
 ─ dailyUse / professionalUse / tips / caution (per-profession)

VocabularyReviews (Grist)
 ─ id
 ─ vocabId → Vocabulary.id
 ─ userId
 ─ userSentence / correctedSentence / correctionFeedback
 ─ status / reviewedAt
```

---

## 4. Service Split: Grist vs. Flotiq

### Current Situation
- Resume Generator uses Grist for tabular data (Jobs, Facts, Sections) and Flotiq for structured JSON templates.
- German Learning uses Grist exclusively.
- Both projects share the same Grist account → combined API call budget.

### Grist Plan Limits (Pro: $10/user/month)
- **40,000 API calls / document / day**
- **100,000 rows / document**

### Flotiq Plan Limits (Free tier)
- **2,000,000 API calls / month** (~66,666/day)
- **2,500 content objects / type**
- **5 GB storage**

### Split Strategy

| Concern | Service | Rationale |
|---------|---------|-----------|
| German Learning — all tables | **Grist** | Tabular, mutable, queried/filtered often; fits Grist's strengths |
| Resume Generator — Jobs, Facts, JobSections | **Grist** | Same — tabular, write-heavy |
| Resume Generator — Templates | **Flotiq** | Structured JSON blobs, rarely written, frequently read; fits Flotiq's headless CMS model |
| German Learning — Static reference content (profession descriptions, UI copy) | **Flotiq** | Write-once, read-many; offloads Grist reads |
| Audio/media files | **Publitio** | Unchanged |
| Auth/user profiles | **Supabase** | Auth is Supabase's core product |

### New Flotiq Content Type for German App: `profession_reference`

Rather than storing profession descriptions in Grist (wasting row quota and API calls on static content), store them in Flotiq:

```
profession_reference
─ id (auto)
─ slug (Text, unique): e.g. "software_engineer"
─ displayName (Text): e.g. "Software Engineer"
─ description (Text): Short blurb shown in the UI
─ sampleContext (Textarea): Example German workplace sentences for AI prompt context
─ icon (Text): Icon identifier for the UI
```

This moves ~7 rows of static data (one per profession) to Flotiq, where they are fetched once and cached client-side. Grist API budget is preserved for the high-frequency operations (vocabulary reads, review writes).

### Projected API Call Budget

**Grist (German App document):**

| Operation | Frequency | Daily Calls |
|-----------|-----------|------------|
| Vocabulary list (per session) | 5 sessions/day | 5 |
| Vocab review saves | 20 words/day | 20 |
| Writing/Reading/Speaking queries | 3/day | 9 |
| LearningContext reads | 5/day | 5 |
| AI agent batch processing | 2 runs/day × 10 ops | 20 |
| **Total German App** | | **~60/day** |

**Grist (Resume Generator document):**

| Operation | Frequency | Daily Calls |
|-----------|-----------|------------|
| Job/section reads and writes | ~50/day | 50 |
| Facts reads | ~10/day | 10 |
| **Total Resume Generator** | | **~60/day** |

Both documents are well within the 40,000/document/day limit. The split into separate documents is already in place (they are different Grist documents).

**Flotiq (shared account):**

| Usage | Calls/day |
|-------|-----------|
| Resume templates (Resume Generator) | ~20 |
| Profession references (German App, cached) | ~10 |
| **Total** | **~30/day** |

Far below the 66,666/day limit.

---

## 5. Implementation Phases

### Phase 0: Supabase Setup (1 day)
1. Create Supabase project.
2. Enable Email auth (magic link preferred for simplicity).
3. Create `profiles` table with RLS as shown in §2.
4. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`.
5. Add `SUPABASE_SERVICE_ROLE_KEY` for server-side admin operations.

### Phase 1: Next.js Auth Middleware (1 day)
1. Install `@supabase/supabase-js` and `@supabase/ssr`.
2. Add `middleware.ts` at the Next.js root to verify JWT on every request to `/api/*` and protected pages.
3. Create `/api/auth/callback` route for OAuth/magic-link redirect handling.
4. Create `(auth)/login` and `(auth)/register` pages.
5. Replace all direct Grist/Flotiq calls in the frontend with calls to Next.js API routes.

### Phase 2: Grist Schema Migration (0.5 day)
1. Add `userId` (Text) column to all 7 tables listed in §3.1.
2. Backfill existing rows with a placeholder userId (e.g., the owner's Supabase UUID) using a one-time migration script.
3. Update all MCP tool implementations to accept and filter by `userId`.
4. Create the new `VocabularyUsage` table.

### Phase 3: Flotiq — Profession Reference Content Type (0.5 day)
1. Create `profession_reference` content type in Flotiq.
2. Seed 7 profession entries via the Flotiq REST API.
3. Add a cached read in the frontend: `GET /api/v1/content/profession_reference` called once at app load.

### Phase 4: Vocabulary Usage Workflow (1–2 days)
1. Update the vocabulary capture flow so that when a word is added, a background job generates `VocabularyUsage` rows for the user's profession (and optionally a general one).
2. Update the MCP skill `vocabulary-instructor` to generate profession-specific examples when processing `isProcessed = false` records, reading the user's profession from `LearningContext` or a passed parameter.
3. Update the frontend vocabulary display to merge the `VocabularyUsage` row matching the user's profession (falling back to the `Vocabulary` baseline).

### Phase 5: UI Updates (1 day)
1. Add login/logout UI.
2. Add profession selector on the profile settings page (reads Supabase `profiles`, writes back via `/api/profile`).
3. Scope all API route handlers to inject `userId` from the validated JWT before querying Grist.
4. Update the dashboard to show the user's name and profession.

---

## 6. Security Considerations

> [!CAUTION]
> Never expose Grist or Flotiq API keys to the browser. All calls must be proxied through Next.js API routes.

| Risk | Mitigation |
|------|-----------|
| Cross-user data leakage | Every Grist query in API routes must include `?filter={"userId":["<uid>"]}` |
| Token theft | Use `httpOnly` cookies for refresh tokens; short-lived (1h) access tokens |
| Admin bypass | Supabase service role key is server-only; never sent to client |
| Flotiq write abuse | Use read-only Flotiq key client-side; RW key stays server-only |

---

## 7. Environment Variables Summary

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...          # safe for client
SUPABASE_SERVICE_ROLE_KEY=eyJ...              # server-only

# Grist (server-only — remove NEXT_PUBLIC_ prefix)
GRIST_URL=https://docs.getgrist.com/api
GRIST_DOC=your-german-doc-id
GRIST_KEY=your-api-key

# Flotiq
NEXT_PUBLIC_FLOTIQ_URL=https://api.flotiq.com
NEXT_PUBLIC_FLOTIQ_KEY=your-read-only-key    # client-side reads for static content
FLOTIQ_RW_KEY=your-rw-key                    # server-only writes

# Publitio (unchanged)
PUBLITIO_API_KEY=...
PUBLITIO_API_SECRET=...
```

> [!WARNING]
> Strip `NEXT_PUBLIC_` from `GRIST_URL`, `GRIST_DOC`, and `GRIST_KEY`. These must become server-only variables now that all Grist access goes through API routes.

---

## 8. Open Questions

1. **Invitation model**: Should users self-register, or should the owner invite family members? Supabase supports both — recommend starting with magic-link invitations to restrict sign-ups.
2. **Shared vocabulary**: Should vocabulary added by one user be visible to others (as a shared library), or fully isolated? Recommendation: isolated by default, with an optional `isShared` flag on `Vocabulary` rows later.
3. **AI agent (CLI) multi-user**: The offline AGY agent currently has no concept of userId. It will need a `--user` flag or a config file mapping to process the correct user's pending records.
4. **Flotiq account sharing**: If the resume generator and the German app are in the same Flotiq account, they share the 2M call budget but use different content types. This is fine for now; separate accounts can be set up if either project grows significantly.
