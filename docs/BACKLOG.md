# Backlog

Living document. The daily build routine works from this file, top of a theme
down, and ticks items off as they ship.

---

## What this app is

Three sections exist today: **Recipes** (178 of them), **Passport** (every
country and US state 11 family members have visited), and **Family Tree**
(38 people across 5 generations).

Those are not three unrelated features. They are three halves of the same
thing: **a family archive**. What we cook, where we have been, who we come
from. Nobody else is holding that for the Jungmans, and no product will,
because there is no business in it.

That is worth stating because the obvious move — bolting on a shared
calendar and chore charts — is the wrong one. Cozi, Maple, FamilyWall and
Google Calendar have owned family logistics for a decade and do it well and
free. This app will never win there and does not need to. Its edge is the
archive: the data is already unusual, already curated, and already owned.

**The rule for what goes in:** does it make the family's record of itself
richer or easier to keep? If yes, build it. If it is really a scheduling or
productivity feature, it belongs in the app the family already uses for that.

## Principles

1. **Nothing is a chore to maintain.** Anything that needs regular manual
   upkeep will be abandoned by March. Prefer things that fill themselves in,
   or that are pleasant to add to.
2. **Mobile first, actually.** It is used on a phone, standing in a kitchen
   or an airport.
3. **Readable by everyone, editable by the family.** Grandparents open a
   link and it just works; no sign-in to read.
4. **Never lose anything.** This is an archive. Deletes are soft, edits keep
   the original, syncs add before they remove.
5. **Ship a slice, not an epic.** Every item below should be shippable in one
   sitting and useful on its own.

---

## Theme 1 — Trips

**The missing middle.** Passport records *where* the family has been, as a
flat list of codes with no dates and no story. The tree records *who*. There
is nothing recording *when*, *with whom*, or *what happened* — which is the
part anybody would actually want to read in twenty years.

A trip is the container the app is missing, and it is what makes the
restaurants and itineraries below have somewhere to live.

> Design constraint that applies to this whole theme: the Google Sheet stays
> the source of truth for the passport counts. Trips are **additive** — they
> may reference the same country codes, but `passport-sync` must keep working
> untouched. Do not make passport counts derive from trips.

- **1.2 — Places and restaurants** *(M)* — *asked for explicitly*
  `trip_places`: name, city, country, kind (restaurant / hotel / sight /
  bar / shop), a note, a would-return flag, optional link. Addable from a
  trip, and browsable across all trips so "where did we eat in Lisbon" is
  one search. This is the single most-requested thing and probably the most
  used feature in the app once it exists.
- **1.3 — Restaurant quick-add** *(S)*
  Adding a place while standing outside it must take under ten seconds:
  name, city prefilled from the trip, one tap for would-return. Everything
  else optional and editable later.
- **1.4 — Itineraries** *(M)* — *asked for explicitly*
  A trip in the future gets a day-by-day plan: date, entries with a time,
  place and note. The same trip becomes the journal afterwards, so planning
  and remembering are one record rather than two apps.
- **1.5 — Packing lists** *(S)*
  Reusable templates ("beach", "ski", "long-haul with a toddler"),
  checkable, reset per trip. Small, and genuinely used with young children.
- **1.6 — Trip photos** *(M)*
  The `recipe-photos` bucket exists and holds zero files. A trip is a much
  more natural home for photographs than a recipe is. Needs a thumbnailing
  story before it ships — full-size phone photos will make the page crawl.
- **1.7 — Link trips to the passport** *(S)*
  On a member's passport page, show which trip a country came from where
  one is known. Read-only join; changes nothing about the sync.
- **1.8 — Map of a trip** *(M)*
  Pins for the trip's places. Needs a tile source that is free and does not
  require a key in the client — investigate before committing.

## Theme 2 — Occasions

The tree already holds birth years for 38 people. Full dates turn a static
chart into something that tells you what is happening this week — the one
genuinely *useful* thing a family archive can do day to day, without
becoming a calendar app.

- **2.1 — Full dates on tree people** *(S)*
  Add optional month and day alongside the existing years. Years-only stays
  valid; nothing breaks for the 38 people already entered.
- **2.2 — "This week in the family"** *(S)*
  A strip on the home page: upcoming birthdays and anniversaries, and
  memorial dates for those who have died. Derived entirely from tree data,
  so it needs no upkeep at all.
- **2.3 — Anniversaries** *(S)*
  Marriage dates on couples, shown alongside birthdays.
- **2.4 — Calendar export** *(M)*
  A subscribable `.ics` feed so the birthdays land in whatever calendar the
  family already uses, instead of asking anyone to check this app.
  Deliberately an export, not a calendar.

## Theme 3 — Recipes, deepened

The strongest section. These make it a kitchen tool rather than an archive
you read.

- **3.1 — Shopping list from recipes** *(M)*
  Tick several recipes, get one combined list, quantities summed where the
  units agree and listed separately where they do not. Grouped roughly by
  aisle. The ingredient parser and unit code needed for this already exist
  and are well tested.
- **3.2 — Meal plan for the week** *(M)*
  Drag or tap recipes onto days. Feeds 3.1 directly.
- **3.3 — "We cooked this"** *(S)*
  A tap on a recipe logs who made it and when, with an optional note
  ("halved the chilli, Jack ate it"). Over years this becomes the most
  interesting data in the app and costs one tap to maintain.
- **3.4 — Recipe photos from the family** *(S)*
  Storage and policies are already in place and unused. Let people add a
  photo of the finished dish from their phone.
- **3.5 — Where a recipe came from** *(S)*
  Recipes have a `credit` field, already populated ("From Nancy Jungman").
  Link it to the person in the family tree, so a person's page can show the
  recipes that came from them. Genuinely lovely, and nearly free.
- **3.6 — Print view** *(S)*
  One clean page, scaled to the chosen servings, no navigation. People do
  print recipes.

## Theme 4 — Stories

The tree has names and dates. It does not have anybody's voice.

- **4.1 — A memory attached to a person** *(M)*
  Short written entries on a tree person, with who wrote it and when.
  Nothing else in the app captures this, and it is the part that becomes
  irreplaceable.
- **4.2 — Photos of people** *(S)*
  One portrait per person on the tree, replacing the monogram circles.
- **4.3 — Where people were from** *(M)*
  Birthplace on a tree person, and a view of where the family came from over
  the generations. Pairs naturally with the passport's map work.

## Quality track — always on

Every build should carry at least one of these alongside its feature work.
They are not a separate project.

- **Correctness.** Re-read recent diffs adversarially. Prefer fixing a real
  bug over adding a small feature, always.
- **UX.** Drive the real pages in a browser at 390×844 and 1280×800.
  Contrast, touch targets, empty states, error states, loading states.
- **Cleanup.** Dead code, duplicated logic, hard-coded values that should be
  tokens, files that no longer earn their place.
- **Tests.** Anything with real logic gets tests. 68 across 9 files today.
- **Accessibility.** Not yet audited at all. Keyboard paths, focus order,
  labels, and screen-reader behaviour on the tree chart in particular.
- **Performance.** The JS bundle is ~606 KB and everything is in one chunk.
  Route-level code splitting is the obvious first move.

### Known open items

- Three orphan edge functions in Supabase — `super-processor`,
  `hyper-responder`, `dynamic-task`. Nothing calls them; they squat names.
- Leaked-password protection is off (dashboard toggle, owner's action).
- `scripts/seed.mjs`, `netlify.toml`, and the `playwright` dev dependency
  may all be removable — awaiting a decision.
- The `finance` schema is exposed via a role-level setting rather than the
  dashboard's Exposed Schemas. Works, but the dashboard is the durable place.

---

## Deliberately not doing

- **A shared family calendar.** Cozi, Maple and Google do this well and
  free, and the family already uses something. 2.4 exports *to* those
  instead.
- **Chores, allowances, task assignment.** Not archive material.
- **Location sharing.** Wrong app, and a standing privacy liability.
- **Messaging.** The family has phones.
- **Accounts for people outside the family.** The allowlist is the security
  model; widening it weakens the whole thing for no gain.

---

## Log

Shipped items move here with the date and a one-line note, so the report
each morning has something to point at.

### 2026-09-07

- **1.1 Trip records — shipped.** `trips`, `trip_travellers` and
  `trip_destinations`, a Trips tab listing newest first, and a trip detail
  page. Family members can add, edit and remove; removal is soft, and a
  removed trip stays readable to family so it can be brought back while
  staying hidden from the public link. Dates are both optional, because a
  trip nobody can date is still worth recording.
- **`set_updated_at` search_path pinned.** Cleared the advisor warning, and
  the function now fires on every trips update so it was worth closing.

**Corrected while building:** 1.1 used to say "seed from the existing
passport data where a year is known". There are no years to seed from —
`country_visits` holds only a member and a code, and the sheet parser strips
date phrases before mapping a name to a code. Trips start empty.

**Learned, for whoever builds next:** the headless browser in this
environment has no direct internet, so a page built against the live
Supabase URL sits on "Loading…" forever. Point the build at the local mock
on :54321 for UI checks (`scratchpad/mock.mjs`, which now serves trips) and
verify the database side separately over REST, where the proxy works.
