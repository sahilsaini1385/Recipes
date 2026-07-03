import type { Ingredient } from "./types";

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  half: 0.5,
  a: 1,
  an: 1,
};

const UNITS = [
  "cups",
  "cup",
  "c",
  "tablespoons",
  "tablespoon",
  "tbsp",
  "tbs",
  "tb",
  "teaspoons",
  "teaspoon",
  "tsp",
  "ts",
  "pounds",
  "pound",
  "lbs",
  "lb",
  "ounces",
  "ounce",
  "oz",
  "grams",
  "gram",
  "g",
  "kilograms",
  "kilogram",
  "kg",
  "milliliters",
  "milliliter",
  "ml",
  "liters",
  "liter",
  "l",
  "quarts",
  "quart",
  "qt",
  "pints",
  "pint",
  "pt",
  "gallons",
  "gallon",
  "gal",
  "sticks",
  "stick",
  "cans",
  "can",
  "packages",
  "package",
  "pkg",
  "packets",
  "packet",
  "jars",
  "jar",
  "boxes",
  "box",
  "envelopes",
  "envelope",
  "bottles",
  "bottle",
  "containers",
  "container",
  "cartons",
  "carton",
  "bags",
  "bag",
  "bunches",
  "bunch",
  "heads",
  "head",
  "stalks",
  "stalk",
  "sprigs",
  "sprig",
  "cloves",
  "clove",
  "slices",
  "slice",
  "pieces",
  "piece",
  "pinches",
  "pinch",
  "dashes",
  "dash",
  "loaves",
  "loaf",
];

const NOTE_RE =
  /\b(to taste|as needed|as desired|divided|optional|for garnish|for serving|softened|melted|room temperature|plus more.*)$/i;

/** Parse "1 1/2", "1/2", "1.5", "½", "one" etc. Returns null when absent. */
function parseNumberToken(token: string): number | null {
  token = token.trim();
  if (!token) return null;
  if (token in UNICODE_FRACTIONS) return UNICODE_FRACTIONS[token];
  const word = NUMBER_WORDS[token.toLowerCase()];
  if (word !== undefined) return word;
  // mixed number "1 1/2" or "1½"
  const mixed = token.match(/^(\d+)[\s]+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const mixedGlyph = token.match(/^(\d+)([½⅓⅔¼¾⅛⅜⅝⅞])$/);
  if (mixedGlyph) {
    return Number(mixedGlyph[1]) + UNICODE_FRACTIONS[mixedGlyph[2]];
  }
  const frac = token.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const dec = token.match(/^\d*\.?\d+$/);
  if (dec) return Number(token);
  return null;
}

/**
 * Best-effort parse of a free-text ingredient line into the schema. The raw
 * line is always preserved verbatim; parsing failure just means quantity null.
 */
export function parseIngredientLine(raw: string): Ingredient {
  const line = raw.trim().replace(/\s+/g, " ");
  let rest = line;
  let quantity: number | null = null;
  let quantityMax: number | null = null;
  let unit: string | null = null;
  let note = "";

  // Leading quantity: mixed numbers, fractions, decimals, unicode, words,
  // and ranges joined by "-", "–", "to", or "or".
  const numToken =
    "(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d*\\.?\\d+|[½⅓⅔¼¾⅛⅜⅝⅞]|\\d+[½⅓⅔¼¾⅛⅜⅝⅞])";
  const wordToken =
    "(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|half|a|an)";
  const rangeRe = new RegExp(
    `^(${numToken}|${wordToken})(?:\\s*(?:-|–|—|to|or)\\s*(${numToken}))?\\s+`,
    "i"
  );
  const m = rest.match(rangeRe);
  if (m) {
    const low = parseNumberToken(m[1]);
    if (low != null) {
      quantity = low;
      if (m[2]) {
        const high = parseNumberToken(m[2]);
        if (high != null && high > low) quantityMax = high;
      }
      rest = rest.slice(m[0].length);
    }
  }

  // Unit (only meaningful when a quantity was found).
  if (quantity != null) {
    const unitRe = new RegExp(`^(${UNITS.join("|")})\\.?\\s+`, "i");
    const um = rest.match(unitRe);
    if (um) {
      unit = um[1].toLowerCase();
      rest = rest.slice(um[0].length);
    }
    // "of" as in "1 cup of flour"
    rest = rest.replace(/^of\s+/i, "");
  }

  // Trailing qualifier after the last comma ("salt, to taste"; "flour, divided")
  const commaIdx = rest.lastIndexOf(",");
  if (commaIdx > 0) {
    const tail = rest.slice(commaIdx + 1).trim();
    if (NOTE_RE.test(tail)) {
      note = tail;
      rest = rest.slice(0, commaIdx).trim();
    }
  } else if (NOTE_RE.test(rest) && quantity == null) {
    // whole-line qualifiers like "Salt and pepper to taste"
    const nm = rest.match(NOTE_RE);
    if (nm && nm.index !== undefined && nm.index > 0) {
      note = nm[0];
      rest = rest.slice(0, nm.index).trim();
    }
  }

  return {
    raw: line,
    quantity,
    quantity_max: quantityMax,
    unit,
    item: rest.trim() || line,
    note,
    scalable: quantity != null,
  };
}
