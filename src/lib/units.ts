export type UnitSystem = "us" | "metric";

/**
 * US → metric conversion for recipe display. "us" shows amounts as written;
 * "metric" converts recognizable US volume/weight units and Fahrenheit
 * temperatures. Values are rounded the way a metric cookbook would print
 * them (240 ml, 450 g, 175°C) — not lab-precise decimals.
 */

const VOLUME_ML: Record<string, number> = {
  cup: 240,
  cups: 240,
  c: 240,
  tablespoon: 15,
  tablespoons: 15,
  tbsp: 15,
  tbs: 15,
  tb: 15,
  teaspoon: 5,
  teaspoons: 5,
  tsp: 5,
  ts: 5,
  quart: 946,
  quarts: 946,
  qt: 946,
  pint: 473,
  pints: 473,
  pt: 473,
  gallon: 3785,
  gallons: 3785,
  gal: 3785,
};

const WEIGHT_G: Record<string, number> = {
  pound: 453.6,
  pounds: 453.6,
  lb: 453.6,
  lbs: 453.6,
  ounce: 28.35,
  ounces: 28.35,
  oz: 28.35,
};

/**
 * Fold a written unit to a lookup key.
 *
 * On a handwritten recipe card "T" is a tablespoon and "t" is a teaspoon, and
 * this collection uses both: 70 lines say T, 91 say t. Lowercasing them
 * together — which this did until it was measured — serves three times the
 * salt, and "0.25 t Tabasco" becomes four times the Tabasco. Only the bare
 * letter carries that meaning; "Tbsp" and "tsp" say which they are, so
 * everything else folds to lower case as before.
 */
export function normalizeUnit(unit: string): string {
  const bare = unit.replace(/\./g, "").trim();
  if (bare === "T") return "tablespoon";
  if (bare === "t") return "teaspoon";
  return bare.toLowerCase();
}

function roundCookbook(value: number): number {
  if (value < 10) return Math.max(1, Math.round(value));
  if (value < 250) return Math.round(value / 5) * 5;
  return Math.round(value / 10) * 10;
}

interface MetricAmount {
  value: number;
  unit: "ml" | "l" | "g" | "kg";
}

/** Convert one US amount to metric, or null when the unit isn't convertible. */
export function toMetric(quantity: number, unit: string): MetricAmount | null {
  const key = normalizeUnit(unit);
  if (key in VOLUME_ML) {
    const ml = quantity * VOLUME_ML[key];
    if (ml >= 1000) return { value: Math.round((ml / 1000) * 10) / 10, unit: "l" };
    return { value: roundCookbook(ml), unit: "ml" };
  }
  if (key in WEIGHT_G) {
    const g = quantity * WEIGHT_G[key];
    if (g >= 1000) return { value: Math.round((g / 1000) * 10) / 10, unit: "kg" };
    return { value: roundCookbook(g), unit: "g" };
  }
  return null;
}

/**
 * Roughly how big one of a unit is, for putting amounts in a sensible order
 * ("1 cup + 5 tablespoons", not the other way round). Volumes and weights are
 * ranked separately and never compared with each other — this is for display
 * order only, and converts nothing.
 */
export function unitMagnitude(unit: string): number | null {
  const key = normalizeUnit(unit);
  return VOLUME_ML[key] ?? WEIGHT_G[key] ?? null;
}

export function isConvertibleUnit(unit: string | null): boolean {
  if (!unit) return false;
  const key = normalizeUnit(unit);
  return key in VOLUME_ML || key in WEIGHT_G;
}

/**
 * Format a metric amount (or range) for display: "120 ml", "1.4 l",
 * "450 g", "225–340 g".
 */
export function formatMetric(
  low: number,
  high: number | null,
  unit: string
): string | null {
  const lowM = toMetric(low, unit);
  if (!lowM) return null;
  if (high != null) {
    const highM = toMetric(high, unit);
    if (highM && highM.unit === lowM.unit) {
      return `${lowM.value}–${highM.value} ${lowM.unit}`;
    }
    // Range straddles the 1000 boundary ("2–5 cups" → 0.5–1.2 l): express
    // both ends in the larger unit rather than dropping the top of the range.
    if (highM && highM.unit === "l" && lowM.unit === "ml") {
      return `${Math.round((lowM.value / 1000) * 10) / 10}–${highM.value} l`;
    }
    if (highM && highM.unit === "kg" && lowM.unit === "g") {
      return `${Math.round((lowM.value / 1000) * 10) / 10}–${highM.value} kg`;
    }
  }
  return `${lowM.value} ${lowM.unit}`;
}

function fToC(f: number): number {
  return Math.round(((f - 32) * 5) / 9 / 5) * 5;
}

/**
 * Convert Fahrenheit oven temperatures inside free text to Celsius:
 * "bake at 350°F" -> "bake at 175°C", "350 degrees" -> "175°C" (only in the
 * plausible oven range, to avoid mangling other numbers).
 */
export function convertTemperatures(text: string): string {
  // Ranges first ("350–375°F"), so the low end isn't left in Fahrenheit.
  let out = text.replace(
    /(\d{2,3})\s*(?:°\s*F?\s*)?(?:[-–—]|to)\s*(\d{2,3})\s*(?:°\s*F\b|degrees?\s+F(?:ahrenheit)?\b)/gi,
    (_, a, b) => `${fToC(Number(a))}–${fToC(Number(b))}°C`
  );
  out = out.replace(
    /(\d{2,3})\s*(?:°\s*F\b|degrees?\s+F(?:ahrenheit)?\b|F\b(?=\s*(?:oven|for|and|\.|,|\)|$)))/gi,
    (_, num) => `${fToC(Number(num))}°C`
  );
  // Bare "350 degrees" or "350°" — assume Fahrenheit within oven range.
  out = out.replace(/(\d{3})\s*(?:degrees\b|°)(?!\s*[CF])/gi, (match, num) => {
    const f = Number(num);
    if (f >= 200 && f <= 550) return `${fToC(f)}°C`;
    return match;
  });
  return out;
}
