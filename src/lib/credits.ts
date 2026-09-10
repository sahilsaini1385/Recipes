/**
 * Tying a recipe's credit to a person on the family tree.
 *
 * 125 of the 178 recipes name where they came from, in free text somebody
 * typed years ago: "Nancy Jungman", "Jungman, Kathryn", "John and Will
 * Jungman", "Giada De Laurentiis, Everyday Italian cookbook, p. 197
 * (submitted by Nancy Jungman)", and one that is just a comma. Most name
 * people who are not family at all — cookbooks, websites, friends.
 *
 * Two things about the real data drive the whole design:
 *
 * 1. **Spouses are a field, not a row.** Nancy Jungman has 34 recipes, more
 *    than anyone, and she is `spouse_name` on John's row rather than a row of
 *    her own. A join on tree_members.name alone misses the single biggest
 *    contributor in the archive.
 *
 * 2. **Guessing is worse than missing.** The tree holds two Frank Jungmans
 *    and a Karina Litwack, while the recipes credit a "Frank Jungman" and a
 *    "Karina Valencia". Attributing Grandma's cornbread to the wrong
 *    grandfather is a real harm in a family archive; leaving it as plain text
 *    costs nothing. So anything ambiguous stays unmatched.
 */

export interface CreditPerson {
  id: string;
  name: string;
  spouse_name: string | null;
}

export interface CreditMatch {
  /** The tree row to open. For a spouse this is the row they are married into. */
  personId: string;
  /** The name as the tree spells it, which is what to show. */
  name: string;
}

interface Entry {
  personId: string;
  name: string;
}

export interface CreditIndex {
  /** Normalised full name -> the people it could mean. */
  full: Map<string, Entry[]>;
  /** Normalised first name -> the people it could mean. */
  first: Map<string, Entry[]>;
}

/**
 * Lowercase, drop quoted nicknames, collapse punctuation and spaces.
 * Handles curly quotes: the tree contains Thomas “Knox” Emerson.
 */
export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/["“”'’]([^"“”'’]*)["“”'’]/g, " ")
    .replace(/[.,;:()[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "jungman, kathryn" reads as "kathryn jungman". */
function unreverse(value: string): string | null {
  const m = value.match(/^([^,]+),\s*([^,]+)$/);
  if (!m) return null;
  return `${m[2].trim()} ${m[1].trim()}`;
}

function addEntry(map: Map<string, Entry[]>, key: string, entry: Entry): void {
  if (!key) return;
  const list = map.get(key) ?? [];
  // The same person registered twice under one key is not an ambiguity.
  if (!list.some((e) => e.personId === entry.personId && e.name === entry.name)) {
    list.push(entry);
  }
  map.set(key, list);
}

/**
 * Build the lookup from the tree, registering each person under their full
 * name and their first name, and doing the same for their spouse against the
 * same row.
 */
export function buildCreditIndex(people: CreditPerson[]): CreditIndex {
  const full = new Map<string, Entry[]>();
  const first = new Map<string, Entry[]>();

  const register = (personId: string, rawName: string | null) => {
    if (!rawName) return;
    const norm = normalizeName(rawName);
    if (!norm) return;
    const entry: Entry = { personId, name: rawName.replace(/\s+/g, " ").trim() };
    addEntry(full, norm, entry);

    const words = norm.split(" ");
    // "Y Frank Jungman" is also written "Frank Jungman". Registering the
    // shortened form is what makes the two Frank Jungmans collide, which is
    // the point: the collision is real and must be detected, not hidden.
    if (words.length > 2 && words[0].length === 1) {
      addEntry(full, words.slice(1).join(" "), entry);
    }
    addEntry(first, words[0], entry);
  };

  for (const p of people) {
    register(p.id, p.name);
    register(p.id, p.spouse_name);
  }
  return { full, first };
}

/** Only ever resolves when exactly one person can be meant. */
function unique(list: Entry[] | undefined): Entry | null {
  if (!list || list.length !== 1) return null;
  return list[0];
}

/**
 * Split a credit into the separate people it might name. "Betsy Rayle /
 * Nancy Jungman" and "John and Will Jungman" are two each; "Charleston
 * Receipts, 1950" is two segments that happen to name nobody.
 */
function segments(credit: string): string[] {
  return credit
    .split(/\s*[/;&]\s*|,\s*|\s+\band\b\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Everyone on the tree that a credit names. Empty when it names nobody, which
 * is the common case — most credits are cookbooks and websites.
 */
export function matchCredit(
  credit: string | null,
  index: CreditIndex
): CreditMatch[] {
  if (!credit) return [];
  const found = new Map<string, CreditMatch>();
  const take = (e: Entry | null) => {
    if (e) found.set(`${e.personId}:${e.name}`, { personId: e.personId, name: e.name });
  };

  for (const raw of segments(credit)) {
    const norm = normalizeName(raw);
    if (!norm) continue;

    // Whole segment is a name we know.
    const direct = unique(index.full.get(norm));
    if (direct) {
      take(direct);
      continue;
    }

    // "Jungman, Kathryn" — but the comma already split it, so try the raw
    // credit's reversed form too, further down.
    const flipped = unreverse(raw);
    if (flipped) {
      const r = unique(index.full.get(normalizeName(flipped)));
      if (r) {
        take(r);
        continue;
      }
    }

    // A name buried in prose: "submitted by nancy jungman".
    let embedded: Entry | null = null;
    let embeddedAmbiguous = false;
    for (const [key, list] of index.full) {
      if (key.includes(" ") && new RegExp(`\\b${escapeRe(key)}\\b`).test(norm)) {
        const one = unique(list);
        if (!one) {
          embeddedAmbiguous = true;
          continue;
        }
        // Prefer the longest name found, so "y frank jungman" wins over
        // "frank jungman" when both appear.
        if (!embedded || key.length > normalizeName(embedded.name).length) {
          embedded = one;
        }
      }
    }
    if (embedded) {
      take(embedded);
      continue;
    }
    if (embeddedAmbiguous) continue;

    // A bare first name, but only when nobody else shares it. "Nancy" is
    // safe; "Kathryn" is two people on this tree and stays plain text.
    if (!norm.includes(" ")) take(unique(index.first.get(norm)));
  }

  // The whole credit reversed, for "Jungman, Kathryn" which segmenting split.
  if (found.size === 0) {
    const flipped = unreverse(credit);
    if (flipped) take(unique(index.full.get(normalizeName(flipped))));
  }

  return [...found.values()];
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Group recipes by the tree row they are credited to.
 *
 * A tree row is a couple, so both halves land in the same bucket: Nancy is
 * `spouse_name` on John's row, and her 48 recipes key on his id. `names`
 * therefore lists everyone in the bucket who was actually credited, so a page
 * can say "John Jungman & Nancy Jungman" rather than picking one of them and
 * quietly crediting him with her cooking.
 */
export function groupByPerson<T extends { credit: string | null }>(
  recipes: T[],
  index: CreditIndex
): Map<string, { names: string[]; recipes: T[] }> {
  const map = new Map<string, { names: string[]; recipes: T[] }>();
  for (const r of recipes) {
    for (const m of matchCredit(r.credit, index)) {
      const bucket = map.get(m.personId) ?? { names: [], recipes: [] };
      if (!bucket.names.includes(m.name)) bucket.names.push(m.name);
      bucket.recipes.push(r);
      map.set(m.personId, bucket);
    }
  }
  return map;
}
