#!/usr/bin/env node
/**
 * Idempotent seed: imports recipes.json into the `recipes` table.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed.mjs [path/to/recipes.json]
 *
 * - De-duplicates by normalized title: "Copy of X", "X (1)", and .doc/.docx
 *   duplicates collapse to one recipe, keeping the most complete version.
 * - Skips entries that are not recipes (no ingredients AND no steps).
 * - Re-running never creates duplicates (existing slugs are left alone).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

const CATEGORIES = new Set([
  "Appetizers & Party Food",
  "Baby & Toddler",
  "Bread",
  "Breakfast",
  "Dessert",
  "Drinks",
  "Entrees",
  "Salads",
  "Dressings & Sauces",
  "Sides",
  "Soup",
]);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
  );
  process.exit(1);
}

const file = process.argv[2] ?? "recipes.json";
if (!existsSync(file)) {
  console.log(`No seed file found at ${file} — nothing to do.`);
  process.exit(0);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

/** "Copy of Chili (1).docx" -> "chili" */
function normalizeTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/\.(docx?|pdf|txt|rtf)$/i, "")
    .replace(/^copy of\s+/i, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Higher = more complete; used to pick the best duplicate. */
function completeness(r) {
  return (
    (r.ingredients?.length ?? 0) * 2 +
    (r.steps?.length ?? 0) * 2 +
    (r.notes ? 1 : 0) +
    (r.photo_path ? 2 : 0) +
    (r.credit ? 1 : 0) +
    (r.source_url ? 1 : 0)
  );
}

function cleanIngredient(ing) {
  if (typeof ing === "string") {
    return {
      raw: ing,
      quantity: null,
      quantity_max: null,
      unit: null,
      item: ing,
      note: "",
      scalable: false,
    };
  }
  const quantity = typeof ing.quantity === "number" ? ing.quantity : null;
  return {
    raw: String(ing.raw ?? ing.item ?? ""),
    quantity,
    quantity_max:
      typeof ing.quantity_max === "number" ? ing.quantity_max : null,
    unit: ing.unit ?? null,
    item: String(ing.item ?? ing.raw ?? ""),
    note: String(ing.note ?? ""),
    scalable: quantity != null,
  };
}

const raw = JSON.parse(readFileSync(file, "utf8"));
const entries = Array.isArray(raw) ? raw : raw.recipes ?? [];
console.log(`Read ${entries.length} entries from ${file}`);

// 1. Filter out non-recipes and normalize.
const candidates = entries
  .filter((e) => e && e.title)
  .map((e) => ({
    title: String(e.title).trim(),
    category: CATEGORIES.has(e.category) ? e.category : "Entrees",
    credit: String(e.credit ?? ""),
    source_url: e.source_url ?? null,
    base_servings: Number.isInteger(e.base_servings) && e.base_servings > 0
      ? e.base_servings
      : 4,
    servings_estimated:
      typeof e.servings_estimated === "boolean"
        ? e.servings_estimated
        : !Number.isInteger(e.base_servings),
    ingredients: (e.ingredients ?? []).map(cleanIngredient),
    steps: (e.steps ?? []).map(String).filter(Boolean),
    tags: (e.tags ?? []).map((t) => String(t).toLowerCase()),
    notes: e.notes ?? null,
    photo_path: e.photo_path ?? null,
  }))
  .filter((r) => r.ingredients.length > 0 || r.steps.length > 0);

const skippedNonRecipes = entries.length - candidates.length;

// 2. De-duplicate by normalized title, keeping the most complete version.
const byTitle = new Map();
for (const r of candidates) {
  const norm = normalizeTitle(r.title);
  if (!norm) continue;
  const existing = byTitle.get(norm);
  if (!existing || completeness(r) > completeness(existing)) {
    // Prefer the cleaner title (without "Copy of"/"(1)" cruft) either way.
    if (existing && normalizeTitle(existing.title) === norm) {
      const cleaner =
        existing.title.length < r.title.length ? existing.title : r.title;
      r.title = cleaner;
    }
    byTitle.set(norm, r);
  }
}
const deduped = [...byTitle.values()];
console.log(
  `${candidates.length} recipes after filtering (${skippedNonRecipes} non-recipes skipped), ${deduped.length} after de-duplication`
);

// 3. Insert only recipes whose slug does not exist yet (idempotent).
const { data: existingRows, error: readError } = await supabase
  .from("recipes")
  .select("slug");
if (readError) {
  console.error("Failed reading existing recipes:", readError.message);
  process.exit(1);
}
const existingSlugs = new Set((existingRows ?? []).map((r) => r.slug));

let inserted = 0;
let skipped = 0;
for (const r of deduped) {
  let slug = slugify(r.title) || "recipe";
  if (existingSlugs.has(slug)) {
    skipped++;
    continue;
  }
  existingSlugs.add(slug);
  const { error } = await supabase.from("recipes").insert({ ...r, slug });
  if (error) {
    console.error(`Failed to insert "${r.title}": ${error.message}`);
  } else {
    inserted++;
  }
}

console.log(`Done. Inserted ${inserted}, skipped ${skipped} already present.`);
