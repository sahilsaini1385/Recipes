/**
 * How a cooking log reads.
 *
 * The point of this feature is accumulation — one entry says almost nothing,
 * thirty say when a family eats a thing and who makes it. So the summary line
 * is written to be worth reading at both extremes, and never to claim more
 * than the rows support.
 */

export interface RecipeCook {
  id: string;
  recipe_id: string;
  /** ISO date, "2026-09-12". Stored as a date, so no timezone to get wrong. */
  cooked_on: string;
  cooked_by: string | null;
  note: string | null;
}

/** Today as an ISO date in the viewer's own timezone, for the date field. */
export function todayISO(now: Date = new Date()): string {
  // Not toISOString(): that converts to UTC, so anyone west of Greenwich
  // logging a bake after 5pm would have it dated tomorrow.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "12 September 2026" — a date somebody reads, not sorts by. */
export function formatCookDate(iso: string, now: Date = new Date()): string {
  const d = parseISODate(iso);
  if (!d) return iso;
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/**
 * Parse "2026-09-12" as a local date.
 *
 * `new Date("2026-09-12")` is parsed as UTC midnight, which in the Americas
 * renders as the day before. The passport sync learned this the hard way; a
 * cooking log dated one day early is the same bug wearing a different hat.
 */
export function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const [y, mo, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(y, mo - 1, day);
  // The Date constructor rolls overflow forward rather than failing — month
  // 13 day 45 becomes the following February — so a nonsense date would come
  // back looking perfectly plausible. Check it round-trips.
  if (
    d.getFullYear() !== y ||
    d.getMonth() !== mo - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d;
}

/** Newest first, and stable for two cooks logged on the same day. */
export function byMostRecent(a: RecipeCook, b: RecipeCook): number {
  return b.cooked_on.localeCompare(a.cooked_on) || b.id.localeCompare(a.id);
}

/**
 * The one-line summary above the log.
 *
 * Deliberately says nothing about "who usually makes it" until one person
 * clearly does — with two entries by different people, naming either is just
 * noise dressed up as insight.
 */
export function summarise(cooks: RecipeCook[], now: Date = new Date()): string {
  if (cooks.length === 0) return "";
  const times = cooks.length === 1 ? "Cooked once" : `Cooked ${cooks.length} times`;
  const sorted = [...cooks].sort(byMostRecent);
  const last = formatCookDate(sorted[0].cooked_on, now);

  const cook = dominantCook(cooks);
  if (cook) return `${times} · usually ${cook} · last on ${last}`;
  return `${times} · last on ${last}`;
}

/**
 * The person who makes this, when there is one.
 *
 * Requires at least three entries and a clear majority. Below that the answer
 * is an accident of who happened to log first.
 */
export function dominantCook(cooks: RecipeCook[]): string | null {
  const named = cooks
    .map((c) => (c.cooked_by ?? "").trim())
    .filter(Boolean);
  if (named.length < 3) return null;

  const counts = new Map<string, number>();
  for (const name of named) {
    const key = name.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const [topKey, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topCount * 2 <= named.length) return null; // not a majority

  // Give back the spelling they actually typed, not the lowercased key.
  return named.find((n) => n.toLowerCase() === topKey) ?? null;
}

/**
 * Names to offer as one-tap suggestions, commonest first.
 *
 * Drawn from what has already been typed on this site rather than from the
 * family tree: the people who cook are a much shorter list than the 38 people
 * on the tree, and this way it learns.
 */
export function cookSuggestions(
  cooks: RecipeCook[],
  limit = 6
): string[] {
  const counts = new Map<string, { name: string; n: number }>();
  for (const c of cooks) {
    const name = (c.cooked_by ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const seen = counts.get(key);
    counts.set(key, { name: seen?.name ?? name, n: (seen?.n ?? 0) + 1 });
  }
  return [...counts.values()]
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((e) => e.name);
}
