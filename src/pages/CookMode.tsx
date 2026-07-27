import { useState } from "react";
import { X } from "lucide-react";
import { IngredientLine } from "@/components/IngredientList";
import { UnitToggle } from "@/components/UnitToggle";
import { useWakeLock } from "@/hooks/useWakeLock";
import { convertTemperatures, type UnitSystem } from "@/lib/units";
import { cn } from "@/lib/utils";
import type { Recipe } from "@/lib/types";

interface Props {
  recipe: Recipe;
  factor: number;
  servings: number;
  units: UnitSystem;
  onChangeUnits: (u: UnitSystem) => void;
  onExit: () => void;
}

/**
 * Full-screen cooking view: large text, checkable ingredients and steps, and
 * a screen wake lock so the phone does not sleep mid-recipe.
 */
export function CookMode({
  recipe,
  factor,
  servings,
  units,
  onChangeUnits,
  onExit,
}: Props) {
  useWakeLock(true);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(
    new Set()
  );
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());

  const toggleIn =
    (set: Set<number>, update: (s: Set<number>) => void) => (i: number) => {
      const next = new Set(set);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      update(next);
    };
  const toggleIngredient = toggleIn(checkedIngredients, setCheckedIngredients);
  const toggleStep = toggleIn(checkedSteps, setCheckedSteps);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-paper">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-paper-deep bg-paper px-4 py-3">
        <div>
          <h1 className="font-serif text-xl font-semibold leading-tight">
            {recipe.title}
          </h1>
          <p className="text-sm text-ink-soft">
            {servings} {servings === 1 ? "serving" : "servings"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UnitToggle value={units} onChange={onChangeUnits} />
          <button
            onClick={onExit}
            aria-label="Exit cook mode"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-paper-warm"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
        <h2 className="mb-3 text-2xl">Ingredients</h2>
        <ul className="space-y-1">
          {recipe.ingredients.map((ing, i) => (
            <li key={i}>
              <button
                onClick={() => toggleIngredient(i)}
                className="flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left text-xl leading-relaxed hover:bg-paper-warm"
              >
                <span
                  className={cn(
                    "mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border-2",
                    checkedIngredients.has(i)
                      ? "border-accent bg-accent text-white"
                      : "border-ink-faint/50"
                  )}
                >
                  {checkedIngredients.has(i) && "✓"}
                </span>
                <span
                  className={cn(
                    checkedIngredients.has(i) && "text-ink-faint line-through"
                  )}
                >
                  <IngredientLine
                    ingredient={ing}
                    factor={factor}
                    units={units}
                  />
                </span>
              </button>
            </li>
          ))}
        </ul>

        <h2 className="mb-3 mt-8 text-2xl">Steps</h2>
        <ol className="space-y-2">
          {recipe.steps.map((step, i) => (
            <li key={i}>
              <button
                onClick={() => toggleStep(i)}
                className="flex w-full items-start gap-3 rounded-lg px-2 py-3 text-left text-xl leading-relaxed hover:bg-paper-warm"
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-serif text-base font-semibold",
                    checkedSteps.has(i)
                      ? "bg-accent text-white"
                      : "bg-accent-soft text-accent-dark"
                  )}
                >
                  {i + 1}
                </span>
                <span
                  className={cn(
                    checkedSteps.has(i) && "text-ink-faint line-through"
                  )}
                >
                  {units === "metric" ? convertTemperatures(step) : step}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
