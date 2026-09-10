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

> **Status check, 2026-09-10.** Three builds in, the tables hold 1 trip, 0
> places and 0 itinerary entries. The theme is still the right one, but more
> of it is worth building only once a real trip is in there — otherwise it is
> features for an empty room. Prefer work against data the family already has
> until that changes.
>
> Design constraint that applies to this whole theme: the Google Sheet stays
> the source of truth for the passport counts. Trips are **additive** — they
> may reference the same country codes, but `passport-sync` must keep working
> untouched. Do not make passport counts derive from trips.

- **1.3 — Restaurant quick-add** *(S)*
  Mostly landed with 1.2: name is the only required field, kind defaults to
  restaurant, town prefills. What is left is the fast path — an add button
  on the Places browser itself that asks which trip, so a place can be
  recorded without navigating to the trip first.
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
- **Tests.** Anything with real logic gets tests. 141 across 13 files today.
- **Accessibility.** Not yet audited at all. Keyboard paths, focus order,
  labels, and screen-reader behaviour on the tree chart in particular.
- **Performance.** Route splitting done (main chunk 427 KB). Next: the
  remaining 423 KB is React plus the Supabase client, so the wins now are
  image handling for 1.6 and avoiding a fourth copy of the country list.

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

### 2026-09-10

- **3.5 Where a recipe came from — shipped.** The `credit` field is now
  matched against the family tree, both ways: a recipe page offers "More from
  Nancy", a tree card says how many recipes that couple is credited with, and
  the Recipes tab takes a `?from=<person>` scope with a banner and a Clear
  button. **65 of the 125 credited recipes link** — 67 sit on John and Nancy's
  row (Nancy 48, John 19, three credited to both) and one on Will's. The other
  60 name cookbooks, websites and friends, and are left as plain text.
  Measured by running the shipped matcher over the live table, not estimated.
- **Category chips count inside the scope.** They were counting the whole
  collection while showing one person's, so "All 6" sat above a single card.

**Why this and not Theme 1.** Three builds went top-down through Trips. The
database says the family has entered **1 trip, 0 places and 0 itinerary
entries** in that time, against **178 recipes and 38 people on the tree**.
Building Theme 1 item four would have been dressing an empty room. This build
went where the data already is. Theme 1 is still right — it just needs a real
trip in it before more of it is worth building.

**The hard part was refusing to guess.** Attributing Grandma's cornbread to
the wrong grandfather is a real harm in a family archive; leaving a credit as
plain text costs nothing. So the matcher declines whenever more than one
person could be meant. It will not choose between the tree's two Frank
Jungmans, will not match a bare "Kathryn" (there are two), keeps the three
different Nancys apart, and does not connect "Karina Valencia" to the tree's
Karina Litwack or "Kathryn Jungman" to Kathryn Saini — the tree holds no
maiden names, so the app has no basis for it. 23 tests, every credit string
in them taken from the real table.

**Learned, for whoever builds next:** spouses are a *field*, not a row.
`spouse_name` on John's row is how Nancy — who has more recipes than anyone —
exists in the tree at all, so a join on `tree_members.name` alone would have
missed the single biggest contributor in the archive. A tree row is therefore
a couple, which is why `groupByPerson` returns a list of `names` rather than
one: a bucket showing 67 recipes has to say "John Jungman & Nancy Jungman"
and not quietly credit him with her cooking.

**Two dead ends caught by looking at screenshots**, not at test output: an
unrecognised `?from=` showed an empty state saying "clear the filter" with no
control to clear it, and eleven category chips reading 0 buried the one chip
that had anything in it.

**Also:** the whole recipe collection is 294 KB and the credits alone are
5 KB, so the tree page fetches only `credit` rather than pulling the
collection for a count.

### 2026-09-09

- **1.4 Itineraries — shipped.** `trip_days`: a date, an optional free-text
  "when", a line about what happens, a note, and an optional link to a place
  already saved. The heading reads "The plan" while a trip is ahead and "Day
  by day" once it is behind — the same rows either way, which is the reason
  this lives here instead of in a planning app that forgets.
- **Two loading-state bugs fixed.** Both Places views have two data sources
  and gated their empty state on one, so a trip page said "No places noted
  yet" while places were in flight, and the browser said "No places yet"
  whenever trips resolved second. Reproduced with a deliberately slowed mock
  before fixing, and re-verified after.

**Corrected while building:** 1.4 said to lay out every day of a trip. Built
that, looked at a 13-day trip with three days written up, and found eleven
lines saying "Nothing planned" — the clutter the module's own comment warned
against. Empty days are an affordance while planning and noise afterwards,
so past trips now show only days somebody wrote on, with a "show the other N
days" link for family writing one up late. Day numbering still counts from
the real start, so a diary entry is Day 4 even when days 1–3 are hidden.

**Learned, for whoever builds next:** `at` is free text rather than a time
column, because "morning" and "after nap" are what people write and neither
parses; ordering uses an explicit `position`. And `place_id` is ON DELETE SET
NULL, not cascade — removing a restaurant should not delete the plan that
mentioned it.

**Environment note:** `pkill -f "vite preview"` and `pgrep -f "vite preview"`
both match the running shell's own command line and kill it. Use a bracket
pattern (`[v]ite`) or the harness's background-task tooling.

### 2026-09-08

- **1.2 Places and restaurants — shipped.** `trip_places` with name, town,
  kind, note, link and a three-state would-return flag. A trip groups its
  own places by kind, recommended first; `/places` searches across every
  trip at once, folding accents so "cafe" finds Café Nicola and requiring
  every word to match so "lisbon prawns" narrows to one. A place whose trip
  was removed drops out rather than linking nowhere.
- **Bundle split by route.** Main chunk 606 KB → 423 KB. A phone opening a
  recipe no longer downloads the family-tree engine, the places browser, or
  112 KB of document parsers behind the importer. Verified by clicking
  through the real tab bar: one chunk on first load, one more per route.

**Design note:** the would-return flag is deliberately three-state. NULL
means nobody said, which is not "no" — defaulting an unanswered question to
no would quietly libel every restaurant added in a hurry.

**Confirmed, not assumed:** `saveChildren` tidies travellers with an
unquoted PostgREST `in.()` list of UUIDs, which looked like the bug that
once broke the passport sync on `GB-ENG`. It is fine — UUIDs contain no
commas — and that was checked against the live API rather than reasoned
about.

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
