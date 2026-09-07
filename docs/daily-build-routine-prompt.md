# Daily build routine — prompt to paste into the Routines UI

Creating the routine from **claude.ai → Routines** attaches your connectors
automatically, which a routine created from inside a session cannot do (the
`connectors` parameter is blocked for this organization).

**Settings to use**

| Field | Value |
| --- | --- |
| Name | Daily family app build |
| Schedule | Daily, 04:00 America/Los_Angeles |
| Session | New session each run |
| Connectors | Supabase, Vercel |
| Notifications | Push + email |

Then paste everything below the line as the prompt.

Once it exists, disable the connector-less routine of the same name so the
build does not run twice a day.

---

You are doing today's build on the Jungman family app. Work autonomously and finish with a written report — the owner (Sahil) reads the report, not the transcript, so it has to stand alone.

## The app

A private, mobile-first family site with three sections: Recipes (178, with LLM import, a serving scaler, cost estimates, a metric toggle and a cook mode), Family Passport (every country and US state 11 family members have visited, synced from a Google Sheet), and Family Tree (38 people, 5 generations). Vite + React 18 + TypeScript + Tailwind v3, Supabase behind it. Burnt orange (#bf5700).

Supabase project `kxcljwwfpmyyipbodtsi`. Vercel team `team_pwZsv4t3YiMejj0Cy6KDxXg9`, project `prj_aCTmSAeym1sO8j3Vd3JVsywAggvg`. Load the connectors with ToolSearch (`mcp__Supabase__*`, `mcp__Vercel__*`).

## Repos and the push pattern — read carefully

- Source repo: `sahilsaini1385/Recipes`, cloned at `/home/user/Recipes`. Work on branch `claude/family-recipe-website-njehm7`.
- Deploy repo: `sahilsaini1385/recipe`, branch `main`. **This is what Vercel builds.** Clone if absent:
  `git clone https://github.com/sahilsaini1385/recipe.git /workspace/recipe`
- To ship, mirror source into the deploy repo:
  ```
  cd /workspace/recipe && git fetch origin main && git reset --hard origin/main
  find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
  git -C /home/user/Recipes archive claude/family-recipe-website-njehm7 | tar -x -C /workspace/recipe
  ```
  Then verify it independently (`npm ci && npx tsc --noEmit && npx vitest run && npm run build`) before pushing.
- Commit trailer on every commit:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_018o3Rv1Mq6aKfPwgF8Dftn2`
- Push both repos. Do not open pull requests.

## What to build

Read `docs/BACKLOG.md` first — it explains the app's thesis, its principles, and what is deliberately out of scope. Then pick:

- **one feature slice** from a theme, working top-down within a theme, and
- **at least one quality item** — a real bug, a UX improvement, cleanup, tests, accessibility or performance.

Prefer fixing a real bug over adding a small feature, always. Size the work so it genuinely finishes today; half a feature shipped is worse than none.

**Design against real data, never imagined data.** Query the live database with `mcp__Supabase__execute_sql` before designing anything that touches recipes, tree or passport content. The last two features built here were both reshaped by what the real rows turned out to contain — a generic ingredient pluraliser produced "3 garlics" and "2 broccolis" until it was rewritten against the actual 103 ingredient names.

## Database changes

- Additive and re-runnable. New numbered file in `supabase/migrations/`, applied with `mcp__Supabase__apply_migration` against `kxcljwwfpmyyipbodtsi`.
- Never rewrite a migration that has already been applied.
- New tables get RLS on, with write policies gating on `is_family()` — never bare `authenticated`.
- Run `mcp__Supabase__get_advisors` (security) afterwards. Report anything new; pre-existing findings are not yours to panic about, but mention them if you see them.

## Gates — all must pass before anything is pushed

1. `npx tsc --noEmit` clean
2. `npx vitest run` — every test passing; new logic gets new tests
3. `npm run build` succeeds
4. **Browser check.** Build, serve (`npx vite preview --port 4173`), and drive the pages you touched with Playwright/Chromium (`executablePath: '/opt/pw-browsers/chromium'`) at 390×844 and 1280×800. **Actually look at the screenshots.** Check the console is clean. A UI change you have not looked at is not done.
5. Independent verification of the deploy repo as above.

If any gate fails and you cannot fix it, **push nothing**, and say so plainly in the report. A red day reported honestly is fine; a broken family site is not.

## Rules

- **Never weaken security.** Do not expose `allowed_emails`, do not commit secrets. The anon key is public by design; nothing else is.
- **The Google Sheet stays the source of truth for the passport.** Do not change how `passport-sync` decides counts, and do not make passport data derive from anything else.
- **Do not touch the `finance` schema or `finance.budgie_sync*`.** A different app lodges in the same database. Do not pause, restore or delete any Supabase or Vercel project.
- **This is an archive: never lose data.** Deletes soft, syncs add before they remove, edits keep the original where practical.
- Match the surrounding code's style and comment density. Comments explain why, not what.

## Confirming the deploy

After pushing, poll `mcp__Vercel__list_deployments` until your commit's deployment reaches READY. Then confirm the family actually sees it: `curl -s https://recipe-six-murex.vercel.app/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'` should show a hash different from before your push. If either check does not come good after several minutes, say so rather than assuming.

## Finish by

1. Moving anything shipped into the Log section of `docs/BACKLOG.md`, with the date and a one-line note. Add new items you discovered.
2. Writing the report as your final message:
   - **Shipped** — what, and why it was worth doing
   - **Verified** — the gates, what you saw in the browser, and the deployment state
   - **Not shipped** — anything attempted and abandoned, and why
   - **Needs Sahil** — decisions or dashboard actions only he can take
   - **Next** — what tomorrow should pick up

Write it for someone non-technical who cares about the outcome. Plain language, no jargon, no filler. Be honest about what did not work.
