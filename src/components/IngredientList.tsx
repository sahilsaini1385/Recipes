import { scaleIngredient } from "@/lib/scaling";
import { formatMetric, isConvertibleUnit, type UnitSystem } from "@/lib/units";
import type { Ingredient } from "@/lib/types";

// Match a spelled-out unit's number: "2 cups" halved shows "1 cup", "1 cup"
// doubled shows "2 cups". Abbreviations (tbsp, oz) never inflect.
const UNIT_PLURALS: Record<string, string> = {
  cup: "cups",
  tablespoon: "tablespoons",
  teaspoon: "teaspoons",
  quart: "quarts",
  pint: "pints",
  gallon: "gallons",
  pound: "pounds",
  ounce: "ounces",
  stick: "sticks",
  clove: "cloves",
  slice: "slices",
  can: "cans",
  package: "packages",
  bunch: "bunches",
};
const UNIT_SINGULARS = Object.fromEntries(
  Object.entries(UNIT_PLURALS).map(([s, p]) => [p, s])
);

function inflectUnit(unit: string, amount: number): string {
  const key = unit.toLowerCase();
  const singular = UNIT_PLURALS[key] ? key : UNIT_SINGULARS[key];
  if (!singular) return unit;
  return amount > 1 ? UNIT_PLURALS[singular] : singular;
}

interface Props {
  ingredients: Ingredient[];
  factor: number;
  units?: UnitSystem;
}

export function IngredientLine({
  ingredient,
  factor,
  units = "us",
}: {
  ingredient: Ingredient;
  factor: number;
  units?: UnitSystem;
}) {
  const line = scaleIngredient(ingredient, factor);

  if (line.quantityText === null) {
    // Fixed line: show the original wording unchanged, qualifier muted.
    const raw = ingredient.raw;
    const note = ingredient.note;
    const body =
      note && raw.toLowerCase().endsWith(note.toLowerCase())
        ? raw.slice(0, raw.length - note.length).replace(/[,\s]+$/, "")
        : raw;
    return (
      <span>
        {body}
        {note && <span className="text-ink-faint"> {note}</span>}
        {line.showHint && (
          <span className="ml-1 text-xs italic text-ink-faint">
            — adjust to taste when scaling
          </span>
        )}
      </span>
    );
  }

  // Metric display: convert the scaled amount when the unit is convertible.
  const scaledAmount = line.scaledHigh ?? line.scaledLow ?? 0;
  const unitText = ingredient.unit
    ? ` ${inflectUnit(ingredient.unit, scaledAmount)}`
    : "";
  let amountText = `${line.quantityText}${unitText}`;
  if (
    units === "metric" &&
    ingredient.unit &&
    isConvertibleUnit(ingredient.unit) &&
    line.scaledLow != null
  ) {
    const metric = formatMetric(line.scaledLow, line.scaledHigh, ingredient.unit);
    if (metric) amountText = metric;
  }

  return (
    <span>
      <span className="font-semibold">{amountText}</span> {ingredient.item}
      {line.approx && (
        <span className="text-xs italic text-ink-faint"> approx</span>
      )}
      {ingredient.note && (
        <span className="text-ink-faint">, {ingredient.note}</span>
      )}
    </span>
  );
}

export function IngredientList({ ingredients, factor, units = "us" }: Props) {
  return (
    <ul className="space-y-2">
      {ingredients.map((ing, i) => (
        <li key={i} className="flex gap-2 text-base leading-relaxed">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <IngredientLine ingredient={ing} factor={factor} units={units} />
        </li>
      ))}
    </ul>
  );
}
