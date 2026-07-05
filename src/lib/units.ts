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
  t: 15, // capital T convention is tablespoon, but lowercased here; rare
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

function normalizeUnit(unit: string): string {
  return unit.toLowerCase().replace(/\./g, "").trim();
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
  let out = text.replace(
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
