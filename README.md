# Jungman Family Recipes

A mobile-first family recipe website. Browse and search recipes, rescale any
recipe's ingredient amounts to a chosen number of servings, and let family
members add new recipes — by structured form, by pasting text, or by
uploading a photo/PDF that gets parsed automatically.

**Stack:** React + Vite + Tailwind (shadcn-style components) · Supabase
(Postgres, Storage, magic-link auth, Edge Functions) · Anthropic API for smart
import · deployable to Vercel or Netlify on free tiers.

---

## Setup (one time, ~15 minutes)

### 1. Supabase project

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the contents of
   `supabase/migrations/00001_init.sql`, and run it. This creates:
   - the `recipes` and `favorites` tables with Row Level Security
     (everyone reads, only allowlisted family members write),
   - the `allowed_emails` allowlist (seeded with `ss3694@cornell.edu`),
   - the public `recipe-photos` storage bucket and its policies.
3. Add more family members to the allowlist (SQL Editor):
   ```sql
   insert into allowed_emails (email) values ('mom@example.com'), ('dad@example.com');
   ```
4. In **Authentication → URL Configuration**, set the Site URL to your
   deployed URL (add it again after step 3 below if you don't know it yet).
   Email magic-link auth is enabled by default.

### 2. Smart import edge function

Requires the [Supabase CLI](https://supabase.com/docs/guides/cli) and an
Anthropic API key:

```sh
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy parse-recipe
```

The key is stored as a server-side secret and never reaches the browser. The
function also requires a signed-in, allowlisted user, so it can't be abused
by strangers.

(If you skip this step, everything else still works — only the "Import" tab
will error. The structured form never touches the LLM.)

### 3. Deploy the site (Vercel shown; Netlify config is included too)

1. Push this repo to GitHub and import it at [vercel.com](https://vercel.com).
2. Framework preset: **Vite**. Add two environment variables (from your
   Supabase project's **Settings → API**):
   - `VITE_SUPABASE_URL` — the project URL
   - `VITE_SUPABASE_ANON_KEY` — the anon/public key (safe to expose; all
     access control is enforced by RLS in Postgres)
3. Deploy. You get a shareable `*.vercel.app` URL that works on phones.
4. Go back to Supabase **Authentication → URL Configuration** and set the
   Site URL (and Redirect URL) to that deployed URL so magic links land on
   the live site.

### 4. Seed data (optional)

If you have a `recipes.json` file (an array of recipe objects matching the
schema in `src/lib/types.ts`), import it once:

```sh
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
node scripts/seed.mjs recipes.json
```

The seed is idempotent and de-duplicates by normalized title ("Copy of X",
"X (1)", and the same recipe saved as both .doc and .docx collapse to one,
keeping the most complete version). Entries with no ingredients and no steps
are skipped as non-recipes. Re-running never creates duplicates.

Don't have a `recipes.json` yet? Two options:

- Use the **Import** tab in the app — paste text or upload a photo/PDF of
  each recipe; the parser produces the exact schema and you review before
  saving.
- Or convert your document collection to `recipes.json` in one shot: give the
  files to Claude (or any LLM) with the ingredient schema from
  `src/lib/types.ts` and ask for a JSON array, then run the seed script.

---

## Local development

```sh
npm install
cp .env.example .env    # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

```sh
npm test        # unit tests for the serving scaler and ingredient parser
npm run build   # production build (dist/)
```

## How the serving scaler works

- Each recipe stores `base_servings`; the page-level control changes a local
  target and every ingredient re-renders live. Nothing is written back to the
  database.
- Scale factor = `target / base`. Only ingredients with a parsed numeric
  `quantity` are multiplied.
- Amounts format like a cookbook: fractions in halves/thirds/quarters/eighths
  (`0.75 → ¾`, `1.333 → 1⅓`), whole numbers stay whole, and ranges scale both
  ends (`2 to 3 cloves → 4–6`).
- Countable items with no unit (eggs, cloves) round to the nearest half and
  show "approx" when rounded — never "1.333 eggs".
- Lines with units like *can, stick, package, pinch, dash* or notes like *to
  taste* are shown verbatim with a muted "adjust to taste when scaling" hint.
  No numbers are invented.

## Project layout

```
supabase/migrations/00001_init.sql   schema, RLS, storage bucket, allowlist
supabase/functions/parse-recipe/     LLM import (Anthropic key stays server-side)
scripts/seed.mjs                     idempotent recipes.json importer
src/lib/scaling.ts                   serving scaler (unit-tested)
src/lib/parseIngredient.ts           free-text ingredient parser
src/pages/                           Home, Recipe, CookMode, Add, Edit, SignIn
```
