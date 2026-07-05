import type { Ingredient } from "./types";

/**
 * Units that never scale cleanly — "1.33 cans" is nonsense. Lines with these
 * units are shown verbatim with an "adjust to taste when scaling" hint.
 */
export const NON_SCALABLE_UNITS = new Set([
  "can",
  "cans",
  "stick",
  "sticks",
  "package",
  "packages",
  "pkg",
  "pkgs",
  "packet",
  "packets",
  "pinch",
  "pinches",
  "dash",
  "dashes",
  "jar",
  "jars",
  "box",
  "boxes",
  "envelope",
  "envelopes",
  "bottle",
  "bottles",
  "container",
  "containers",
  "carton",
  "cartons",
  "bag",
  "bags",
  "tube",
  "tubes",
  "loaf",
  "loaves",
  "bunch",
  "bunches",
]);

const TO_TASTE_RE =
  /\b(to taste|as needed|as desired|for garnish|for serving|for dusting|optional)\b/i;

function normalizeUnit(unit: string | null): string {
  return (unit ?? "").toLowerCase().replace(/\./g, "").trim();
}

/** Can this ingredient's quantity be multiplied without producing nonsense? */
export function isScalable(ing: Ingredient): boolean {
  if (!ing.scalable || ing.quantity == null || !isFinite(ing.quantity)) {
    return false;
  }
  if (NON_SCALABLE_UNITS.has(normalizeUnit(ing.unit))) return false;
  if (TO_TASTE_RE.test(ing.note || "") || TO_TASTE_RE.test(ing.raw)) {
    return false;
  }
  return true;
}

const FRACTION_GLYPHS: Record<string, string> = {
  "1/8": "⅛",
  "1/4": "¼",
  "1/3": "⅓",
  "3/8": "⅜",
  "1/2": "½",
  "5/8": "⅝",
  "2/3": "⅔",
  "3/4": "¾",
  "7/8": "⅞",
};

interface FormattedQuantity {
  text: string;
  /** True when the displayed value was rounded away from the exact number. */
  approx: boolean;
}

/**
 * Format a number the way a cookbook would: whole numbers stay whole, and
 * fractional parts snap to the nearest common fraction (halves, thirds,
 * quarters, eighths). 0.75 -> "¾", 1.333 -> "1⅓", 2.5 -> "2½".
 */
export function formatQuantity(value: number): FormattedQuantity {
  if (!isFinite(value) || value <= 0) {
    return { text: String(value), approx: false };
  }

  let whole = Math.floor(value);
  const frac = value - whole;

  // Candidate fractions with denominators 2, 3, 4, 8 — pick the closest.
  let bestNum = 0;
  let bestDen = 1;
  let bestErr = frac; // distance to 0
  for (const den of [2, 3, 4, 8]) {
    const num = Math.round(frac * den);
    const err = Math.abs(frac - num / den);
    if (err < bestErr - 1e-9) {
      bestErr = err;
      bestNum = num;
      bestDen = den;
    }
  }
  // Reduce (e.g. 2/8 -> 1/4, 4/8 -> 1/2, 2/4 -> 1/2)
  if (bestNum > 0) {
    const g = gcd(bestNum, bestDen);
    bestNum /= g;
    bestDen /= g;
  }
  if (bestNum === bestDen) {
    whole += 1;
    bestNum = 0;
  }

  // A tiny-but-nonzero amount should never display as "0" — floor at ⅛.
  if (whole === 0 && bestNum === 0) {
    bestNum = 1;
    bestDen = 8;
  }

  const shown = whole + bestNum / bestDen;
  const approx = Math.abs(shown - value) > 0.02 * Math.max(1, value);

  let text: string;
  if (bestNum === 0) {
    text = String(whole);
  } else {
    const key = `${bestNum}/${bestDen}`;
    const glyph = FRACTION_GLYPHS[key] ?? key;
    text = whole > 0 ? `${whole}${glyph}` : glyph;
  }
  return { text, approx };
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Round to the nearest half — for countable items like eggs or cloves. */
function roundToHalf(value: number): number {
  return Math.max(0.5, Math.round(value * 2) / 2);
}

/** Countable = a bare number with no unit ("2 eggs", "3 cloves garlic"). */
function isCountable(ing: Ingredient): boolean {
  return normalizeUnit(ing.unit) === "";
}

export interface ScaledLine {
  ingredient: Ingredient;
  /** Whether the quantity was multiplied. */
  scaled: boolean;
  /** Formatted quantity text (with range if present), or null. */
  quantityText: string | null;
  /** Scaled numeric value(s), for unit conversion downstream. */
  scaledLow: number | null;
  scaledHigh: number | null;
  /** True when rounding moved the displayed value ("approx" in the UI). */
  approx: boolean;
  /** Show "adjust to taste when scaling" for fixed lines when factor != 1. */
  showHint: boolean;
}

/**
 * Scale one ingredient line by `factor` (target servings / base servings).
 * Non-scalable lines come back untouched with a hint flag instead.
 */
export function scaleIngredient(ing: Ingredient, factor: number): ScaledLine {
  const scalable = isScalable(ing);

  if (!scalable) {
    return {
      ingredient: ing,
      scaled: false,
      quantityText: null,
      scaledLow: null,
      scaledHigh: null,
      approx: false,
      showHint: Math.abs(factor - 1) > 1e-9,
    };
  }

  const countable = isCountable(ing);
  let approx = false;

  const scaleOne = (q: number): { num: number; formatted: FormattedQuantity } => {
    let scaled = q * factor;
    if (countable) {
      const rounded = roundToHalf(scaled);
      if (Math.abs(rounded - scaled) > 0.01) approx = true;
      scaled = rounded;
    }
    const formatted = formatQuantity(scaled);
    if (formatted.approx) approx = true;
    return { num: scaled, formatted };
  };

  const low = scaleOne(ing.quantity as number);
  let text = low.formatted.text;
  let scaledHigh: number | null = null;
  if (ing.quantity_max != null && isFinite(ing.quantity_max)) {
    const high = scaleOne(ing.quantity_max);
    text = `${low.formatted.text}–${high.formatted.text}`;
    scaledHigh = high.num;
  }

  return {
    ingredient: ing,
    scaled: Math.abs(factor - 1) > 1e-9,
    quantityText: text,
    scaledLow: low.num,
    scaledHigh,
    approx,
    showHint: false,
  };
}

export function scaleFactor(target: number, base: number): number {
  if (!base || base <= 0) return 1;
  return target / base;
}
