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

- **3.2 — Meal plan for the week** *(M)*
  Drag or tap recipes onto days. Feeds 3.1 directly.
- **3.4 — Recipe photos from the family** *(S)*
  Storage and policies are already in place and unused. Let people add a
  photo of the finished dish from their phone.

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
- **Tests.** Anything with real logic gets tests. 196 across 15 files today.
- **Accessibility.** Audited with axe-core on 2026-09-14 across every page at
  phone width. **Exactly one rule failed anywhere: colour contrast**, and it
  was the same mistake repeated — `text-accent-dark/70` and `/80` on small
  uppercase headings, and plain `text-accent` on links. Undiluted,
  `accent-dark` measures 5.37–5.95 against every paper surface, so the fix
  was to stop thinning it rather than to change any token. Nothing else
  failed: no missing labels, no unlabelled controls, no heading-order or
  landmark problems. Still unexamined: keyboard focus order and how the tree
  chart reads to a screen reader — axe cannot judge either.
- **Performance.** Route splitting done (main chunk 429 KB). Next: the
  remaining 423 KB is React plus the Supabase client, so the wins now are
  image handling for 1.6 and avoiding a fourth copy of the country list.

### Known open items

- Three orphan edge functions in Supabase — `super-processor`,
  `hyper-responder`, `dynamic-task`. Nothing calls them; they squat names.
- Leaked-password protection is off (dashboard toggle, owner's action).
- **Six of the seven allowlisted family members have never created an
  account.** Every write feature — adding recipes, trips, places, cooking
  entries — is invisible to them, and every one of the 178 recipes is
  attributed to the single account that exists. This is the biggest limit on
  the app right now and no amount of building fixes it.
- `email_allowed` is callable anonymously, so anyone can test whether a given
  address is on the family allowlist. The list itself is not readable
  (verified). It is a deliberate trade-off — the sign-in page uses it to
  offer registration, and now to gate the emailed link too — and closing it
  means moving the check server-side, which touches sign-in. Awaiting a
  decision.
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

### 2026-09-14

- **Six recipes were pretending to be recipes.** The importer left shells
  behind — three with no ingredients *and* no steps, three more missing one
  or the other. One of them says so in its own notes: "Recipe content could
  not be extracted from the source file." The page dressed them up anyway: a
  servings control scaling nothing, a US/Metric toggle converting nothing,
  empty Ingredients and Steps headings, a Cook mode button leading to a blank
  full-screen view, and a Print link that produced an empty sheet. All of
  that is now gated on there being something to show, and a shell says
  plainly *"This one hasn't been written down yet"* with an Add the recipe
  button for family. The shopping list names a ticked recipe that has no
  ingredients instead of silently contributing nothing.
- **The first accessibility audit.** axe-core, every page, phone width.
- **`TripPage` said "Trip not found" on a failed read** — the same bug fixed
  for recipes on the 12th, still live on trips.

**The audit found exactly one rule failing, everywhere: colour contrast.** No
missing labels, no unlabelled controls, no heading-order or landmark faults —
which is a genuinely good result for a codebase that had never been checked.
And the failures were all one mistake repeated: `text-accent-dark/70` and
`/80` on the small uppercase section headings, and plain `text-accent` on
links. The tab bar already carried a comment noting plain accent measures
4.22:1 and is "just under the readability floor", so the decision had been
made once and simply never applied anywhere else.

**The fix changes no colour token.** Undiluted, `accent-dark` measures
5.37–5.95 against every paper surface in the palette; the opacity modifiers
were what pushed it to 3.23–4.22. So the fix was to stop thinning it.

**What the audit cannot tell you**, and is therefore still open: keyboard
focus order, and how the family tree chart reads to a screen reader.

**Learned, for whoever builds next:** axe takes ~24s per page in this
environment, mostly injecting its own 600 KB bundle. Sixteen page-runs blow
any sensible timeout, so audit at one width, write each page's result to a
file as it completes, and never pipe the run through `tail` — the buffering
hides all progress and a hung page looks identical to a slow one.

### 2026-09-13

- **The emailed sign-in link no longer lets strangers in.** `signInWithOtp`
  creates an account for an unknown address by default — confirmed in
  Supabase's own documentation — and this path never called `email_allowed`,
  though the password path beside it always did. So **anyone at all could
  create an account on the family's project, and make it send them mail**.
  They could never write anything (`is_family()` gates every write policy on
  the allowlist, checked), so this was unauthorised account creation and an
  open mail relay rather than a data leak. Verified fixed by driving the page
  with a non-allowlisted address and confirming **zero** requests reach the
  OTP endpoint, where a family address still sends exactly one.
- **The sign-in page now leads with the emailed link.** The password is still
  there behind "I know the family password".
- **3.6 Print view — shipped.** A "Print this recipe" link, and a print
  stylesheet that strips the site down to the recipe.

**Why the sign-in rework counts as the important half of today.** Six of the
seven people on the allowlist have never made an account, and the thing in
their way was a shared password somebody had to tell them. The emailed link
needs nothing anyone has to remember and works the first time. This is the
same finding as yesterday, acted on rather than reported again.

**The printed page is the same DOM as the screen**, with the furniture hidden
by `print:hidden` rather than a second rendering of the recipe. That means
paper always matches what you were looking at — the servings you scaled to
and the units you picked — with no separate code path to drift out of step.
Verified at real A4 width, not just in a wide viewport.

**Caught by looking at the output:** the site header printed above every
recipe. The blanket rule that keeps fixed furniture off the page did not
catch it, because the header is `sticky`, not `fixed`.

**No new tests today, and that is worth stating plainly.** Everything shipped
was CSS and a guard in front of a network call; the honest verification is
the browser, and it is the browser that caught both faults. The count stays
at 196.

### 2026-09-12

- **Three pages stopped claiming data was missing when the read had failed.**
  A recipe page told anyone on a patchy connection **"Recipe not found"** —
  about a recipe sitting safely in the database. The edit screen said the
  same, inviting somebody to re-add a recipe they still had, and the shopping
  page offered an empty picker and a cheerful "tick a few recipes" as though
  the collection were empty. All four reads now say *"Couldn't load this —
  nothing has been lost"* with a Try again that recovers in place, verified by
  bringing the backend back up mid-session and pressing it.
- **3.3 "We cooked this" — shipped.** `recipe_cooks`: a date, optionally who
  made it, optionally how it went. A recipe with history shows "Cooked 8
  times · usually Nancy · last on 30 August"; a recipe without shows one
  quiet button to family and nothing at all to anyone else.

**`cooked_by` is free text, and that is the important decision.** Seven
addresses are on the allowlist and **exactly one has ever created an
account**, so keying the cook to the signed-in user would have written one
name on every entry the family ever logged. It is not a `tree_members`
reference either — the cook might be a friend, a child too young to be on the
tree, or "all of us". The name chips under the field are learned from what has
already been typed *here*, so the list gets shorter and better with use rather
than offering all 38 people on the tree.

**It refuses to guess a regular cook** until there are at least three entries
and a clear majority. Below that, "usually Nancy" is just an accident of who
logged first dressed up as insight.

**Caught by looking at the screenshots, twice.** The summary line counted only
the five entries on screen, so eight cooks read as "Cooked 5 times". And the
add form opened underneath the fixed Cook mode bar — the recipe page's bottom
padding had been 32px short of the bar's height all along, which nothing had
made visible until this section became the last thing on the page.

**Caught by a test I wrote:** `new Date(2026, 12, 45)` does not fail, it rolls
forward to the following February. A malformed date would have rendered as a
plausible wrong one, so `parseISODate` now checks the date round-trips.

**Learned, for whoever builds next:** the mock now has an auth stub. POST to
`/auth/v1/token` returns a session supabase-js will persist, and `is_family`
returns true, so the family-only half of any feature can be driven in the
browser. Sign in with `form button[type=submit]` — `getByRole('button', {name:
/sign in/i})` matches the header's button first and silently does nothing.

### 2026-09-11

- **A three-times error in every metric conversion — fixed.** On a
  handwritten recipe card `T` is a tablespoon and `t` is a teaspoon. The
  collection uses both — 70 lines say T, 91 say t — and `normalizeUnit`
  lowercased them together, so **every teaspoon in 32 recipes was shown at
  three times its real amount** in Metric. "0.25 t Tabasco" read as 5 ml
  instead of 1 ml. The old code carried a comment calling the capital-T
  convention "rare"; counting the table showed it is the second most common
  unit in the archive. Only the bare letter is ambiguous, so only the bare
  letter is now case-sensitive.
- **3.1 Shopping list — shipped.** `/shopping`, reachable from the cart in
  the header. Tick recipes, get one list grouped by aisle, tick items off as
  you shop. The chosen recipes live in the URL so a list can be sent to
  whoever is going, and the ticks live in `localStorage` so a phone locking
  in a pocket does not lose what is already in the basket.

**Amounts are added, never converted.** Butter across three recipes reads
"1 cup + 5 tablespoons", not "1⅓ cups". The collection has 100 distinct unit
strings for about 25 real units, and a conversion is a chance to be wrong
about something the cook already wrote down correctly. Same reasoning stops a
"can" merging with a "package": one jar when the recipe wants two is a
failed dinner, and these are genuinely different things.

**The aisle rules are ordered, and the order is the logic.** "garlic powder"
has to be caught by Spices before Produce sees the word garlic; "cream of
mushroom soup" by Pantry before Dairy sees cream; a jalapeño by Produce
before Spices sees pepper. A sweep over all 741 distinct items is what found
each of these — and found that a trailing `\b` in the produce pattern was
quietly dropping every plural, so "blueberries" and "avocados" were landing
in Everything else. Unclassified items fell from 114 to 59, and what remains
is honestly miscellaneous: Cool Whip, velveeta, hickory wood pellets, and a
Bic-type lighter.

**Tap water is left off.** It is 18 lines in the collection and nobody buys
it. Seltzer water, coconut water and ice stay.

**Learned, for whoever builds next:** 52 item fields hold a comma list rather
than one ingredient — "lemons, pineapple, sugar" is one row, but so is
"salmon fillets, skin on". Splitting on the comma would wreck the second, so
these go on the list verbatim. And 427 lines have no unit at all while some
have no quantity either; an ingredient you cannot count is still one you have
to buy, so they are listed with a blank amount rather than dropped.

**Corrected while building:** the first UI put the recipe picker above the
list. On a 390px phone it filled the screen and left room for three items of
the thing you actually came for. It now folds away behind "Add another
recipe" as soon as there is a list. Caught by looking at the screenshot.

**Environment note:** `pkill -f "[m]ock.mjs"` still kills the shell — the
bracket pattern protects the pkill's own process but not the parent shell,
whose command line contains the unbracketed path. Find the PID by port
(`ss -lptn 'sport = :54321'`) and kill that.

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
