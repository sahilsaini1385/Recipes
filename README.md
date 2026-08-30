# Waypoint — travel articles into itineraries

Paste a link to a travel article (say, an "insider's guide to three perfect
days in Paris") and Waypoint reads it, pulls out every café, museum, bar, and
viewpoint it recommends, and turns it into a day-by-day itinerary you can open
on your phone:

- **A map of every stop** — numbered, color-coded pins per day (OpenStreetMap,
  no API key needed), with day filtering.
- **One-tap Google Maps** — open any stop in the Google Maps app, get walking
  directions to it, or open a whole day as a chained walking route.
- **Google My Maps export** — download the itinerary as a KML file and import
  it at [mymaps.google.com](https://mymaps.google.com); each day becomes a
  toggleable layer of pins with the article's notes attached, and the map then
  shows up in the Google Maps app on your phone under **You → Maps**.
- **Shareable links** — every itinerary gets an unguessable URL you can send
  to travel companions; the site is mobile-first and installable to the home
  screen.
- If a site won't let us fetch the article (hard paywall, JS-only rendering),
  the app falls back to letting you paste the article text.

**Stack:** React + Vite + Tailwind · Leaflet/OpenStreetMap · Supabase
(Postgres, magic-link auth, Edge Functions) · Anthropic API (Claude reads the
article and does the extraction — the key stays server-side) · deployable to
Vercel or Netlify on free tiers.

There's a built-in sample (`/t/sample-three-days-paris`) so you can explore
the UI before any setup.

---

## Setup (one time, ~15 minutes)

### 1. Supabase project

You can reuse the same Supabase project as the family recipes site — the
migration is idempotent and shares its allowlist — or create a fresh free
project at [supabase.com](https://supabase.com).

1. Open **SQL Editor**, paste the contents of
   `supabase/migrations/00001_travel_init.sql`, and run it. This creates:
   - the `itineraries` table with Row Level Security (anyone with a link can
     read; only allowlisted users can create/delete),
   - the `allowed_emails` allowlist (seeded with `ss3694@cornell.edu`) and the
     `is_family()` helper, if they don't already exist.
2. Add more editors (SQL Editor):
   ```sql
   insert into allowed_emails (email) values ('friend@example.com');
   ```
3. In **Authentication → URL Configuration**, set the Site URL to your
   deployed URL (you can come back after step 3). Magic-link email auth is on
   by default.

### 2. The article-parsing edge function

Requires the [Supabase CLI](https://supabase.com/docs/guides/cli) and an
Anthropic API key:

```sh
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy parse-itinerary
```

The key is stored as a server-side secret and never reaches the browser, and
the function requires a signed-in, allowlisted user, so strangers can't run up
your bill. The function also fetches article pages server-side, which is what
lets a URL paste work at all (browsers would be blocked by CORS).

### 3. Deploy the site (Vercel shown; Netlify config included too)

1. Import this repo/branch at [vercel.com](https://vercel.com). Framework
   preset: **Vite**.
2. Add two environment variables (from Supabase **Settings → API**):
   - `VITE_SUPABASE_URL` — the project URL
   - `VITE_SUPABASE_ANON_KEY` — the anon/public key (safe to expose; access
     control is enforced by RLS in Postgres)
3. Deploy, then set that URL as the Site URL in Supabase Authentication (step
   1.3) so magic links land on the live site.

---

## Using it on your phone

- Open the deployed URL, sign in once, and **Add to Home Screen** — the app is
  installable and every saved itinerary is on the home page.
- Each stop card's **Google Maps** / **Directions** buttons deep-link into the
  Google Maps app using the place's *name and address* (not just coordinates),
  so navigation goes to the actual venue.
- **Walking route** links chain a whole day into one Google Maps directions
  request (long days are split into continuous legs — Google caps a single
  link at 11 stops).
- For a true custom map, use **Google My Maps → Download KML**, import it at
  mymaps.google.com (easiest on a computer), and it appears in the Google Maps
  app under **You → Maps**.

## Local development

```sh
npm install
cp .env.example .env    # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

```sh
npm test        # unit tests for the KML export and Google Maps link builders
npm run build   # production build (dist/)
```

Without a `.env` the app runs in demo mode: the sample itinerary works,
creation is disabled.

## How the parsing works

`supabase/functions/parse-itinerary` fetches the article (preferring the full
`articleBody` that publishers embed in JSON-LD, falling back to stripped page
text), then asks Claude for a structured itinerary: days, ordered stops,
descriptions and insider tips paraphrased from the article, and coordinates
for each venue. Structured outputs guarantee schema-valid JSON. Pin
coordinates come from the model's knowledge of the venues — famous places are
precise; anything it only knows at neighborhood level is flagged `approx` —
while all Google Maps links are name+address based, so navigation is exact
regardless.

## Project layout

```
supabase/migrations/00001_travel_init.sql  schema, RLS, allowlist
supabase/functions/parse-itinerary/        article → itinerary (Anthropic key stays server-side)
src/lib/types.ts                           itinerary data model + day colors
src/lib/kml.ts                             Google My Maps (KML) export (unit-tested)
src/lib/gmaps.ts                           Google Maps deep links + day routes (unit-tested)
src/lib/sampleParis.ts                     built-in demo itinerary
src/components/MapView.tsx                 Leaflet map with numbered day pins
src/pages/                                 Home (create + list), ItineraryPage, SignIn
```
