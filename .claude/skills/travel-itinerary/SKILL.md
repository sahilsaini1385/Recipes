---
name: travel-itinerary
description: Turn a travel article into a day-by-day itinerary with maps the user can take on their phone — a KML file that imports into Google My Maps as per-day layers of pins, plus a mobile-friendly itinerary page. Use this whenever the user shares a link or text of a travel article, city guide, "best of" listicle, or trip write-up and wants an itinerary, trip plan, map, pins, KML, or a Google My Maps / Google Maps version of it — even if they just say "put this on a map", "plan this trip", or "add this to my maps". Also use it when the user gives several articles or links at once — merge sources covering one trip into a single map, or build one map per destination.
---

# Travel Itinerary

Turn travel writing into three deliverables:

1. **A day-by-day itinerary** the user can read in chat.
2. **A KML file** they import into Google My Maps (each day becomes a
   toggleable layer of numbered, colored pins carrying the article's notes).
3. **A phone-friendly itinerary page** (an Artifact, when artifact publishing
   is available) with an interactive map and one-tap Google Maps links.

There is no Google My Maps API — Google retired it — so the KML import is the
only supported way in; never promise to edit the user's My Maps directly.
The import takes the user ~30 seconds and the instructions below cover it.

## Step 1 — Get the article text

- If the user pasted text or gave a file, use it directly. Multiple articles
  are welcome — any mix of URLs, pasted text, and files — and merge into one
  itinerary when they cover one trip (see Step 2).
- For URLs, run the bundled fetcher (stdlib-only Python) once per link,
  giving each article its own output file so nothing is overwritten:

  ```bash
  python3 scripts/fetch_article.py "<url-1>" -o article-1.txt
  python3 scripts/fetch_article.py "<url-2>" -o article-2.txt
  ```

  Many modern publishers (Condé Nast titles, and anything on Next.js/Nuxt)
  render the article client-side: the readable HTML is mostly navigation and
  the real text sits in a JSON state blob in a `<script>` tag. The script
  handles this — it tries JSON-LD `articleBody`, embedded JSON state
  (`__PRELOADED_STATE__`, `__NEXT_DATA__`, `__NUXT__`), `<article>`/`<main>`,
  and whole-page text, then keeps whichever yields the most real prose. If
  the live page is blocked or thin it also tries the page's Wayback Machine
  snapshot. Prefer this script over WebFetch, which many travel publishers
  block outright.

- **Read the script's exit code — it is the difference between a good
  itinerary and a fabricated one.**
  - `0` — usable text was saved. The report line names the strategy that won.
  - `2` (fetch failed) or `3` (page fetched, but no real article text —
    paywalled or fully client-rendered): **stop and ask the user to paste the
    article text.** Do not fill the gap from the URL slug, the publication's
    reputation, or your own knowledge of the destination — an itinerary of
    plausible-sounding places the article never recommended is the one
    outcome worse than no itinerary.
- Extracted text from a JSON-state page can carry teasers for *other*
  articles ("Where to Stay Near Banff…") alongside the real one. Use only
  the stops belonging to the article you asked for — the headline and day
  headings tell you which those are.
- If the user is watching and a site keeps failing, the fastest fix is
  usually theirs: open the article, select all, paste. Say that plainly
  rather than retrying a blocked host repeatedly.

## Step 2 — Extract the itinerary

Write the itinerary as JSON (schema below, save as `itinerary.json`). Rules,
in rough priority order:

- **Fidelity first.** Include every place the article genuinely recommends
  visiting, eating at, drinking at, shopping at, or staying at — and nothing
  it doesn't. Never invent stops, never pad thin days with your own
  suggestions. (If the user *asks* you to supplement the article, add stops
  but mark them in the description as your addition, not the article's.)
- **Days.** If the article is organized by days, keep that structure exactly.
  Otherwise group stops into 1–4 sensible days by geography, ordering each
  day morning → evening and to minimize backtracking on foot. A listicle
  ("10 best coffee bars in…") still becomes a walkable order. If the user
  asked for a specific number of days, honor it.
- **Lodging and other non-day stops.** Articles often carry a "Where to
  stay" section that belongs to no particular day. Give it its own entry with
  `"day": 0` and a title like "Where to stay": the KML labels that layer by
  title, and the page skips the walking-route link (a route between six
  hotels you must choose between is nonsense). Everything else keeps
  `day` 1..n.
- **Coordinates.** Use your knowledge of the actual venue: be precise for
  well-known places; if you only know the neighborhood, use its center and
  set `"approx": true`. Never use 0,0 and never place a stop in the wrong
  city — a wrong pin is worse than an approximate one. All Google Maps links
  are built from name + address, so navigation stays exact even when a pin
  is approximate.
- **Text.** `description` is 1–2 sentences conveying what the article says,
  paraphrased in your own words (don't copy sentences verbatim). `tip` is
  the article's practical advice for that stop (timing, what to order, how
  to book), or null. `tips` (top level) is article-wide advice.
- **Merging articles.** When combining several sources, dedupe stops by
  venue, keep the richest description, and note disagreements in the tip.
  Merge into one itinerary only when the articles cover one trip. If they
  cover different destinations (a Paris article and a London article), build
  a separate itinerary + KML per destination — separate My Maps stay usable —
  unless the user explicitly wants them as one multi-city trip.

### Itinerary JSON schema

```json
{
  "title": "Three Days in Lisbon",
  "destination": "Lisbon, Portugal",
  "summary": "One or two sentences on the trip's flavor.",
  "days": [
    {
      "day": 1,
      "title": "Alfama & the castle",
      "stops": [
        {
          "name": "Castelo de São Jorge",
          "kind": "sight",
          "description": "What the article says, paraphrased.",
          "area": "Alfama",
          "address": "R. de Santa Cruz do Castelo, Lisbon",
          "lat": 38.7139, "lng": -9.1335,
          "approx": false,
          "time_of_day": "morning",
          "tip": "Article's advice for this stop, or null"
        }
      ]
    }
  ],
  "tips": ["Article-wide advice strings"]
}
```

`day`: 1..n for days of the trip; `0` for a non-day layer such as lodging.
`kind`: one of sight, museum, restaurant, cafe, bakery, bar, hotel, shop,
activity, neighborhood, viewpoint, other. `time_of_day`: morning, afternoon,
evening, flexible. `area`/`address` may be `""` when unknown — never invent
an address.

## Step 3 — Build and deliver the KML

```bash
python3 scripts/build_kml.py itinerary.json <slug>.kml
```

The script validates the JSON (coordinate sanity included) and emits KML with
one folder per day, day-colored numbered pins, and each stop's notes + a
Google Maps link in the pin description. Fix any validation error it reports
(usually a coordinate typo) rather than bypassing it. One deliberate
exception: it rejects itineraries spanning more than ~200km to catch
wrong-city pins — when the trip really is that wide (a road trip, a
multi-town region, an intentional multi-city itinerary), add `--allow-wide`
after double-checking each outlying stop's coordinates.

Send the `.kml` to the user with the file-delivery tool available in your
environment (e.g. `SendUserFile` as an attachment). Never deliver it only as
a download link inside an artifact — artifact pages can't hand viewers files.

**First KML in a conversation** — include these import steps with it:

1. Open [mymaps.google.com](https://mymaps.google.com) (easiest on a
   computer) → **Create a new map**.
2. In the left panel, click **Import** and pick the `.kml` file.
3. Rename the map; it now shows in the Google Maps phone app under
   **You → Maps**, pins and notes included.

**Adding to an existing My Map** (a later article for the same trip): tell
the user to open their map → **Add layer** → **Import** with the new KML, or
offer to regenerate one merged KML covering everything so they can re-import
a single file.

## Step 4 — Publish the phone itinerary page

When artifact publishing is available, build the page from
`assets/itinerary_template.html`:

1. Follow your platform's artifact design guidance (load the design skill if
   the platform requires it before writing artifacts).
2. Replace `__TITLE__` with the itinerary title and `__ITINERARY_JSON__` with
   the contents of `itinerary.json` (raw JSON, no quotes around it).
3. Publish and share the link — the page renders the map (Leaflet from
   cdnjs, the only CDN artifacts allow scripts from; its CSS is already
   inlined in the template), day-filter chips, numbered day-colored pins,
   stop cards with the article's tips, and Google Maps / Directions deep
   links per stop plus a chained walking-route link per day.

The template is self-contained and theme-aware — don't rewrite it from
scratch; edit only if the user asks for something it doesn't do. If artifact
publishing isn't available, put the day-by-day itinerary in chat instead
(with the per-stop Google Maps links) alongside the KML.

## Step 5 — Close the loop

- Summarize the itinerary in chat: days, stop counts, and — naming them —
  any stops you flagged `approx` (`build_kml.py` prints the count as a
  reminder). Say plainly that those pins sit at neighborhood level because
  the article gave no address, while every Google Maps link still resolves
  to the exact venue. A user who knows which pins are soft can trust the
  rest; one who discovers it in the street cannot.
- Offer refinements — they're cheap now that the JSON exists: drop/add
  stops, rebalance days, merge another article. After any change, rerun
  Step 3 (and republish the artifact) so every deliverable stays in sync.
