# Setup Guide: Multi-User Auth & Service Architecture

This document covers every step you need to complete **from your side** to activate the multi-user authentication, profession-aware vocabulary, and Flotiq integration.

---

## 1. Supabase Setup

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New Project**, choose a name (e.g. `german-learning`), set a strong database password, and pick a region close to you.
3. Wait for the project to provision (~2 minutes).

### 1.2 Get API Keys

Go to **Settings → API** in the Supabase dashboard.

| Key | Where it goes |
|-----|--------------|
| **Project URL** | `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` |
| **anon / public key** | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` |

> The project URL and anon key are already in your `.env.local`.

### 1.3 Create the `profiles` Table

Go to **SQL Editor** in your Supabase dashboard and run this SQL:

```sql
-- Create profiles table extending auth.users
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  "display_name" text not null default '',
  profession  text not null default 'software_engineer',
  "target_level" text not null default 'B1',
  "createdAt" timestamptz default now()
);

-- Enable Row-Level Security
alter table public.profiles enable row level security;

-- Policy: users can only read/update their own profile
create policy "Own profile read" on public.profiles
  for select using (auth.uid() = id);

create policy "Own profile write" on public.profiles
  for all using (auth.uid() = id);
```

### 1.4 Enable Email Authentication

Go to **Authentication → Providers** and ensure **Email** is enabled.

For a family/private app, you may want to:
- Disable **Confirm email** (Authentication → Email Templates → toggle off "Confirm email")  
- OR keep it on and use **magic links** (passwordless)

### 1.5 Create User Accounts

Go to **Authentication → Users → Invite user** to create accounts for each family member. Each user gets an email with a link to set their password.

---

## 2. Grist: Add `userId` Column to All Tables

The Grist tables need a `userId` (Text) column added to each of the 7 tables. You can do this via the Grist UI or the migration script.

### Option A: Via the Grist UI (manual)

For each of these tables, add a column named `userId` of type **Text**:
- `Vocabulary`
- `VocabularyReviews`
- `WritingPractice`
- `ReadingPractice`
- `GrammarPractice`
- `SpeakingPractice`
- `LearningContext`

### Option B: Via Migration Script (recommended)

After adding the columns via the UI, run the backfill script to fill in your userId on all existing rows:

```bash
# 1. Get your Supabase User UUID from: Authentication → Users → click your user → copy the UUID

# 2. Run the migration
cd /home/tvu/work/german
node scripts/migrate_grist_userid.js <your-supabase-user-uuid>
```

Example:
```bash
node scripts/migrate_grist_userid.js a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Create the `VocabularyUsage` Table in Grist

In Grist, click **+ Add New → New Table** and name it `VocabularyUsage`. Add these columns:

| Column ID | Type | Notes |
|-----------|------|-------|
| `vocabId` | Reference → `Vocabulary` | FK to vocabulary word |
| `profession` | Choice | software_engineer, nurse, teacher, etc. |
| `dailyUse` | Text | German sentence [English translation] |
| `dailyUse_vn` | Text | German sentence [Vietnamese translation] |
| `professionalUse` | Text | Professional context sentence [English] |
| `professionalUse_vn` | Text | Same [Vietnamese] |
| `tips` | Text | Grammar tips (English) |
| `tips_vn` | Text | Grammar tips (Vietnamese) |
| `caution` | Text | Common pitfalls (English) |
| `caution_vn` | Text | Common pitfalls (Vietnamese) |
| `createdAt` | DateTime | |

**Choice values for `profession`:** `software_engineer`, `healthcare_professional`, `nurse`, `teacher`, `legal_professional`, `finance_professional`, `general`

---

## 3. Flotiq: Profession Reference Content Type

### 3.1 Verify Flotiq Credentials

Your `.env.local` already has:
```env
NEXT_PUBLIC_FLOTIQ_URL=https://api.flotiq.com
NEXT_PUBLIC_FLOTIQ_KEY=<read-only key>
FLOTIQ_RW_KEY=<read-write key>
```

### 3.2 Run the Setup Script

This creates the `profession_reference` content type and seeds 7 profession entries:

```bash
cd /home/tvu/work/german
node scripts/setup_flotiq_professions.js
```

Expected output:
```
Creating profession_reference content type...
Content type created (or already exists).
Seeding profession: software_engineer... OK
Seeding profession: healthcare_professional... OK
Seeding profession: nurse... OK
Seeding profession: teacher... OK
Seeding profession: legal_professional... OK
Seeding profession: finance_professional... OK
Seeding profession: general... OK
Done.
```

---

## 4. Final `.env.local` Reference

After all setup steps, your `frontend/.env.local` should look like this:

```env
# Grist Integration (server-only)
GRIST_URL=https://docs.getgrist.com/api
GRIST_DOC=<your-doc-id>
GRIST_KEY=<your-api-key>

# Flotiq Integration
NEXT_PUBLIC_FLOTIQ_URL=https://api.flotiq.com
NEXT_PUBLIC_FLOTIQ_KEY=<read-only key>
FLOTIQ_RW_KEY=<read-write key>

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>

# Publitio
PUBLITIO_API_KEY=<key>
PUBLITIO_API_SECRET=<secret>
PUBLITIO_FOLDER_ID=<folder>

# Gemini
GEMINI_API_KEY=<key>
```

> `NEXT_PUBLIC_GRIST_*` fallback vars can be removed — all Grist calls now go through server-side API routes.

---

## 5. MCP Server: No Changes Needed

The MCP server (`mcp-server/`) connects directly to Grist using its own `.env` file. It already has the correct `GRIST_URL`, `GRIST_DOC`, `GRIST_KEY` set. The new `userId` and `VocabularyUsage` MCP tools have been added to the server — no additional configuration needed.

To rebuild the MCP server after the code changes:

```bash
cd /home/tvu/work/german/mcp-server
npm run build
```

---

## 6. Start the App

```bash
cd /home/tvu/work/german/frontend
npm run dev
```

Navigate to `http://localhost:3000`. You will be redirected to `/login`. Sign in with the credentials you created in Supabase.

After login, go to `/settings` to set your profession and target level.

---

## 7. Checklist

- [ ] Supabase project created
- [ ] `profiles` table created with RLS (`display_name`, `profession`, `target_level`)
- [ ] Email auth enabled, user accounts created
- [ ] `userId` column added to all 7 Grist tables
- [ ] `VocabularyUsage` table created in Grist
- [ ] `node scripts/migrate_grist_userid.js <uuid>` run to backfill existing rows
- [ ] `node scripts/setup_flotiq_professions.js` run to seed Flotiq content type
- [ ] `npm run build` run in `mcp-server/` to pick up new MCP tools
- [ ] App starts and login page appears at `http://localhost:3000/login`

