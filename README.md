# The Jungman Family Site

A mobile-first private site for one family, with three sections:

- **Recipes** — browse and search the family collection, rescale any recipe to
  a chosen number of servings, flip between US and metric units, cook with the
  screen kept awake, and add new recipes by form, by pasted text, or by
  uploading photos / PDFs / Word files / a whole `.zip` that get read
  automatically (duplicates collapsed, each recipe reviewed before it saves).
- **Family Passport** — every country and US state each family member has
  visited, kept in sync from a Google Sheet, with a progress tracker toward
  all 195 countries.
- **Family Tree** — a multi-generation chart with spouses, birth and death
  years, divorces, and in-law branches; new people can be added from the page.

**Stack:** React + Vite + TypeScript + Tailwind (shadcn-style components) ·
Supabase (Postgres with Row Level Security, Storage, password auth, Edge
Functions) · Anthropic API for recipe import and cost estimates · deployed on
Vercel's free tier.

Every secret lives server-side in an edge function. The only key the browser
ever sees is the Supabase anon key, which is public by design — all access
control is enforced by RLS in Postgres.

---

## Setup

### 1. Database

Create a free project at [supabase.com](https://supabase.com), then open the
**SQL Editor** and run the files in `supabase/migrations/` **in order**:

| File | What it adds |
| --- | --- |
| `00001_init.sql` | `recipes` + `favorites`, RLS, the `allowed_emails` allowlist, the `recipe-photos` storage bucket |
| `00002_drive_sync.sql` | `drive_files` — remembers which Drive files were already imported or skipped |
| `00003_cost_per_serving.sql` | cost-estimate column |
| `00004_password_auth.sql` | `email_allowed()` so the sign-in page can check the allowlist before creating an account |
| `00005_passport.sql` | `family_members` + `country_visits` |
| `00006_state_visits.sql` | `state_visits` |
| `00007_passport_data.sql` | the family's members (seed data) |
| `00008_family_tree.sql` | `tree_nodes` |
| `00009`–`00012` | tree columns and people added later (grandparents, years, divorce flag, Marilyn's family) |

They are all safe to re-run, with one deliberate exception: `00004` contains a
commented-out one-time statement that resets every family password. It is left
commented out so re-running the file can't overwrite a password someone has
since chosen.

Add family members to the allowlist:

```sql
insert into allowed_emails (email) values ('mom@example.com'), ('dad@example.com');
```

In **Authentication → Sign In / Providers → Email**, turn **off** "Confirm
email" so first-time password sign-ins don't need an email round-trip. In
**Authentication → URL Configuration**, set the Site URL to the deployed URL
(the site falls back to a magic link if a password sign-in fails).

### 2. Edge functions

All four need the [Supabase CLI](https://supabase.com/docs/guides/cli):

```sh
supabase login
supabase link --project-ref YOUR-PROJECT-REF
```

Each function checks that the caller is a signed-in, allowlisted family member
before doing any work, so none of them can be used by a stranger.

| Function | Secrets it needs | What it does |
| --- | --- | --- |
| `parse-recipe` | `ANTHROPIC_API_KEY` | reads a photo/PDF/document/pasted text and returns a structured recipe |
| `estimate-costs` | `ANTHROPIC_API_KEY` | fills in the per-serving cost estimate for recipes that don't have one |
| `drive-sync` | `GOOGLE_API_KEY`, `GOOGLE_DRIVE_FOLDER_ID` | lists and downloads new files from a shared Drive folder |
| `passport-sync` | `PASSPORT_SHEET_ID` | reads the passport Google Sheet and updates the countries and states tables |

```sh
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... \
  GOOGLE_API_KEY=... GOOGLE_DRIVE_FOLDER_ID=... PASSPORT_SHEET_ID=...

supabase functions deploy parse-recipe
supabase functions deploy estimate-costs
supabase functions deploy drive-sync
supabase functions deploy passport-sync
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are
injected by Supabase automatically — don't set them yourself.

Skipping a function only disables its feature; the rest of the site keeps
working. (The structured recipe form never touches the LLM.)

### 3. Deploy

1. Push this repo to GitHub and import it at [vercel.com](https://vercel.com).
2. Framework preset: **Vite**. Add two environment variables from the Supabase
   project's **Settings → API**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy, then put that URL back into Supabase's **Authentication → URL
   Configuration** so sign-in links land on the live site.

`vercel.json` rewrites every path to `index.html`, which is what makes deep
links like `/recipe/pot-roast` work on a single-page app.

---

## Local development

```sh
npm install
cp .env.example .env    # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

```sh
npm test        # unit tests
npm run build   # production build (dist/)
npx tsc --noEmit
```

The passport sheet is the source of truth: `passport-sync` re-reads it, adds
what's new and removes what's gone, so editing the sheet updates the site.
`src/lib/dataDrift.test.ts` guards the country, state and category lists, which
necessarily exist in three places at once (the site's TypeScript, the Deno edge
function that can't import from `src/`, and a SQL `CHECK` constraint) — the
test fails if they ever stop agreeing.

## How the serving scaler works

- Each recipe stores `base_servings`; the page control changes a local target
  and every ingredient re-renders live. Nothing is written back to the database.
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
supabase/migrations/      schema, RLS, storage bucket, allowlist, seed data
supabase/functions/       parse-recipe, estimate-costs, drive-sync, passport-sync
scripts/seed.mjs          one-off idempotent recipes.json importer
src/pages/                Home, RecipePage, AddRecipe, EditRecipe, SignIn,
                          Passport, FamilyTree
src/components/           Header, BottomNav, RecipeCard, RecipeForm, CookMode,
                          IngredientList, ServingsControl, UnitToggle, ui/
src/hooks/                useAuth, useRecipes, useFavorites, usePassport,
                          useFamilyTree, useCostEstimates, useUnitSystem,
                          useWakeLock
src/lib/scaling.ts        serving scaler (unit-tested)
src/lib/parseIngredient.ts free-text ingredient parser
src/lib/treeLayout.ts     family-tree geometry engine (unit-tested)
src/lib/countries.ts      country list, names and flags (incl. UK countries)
src/lib/dedupe.ts         collapses "Copy of X" / "(1)" / .doc-vs-.docx
```

### One-off seed script

If you have a `recipes.json` (an array matching `src/lib/types.ts`):

```sh
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
node scripts/seed.mjs recipes.json
```

It de-duplicates by normalized title, skips entries with no ingredients and no
steps, and never creates duplicates when re-run. The app's **Import** tab is
the easier path for everything else.
