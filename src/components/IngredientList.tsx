import { scaleIngredient } from "@/lib/scaling";
import { formatMetric, isConvertibleUnit, type UnitSystem } from "@/lib/units";
import type { Ingredient } from "@/lib/types";

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
  let amountText = `${line.quantityText}${ingredient.unit ? ` ${ingredient.unit}` : ""}`;
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
