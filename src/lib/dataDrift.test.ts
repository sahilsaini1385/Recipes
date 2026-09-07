import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { COUNTRIES } from "./countries";
import { US_STATES } from "./usStates";
import { CATEGORIES } from "./categories";

/**
 * The country, state and category lists exist in more than one place: the
 * site (TypeScript), the passport-sync edge function (Deno -- it cannot
 * import from src/), and a CHECK constraint in SQL. They can't share code,
 * so this guards the next best thing: that they stay identical. Silent drift
 * here means a place the picker offers but the sync ignores, or a category
 * the app allows and the database rejects at save time.
 */

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

describe("country list", () => {
  it("matches the codes passport-sync knows about", () => {
    const fn = read("supabase/functions/passport-sync/index.ts");
    const table = fn
      .slice(fn.indexOf("const COUNTRY_NAMES"), fn.indexOf("const COUNTRY_ALIASES"))
      .replace(/\/\/[^\n]*/g, ""); // comments can sit between entries
    // Keys are bare (AF:) or quoted ("GB-ENG":).
    const codes = new Set(
      [...table.matchAll(/"?\b([A-Z]{2}(?:-[A-Z]{3})?)"?\s*:/g)].map((m) => m[1])
    );
    const site = new Set(COUNTRIES.map((c) => c.code));
    expect([...site].filter((c) => !codes.has(c)).sort()).toEqual([]);
    expect([...codes].filter((c) => !site.has(c)).sort()).toEqual([]);
  });

  it("has no duplicate codes", () => {
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
  });
});

describe("US state list", () => {
  it("matches the codes passport-sync accepts", () => {
    const fn = read("supabase/functions/passport-sync/index.ts");
    const block = fn.slice(
      fn.indexOf("const STATE_CODES"),
      fn.indexOf("const STATE_ALIASES")
    );
    const codes = new Set([...block.matchAll(/"([A-Z]{2})"/g)].map((m) => m[1]));
    const site = new Set(US_STATES.map((s) => s.code));
    expect([...site].filter((c) => !codes.has(c)).sort()).toEqual([]);
    expect([...codes].filter((c) => !site.has(c)).sort()).toEqual([]);
    expect(site.size).toBe(50);
  });
});

describe("recipe categories", () => {
  const site = [...CATEGORIES];

  it("matches the parser's schema enum", () => {
    const fn = read("supabase/functions/parse-recipe/index.ts");
    const block = fn.slice(fn.indexOf("const CATEGORIES"));
    const list = block.slice(0, block.indexOf("]"));
    const parsed = [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(parsed).toEqual(site);
  });

  it("matches the database CHECK constraint", () => {
    const sql = read("supabase/migrations/00001_init.sql");
    const check = sql.slice(sql.indexOf("category text not null check"));
    const list = check.slice(0, check.indexOf("))"));
    const parsed = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(parsed).toEqual(site);
  });
});
