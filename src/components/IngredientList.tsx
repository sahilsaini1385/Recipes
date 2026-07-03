import { scaleIngredient } from "@/lib/scaling";
import type { Ingredient } from "@/lib/types";

interface Props {
  ingredients: Ingredient[];
  factor: number;
}

export function IngredientLine({
  ingredient,
  factor,
}: {
  ingredient: Ingredient;
  factor: number;
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

  return (
    <span>
      <span className="font-semibold">
        {line.quantityText}
        {ingredient.unit ? ` ${ingredient.unit}` : ""}
      </span>{" "}
      {ingredient.item}
      {line.approx && (
        <span className="text-xs italic text-ink-faint"> approx</span>
      )}
      {ingredient.note && (
        <span className="text-ink-faint">, {ingredient.note}</span>
      )}
    </span>
  );
}

export function IngredientList({ ingredients, factor }: Props) {
  return (
    <ul className="space-y-2">
      {ingredients.map((ing, i) => (
        <li key={i} className="flex gap-2 text-base leading-relaxed">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <IngredientLine ingredient={ing} factor={factor} />
        </li>
      ))}
    </ul>
  );
}
