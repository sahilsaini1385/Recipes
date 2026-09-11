/**
 * Turning a handful of recipes into one shopping list.
 *
 * Everything here is shaped by what the 1,589 ingredient lines in this
 * collection actually contain, rather than by what a tidy recipe schema would
 * look like:
 *
 * 1. **The same thing is written many ways.** 100 distinct unit strings for
 *    maybe 25 real units, and "egg"/"eggs"/"large eggs" are three entries.
 *    Amounts are only ever added together when the units genuinely agree.
 * 2. **Nothing is converted that the family did not write.** "1 cup + 2
 *    tablespoons flour" is shown as exactly that. Inventing "1⅛ cups" would
 *    be arithmetic the cook did not ask for, and would be wrong the moment a
 *    unit is ambiguous.
 * 3. **427 of the lines have no unit at all** ("3 eggs", "salt and pepper"),
 *    and some have no quantity either. Those still belong on the list — an
 *    ingredient you cannot count is still one you have to buy.
 */

import { formatQuantity } from "./scaling";
import { pluralizeItem } from "./plural";
import { normalizeUnit, unitMagnitude } from "./units";
import type { Ingredient } from "./types";

export interface ShoppingSource {
  title: string;
  ingredients: Ingredient[];
}

export interface ShoppingLine {
  /** Stable identity for ticking off, and for React keys. */
  key: string;
  /** The item as the collection spells it, most common spelling winning. */
  label: string;
  /** "2 cups", "1 tablespoon" — one entry per unit that could not be merged. */
  amounts: string[];
  /** Recipe titles that wanted it, so a surprising line can be traced. */
  from: string[];
  aisle: Aisle;
}

export interface ShoppingGroup {
  aisle: Aisle;
  lines: ShoppingLine[];
}

export type Aisle =
  | "Produce"
  | "Meat & seafood"
  | "Dairy & eggs"
  | "Baking"
  | "Spices"
  | "Pantry"
  | "Drinks"
  | "Everything else";

/** Display order — roughly the order you walk a grocery store. */
export const AISLE_ORDER: Aisle[] = [
  "Produce",
  "Meat & seafood",
  "Dairy & eggs",
  "Baking",
  "Spices",
  "Pantry",
  "Drinks",
  "Everything else",
];

/**
 * Aisle rules, **checked in order — the first match wins**, which is the only
 * reason they work. "garlic powder" has to be caught by Spices before Produce
 * sees the word garlic, and "cream of mushroom soup" by Pantry before Dairy
 * sees cream. Reordering this list changes the answers.
 */
const AISLE_RULES: [Aisle, RegExp][] = [
  // ---- Named exceptions, first, because a later rule would take them. ----
  // Every one of these was mis-filed by the general rules until it was seen
  // in the sweep over all 741 items.
  ["Baking", /\bbaking (powder|soda)\b/], // "powder" otherwise says Spices
  ["Pantry", /\bpeanut butter\b/], // "butter" otherwise says Dairy
  ["Produce", /\b(sugar )?snap peas\b|\bsnow peas\b/], // "sugar" says Baking
  ["Spices", /\bwhole cloves?\b|^cloves?$/], // a clove of garlic is Produce
  ["Pantry", /\bcracker crumbs\b|\bbread ?crumbs\b/], // "crackers" is Pantry too
  ["Dairy & eggs", /\bhalf ?(&|and) ?half\b|\bhalf-and-half\b/],
  ["Pantry", /\b(corn )?tortillas?\b/], // "corn" otherwise says Produce
  ["Pantry", /\b(stewed|diced|crushed|whole) tomato/], // these come in a can here

  // A fresh chile is produce however it is spelled, and has to be seen before
  // the Spices rule reads the word "pepper" inside it.
  ["Produce", /\b(jalape|serrano|poblano|habanero|pepperoncini|bell pepper|sweet pepper)/],

  // Canned and jarred things that name a fresh ingredient, before anything
  // reads the fresh word inside them.
  ["Pantry", /\b(cream|can|jar|bottle)s? of\b|\bsoups?\b|\bbroth\b|\bstock\b|\bbouillon\b|\bbullion\b/],
  ["Pantry", /\b(tomato (paste|sauce|soup)|rotel|salsa|marinara|au jus)\b/],

  // ---- Spices, before the produce words they contain. ----
  ["Spices", /\b(powder|flakes?|seasoning|seasoned|dried|ground|bitters)\b/],
  ["Spices", /\b(salt|pepper|cumin|paprika|cinnamon|nutmeg|cayenne|allspice|turmeric|coriander|oregano|tarragon|marjoram)\b/],
  ["Spices", /\b(bay lea|chili powder|curry|old bay|creole|italian season|dry mustard|tabasco|hot sauce|peppercorn)/],

  // Herbs are a spice in this collection unless the line says fresh — the
  // family writes "0.5 t Thyme, dry" far more often than a bunch of it.
  ["Produce", /\bfresh\b.*(basil|parsley|thyme|rosemary|sage|dill|mint|cilantro|chive|oregano)/],
  ["Spices", /\b(basil|parsley|thyme|rosemary|sage|dill|mint|cilantro|chives?)\b/],

  ["Meat & seafood", /\b(chicken|beef|pork|sausage|bacon|ham|shrimp|catfish|fish|salmon|snapper|scallops?|turkey|lamb|steak|roast|ribs?|crab|oyster|tuna|veal|brisket|chuck|prosciutto|pancetta)\b/],

  ["Dairy & eggs", /\b(butter|margarine|milk|cream|eggs?|cheese|yogurt|buttermilk|ricotta|mozzarella|cheddar|parmesan|romano|feta)\b/],

  ["Baking", /\b(flour|sugar|yeast|vanilla|cocoa|chocolate|cornmeal|cornstarch|cake mix|cornbread mix|molasses|shortening|oats|extract|sprinkles|condensed|evaporated|marshmallow)\b|\bfood (gel|dye|colou?ring)\b/],

  ["Drinks", /\b(rum|brandy|tequila|champagne|wine|vodka|bourbon|whiske?y|triple sec|absolut|cointreau|gin|beer|liqueur|sherry|vermouth|limeade|lemonade|seltzer|soda water|club soda|tea|coffee|cranberry juice|orange juice)\b/],

  // Lemon and lime juice sit with the fruit: this collection asks for it
  // fresh more often than bottled.
  ["Produce", /\b(lemon|lime) juice\b/],

  // Trailing \b is deliberately absent after the stems (blueberr, jalape,
  // avocado…): with it, "blueberries" and "avocados" fell through to
  // Everything else, which is how this was caught.
  ["Produce", /\b(onion|garlic|celery|carrot|lemon|lime|orange|tomato|potato|mushroom|zucchini|bell pepper|sweet pepper|pepperoncini|jalape|serrano|chili?e|chilli|spinach|broccoli|corn|cucumber|lettuce|avocado|apple|banana|berry|berries|blueberr|strawberr|raspberr|pineapple|pumpkin|ginger|scallion|green onion|shallot|leek|cabbage|bok choy|squash|asparagus|cauliflower|eggplant|kale|arugula|pear|peach|plum|grape|melon|mango|cherries|sprout|stalk|turnip|parsnip|radish|chick ?pea|peas\b|salad greens|coleslaw|ramps\b|ears of)/],

  ["Pantry", /\b(oil|vinegar|sauce|ketchup|mayonnaise|mustard|bean|caper|artichoke|olive|pasta|spaghetti|macaroni|noodle|rice|cracker|cereal|honey|syrup|pickle|pimento|jam|jelly|preserves|relish|pecan|almond|walnut|pine nut|cashew|peanut|coconut|raisin|bread|tortilla|grits|couscous|quinoa|lentil|tahini|dressing|mayo|seeds?\b|barley)/],
];

/**
 * Water is 18 lines in this collection and nobody buys it. Bottled things
 * that happen to contain the word — seltzer water, coconut water — are not
 * matched, and ice is left on the list because you do buy that.
 */
const TAP_WATER = /^(ice[- ]?cold |cold |hot |warm |boiling |lukewarm |room temperature )?water$/;

export function isTapWater(item: string): boolean {
  return TAP_WATER.test(item.trim().toLowerCase());
}

/** Which aisle an item belongs in. Unmatched items are not a failure. */
export function aisleFor(item: string): Aisle {
  const hay = item.toLowerCase();
  for (const [aisle, re] of AISLE_RULES) {
    if (re.test(hay)) return aisle;
  }
  return "Everything else";
}

/**
 * The key two spellings of the same thing must share.
 *
 * Only a trailing "s" is folded, and only that — this collection already
 * defeated a general-purpose pluraliser once, which turned garlic into
 * garlics. "capers" and "molasses" keep their s because nothing else in the
 * list collides with them.
 */
export function itemKey(item: string): string {
  const base = item
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,]+$/, "")
    .trim();
  return base.replace(/([a-z]{3,})s$/, "$1");
}

/**
 * The unit two amounts must share to be added together.
 *
 * Built on the same fold the metric conversion uses, so a capital T stays a
 * tablespoon here too. Beyond that it only collapses plurals and the obvious
 * abbreviations: a "can" and a "package" are never the same thing, and
 * pretending otherwise would put one jar of something on the list when the
 * cook needs two.
 */
const UNIT_ALIASES: Record<string, string> = {
  c: "cup", cups: "cup",
  tablespoons: "tablespoon", tbsp: "tablespoon", tbs: "tablespoon", tb: "tablespoon",
  teaspoons: "teaspoon", tsp: "teaspoon", ts: "teaspoon",
  lbs: "pound", lb: "pound", pounds: "pound",
  oz: "ounce", ounces: "ounce",
  g: "gram", grams: "gram",
  cans: "can", boxes: "box", jars: "jar", bottles: "bottle", bags: "bag",
  packages: "package", pkg: "package", pkgs: "package", packets: "packet",
  sticks: "stick", cloves: "clove", bunches: "bunch", ribs: "rib",
  stalks: "stalk", slices: "slice", leaves: "leaf", pieces: "piece",
  quarts: "quart", qts: "quart", qt: "quart", pints: "pint", pt: "pint",
  dashes: "dash", pinches: "pinch", drops: "drop", cartons: "carton",
  containers: "container", parts: "part", strips: "strip", pods: "pod",
};

export function unitKey(unit: string | null): string {
  if (!unit) return "";
  const norm = normalizeUnit(unit);
  return UNIT_ALIASES[norm] ?? norm;
}

/** "2 cups", "1½ tablespoons", "3" when there is no unit at all. */
function formatAmount(total: number, unit: string): string {
  const qty = formatQuantity(total).text;
  if (!unit) return qty;
  // Units the collection writes as words read better inflected; the short
  // ones (oz, lb, g) are the same either way.
  const plural =
    total > 1 && /^(cup|tablespoon|teaspoon|pound|ounce|can|box|jar|bottle|bag|package|packet|stick|clove|bunch|rib|stalk|slice|piece|quart|pint|dash|pinch|drop|carton|container|part|strip|pod)$/.test(unit)
      ? `${unit}s`
      : unit === "leaf" && total > 1
        ? "leaves"
        : unit;
  return `${qty} ${plural}`;
}

interface Bucket {
  /** spelling -> how many lines used it, so the commonest wins the label. */
  spellings: Map<string, number>;
  /** unitKey -> running total, or null when a line had no number. */
  totals: Map<string, number | null>;
  from: Set<string>;
}

/**
 * Combine several recipes into one list, grouped by aisle.
 *
 * Recipes are taken at the servings they are written for. Scaling a shopping
 * list is a separate question from scaling a recipe you are cooking, and
 * guessing at it would silently change what lands in the basket.
 */
export function buildShoppingList(sources: ShoppingSource[]): ShoppingGroup[] {
  const buckets = new Map<string, Bucket>();

  for (const source of sources) {
    for (const ing of source.ingredients) {
      const item = ing.item.trim();
      if (!item || isTapWater(item)) continue;
      const key = itemKey(item);
      if (!key) continue;

      const bucket = buckets.get(key) ?? {
        spellings: new Map(),
        totals: new Map(),
        from: new Set(),
      };
      bucket.spellings.set(item, (bucket.spellings.get(item) ?? 0) + 1);
      bucket.from.add(source.title);

      const u = unitKey(ing.unit);
      // A range ("2 to 3 cups") buys for the top of the range — running out
      // mid-recipe is worse than a little left over.
      const qty = ing.quantity_max ?? ing.quantity;
      if (qty == null || !isFinite(qty)) {
        // No number on this line. Record that the unit appeared so the item
        // still shows, but never let it poison a total.
        if (!bucket.totals.has(u)) bucket.totals.set(u, null);
      } else {
        const running = bucket.totals.get(u);
        bucket.totals.set(u, running == null ? qty : running + qty);
      }
      buckets.set(key, bucket);
    }
  }

  const lines: ShoppingLine[] = [];
  for (const [key, bucket] of buckets) {
    let label = [...bucket.spellings.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
    )[0][0];
    // Biggest unit first, so butter reads "1 cup + 5 tablespoons". Units
    // with no known size keep the order the recipes were picked in.
    const amounts = [...bucket.totals.entries()]
      .filter(([, total]) => total != null)
      .sort(([a], [b]) => (unitMagnitude(b) ?? 0) - (unitMagnitude(a) ?? 0))
      .map(([unit, total]) => formatAmount(total as number, unit));

    // "4 egg" reads like a typo. When the item is being counted directly —
    // one amount, no unit — inflect it with the whitelist pluraliser built
    // for this collection, which knows to leave garlic and broccoli alone.
    const only = [...bucket.totals.entries()];
    if (only.length === 1 && only[0][0] === "" && only[0][1] != null) {
      label = pluralizeItem(label, only[0][1]);
    }
    lines.push({
      key,
      label,
      amounts,
      from: [...bucket.from],
      aisle: aisleFor(label),
    });
  }

  const byAisle = new Map<Aisle, ShoppingLine[]>();
  for (const line of lines) {
    byAisle.set(line.aisle, [...(byAisle.get(line.aisle) ?? []), line]);
  }
  return AISLE_ORDER.filter((a) => byAisle.has(a)).map((aisle) => ({
    aisle,
    lines: (byAisle.get(aisle) ?? []).sort((a, b) =>
      a.label.localeCompare(b.label)
    ),
  }));
}

/** Total items on the list, for the header count. */
export function countLines(groups: ShoppingGroup[]): number {
  return groups.reduce((n, g) => n + g.lines.length, 0);
}
