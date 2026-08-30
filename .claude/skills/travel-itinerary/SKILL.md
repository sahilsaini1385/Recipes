---
name: travel-itinerary
description: Turn a travel article into a day-by-day itinerary with maps the user can take on their phone — a KML file that imports into Google My Maps as per-day layers of pins, plus a mobile-friendly itinerary page. Use this whenever the user shares a link or text of a travel article, city guide, "best of" listicle, or trip write-up and wants an itinerary, trip plan, map, pins, KML, or a Google My Maps / Google Maps version of it — even if they just say "put this on a map", "plan this trip", or "add this to my maps". Also use it to merge several articles about one destination into a single trip map.
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

- If the user pasted text or gave a file, use it directly. Several articles
  for one destination are fine — they merge into one itinerary (see Step 2).
- For a URL, run the bundled fetcher (stdlib-only Python):

  ```bash
  python3 scripts/fetch_article.py "<url>" -o article.txt
  ```

  It fetches with browser headers, prefers the full `articleBody` publishers
  embed in JSON-LD (this often works even for paywalled pages), and falls
  back to stripped page text. WebFetch is a fine alternative when it works,
  but many travel publishers block it; the script gets through more often.
- If the fetch fails or returns too little text (< ~500 chars of real
  article), don't guess at the article's content from the URL or from memory
  of the publication. Tell the user the site blocked the fetch and ask them
  to open the article in their browser, select all, and paste the text.

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
(usually a coordinate typo) rather than bypassing it.

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

- Summarize the itinerary in chat (days, stop counts, anything you flagged
  `approx`), and remind the user pins flagged approximate are
  neighborhood-level while the Google Maps links stay exact.
- Offer refinements — they're cheap now that the JSON exists: drop/add
  stops, rebalance days, merge another article. After any change, rerun
  Step 3 (and republish the artifact) so every deliverable stays in sync.
