import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChefHat, Pencil, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ServingsControl } from "@/components/ServingsControl";
import { IngredientList } from "@/components/IngredientList";
import { UnitToggle } from "@/components/UnitToggle";
import { CookMode } from "@/components/CookMode";
import { useRecipes } from "@/hooks/useRecipes";
import { useAuth } from "@/hooks/useAuth";
import { useUnitSystem } from "@/hooks/useUnitSystem";
import { photoUrl } from "@/lib/supabase";
import { scaleFactor } from "@/lib/scaling";
import { convertTemperatures } from "@/lib/units";
import { formatCostPerServing } from "@/lib/cost";

export default function RecipePage() {
  const { slug } = useParams();
  const { recipes, loading } = useRecipes();
  const { isFamily } = useAuth();

  const recipe = useMemo(
    () => recipes?.find((r) => r.slug === slug) ?? null,
    [recipes, slug]
  );

  // Chosen servings live only in component state — never written to the DB.
  const [servings, setServings] = useState<number | null>(null);
  const [cooking, setCooking] = useState(false);
  const [units, setUnits] = useUnitSystem();

  if (loading) {
    return <p className="mt-10 text-center text-ink-soft">Loading…</p>;
  }
  if (!recipe) {
    return (
      <p className="mt-10 text-center text-ink-soft">
        Recipe not found. <Link to="/" className="text-accent underline">Back to all recipes</Link>
      </p>
    );
  }

  const currentServings = servings ?? recipe.base_servings;
  const factor = scaleFactor(currentServings, recipe.base_servings);
  const photo = photoUrl(recipe.photo_path);

  if (cooking) {
    return (
      <CookMode
        recipe={recipe}
        factor={factor}
        servings={currentServings}
        units={units}
        onChangeUnits={setUnits}
        onExit={() => setCooking(false)}
      />
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-4">
      {photo && (
        <div className="mb-4 rounded-2xl border border-paper-line bg-paper-card p-1.5 shadow-plate">
          <img
            src={photo}
            alt={recipe.title}
            className="h-52 w-full rounded-[10px] object-cover sm:h-72"
          />
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-[34px] leading-tight tracking-[-0.01em]">
            {recipe.title}
          </h1>
          {recipe.credit && (
            <p className="mt-1 font-serif italic text-ink-soft">
              From {recipe.credit}
            </p>
          )}
        </div>
        {isFamily && (
          <Link
            to={`/edit/${recipe.slug}`}
            aria-label="Edit recipe"
            className={buttonVariants({ variant: "outline", size: "icon" })}
          >
            <Pencil className="h-4 w-4" />
          </Link>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge>{recipe.category}</Badge>
        {formatCostPerServing(recipe.cost_per_serving) && (
          <Badge
            variant="outline"
            className="border-paper-line bg-paper-card tabular-nums text-ink-soft"
            title="Rough estimate at US grocery prices"
          >
            {formatCostPerServing(recipe.cost_per_serving)} est.
          </Badge>
        )}
        {recipe.tags.map((t) => (
          <Badge key={t} variant="secondary">
            {t}
          </Badge>
        ))}
      </div>
      <div className="mt-4 h-px bg-gradient-to-r from-paper-line via-paper-line/50 to-transparent" />
      {recipe.source_url && (
        <a
          href={recipe.source_url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-sm text-accent underline"
        >
          Source <ExternalLink className="h-3 w-3" />
        </a>
      )}

      <div className="mt-4">
        <ServingsControl
          servings={currentServings}
          baseServings={recipe.base_servings}
          estimated={recipe.servings_estimated}
          onChange={setServings}
        />
      </div>

      <section className="mt-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex flex-1 items-center gap-3 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-dark/80 after:h-px after:flex-1 after:bg-paper-line">
            Ingredients
          </h2>
          <UnitToggle value={units} onChange={setUnits} />
        </div>
        <IngredientList
          ingredients={recipe.ingredients}
          factor={factor}
          units={units}
        />
      </section>

      <section className="mt-6">
        <h2 className="mb-4 flex items-center gap-3 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-dark/80 after:h-px after:flex-1 after:bg-paper-line">
          Steps
        </h2>
        <ol className="space-y-3">
          {recipe.steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/25 bg-accent-soft font-serif text-sm font-semibold text-accent-dark shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                {i + 1}
              </span>
              <p className="leading-relaxed">
                {units === "metric" ? convertTemperatures(step) : step}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {recipe.notes && (
        <section className="mt-8 rounded-xl border border-dashed border-paper-line bg-paper-warm/70 p-4">
          <h2 className="mb-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-dark/80">
            Notes
          </h2>
          <p className="whitespace-pre-wrap font-serif italic leading-relaxed text-ink-soft">
            {units === "metric" ? convertTemperatures(recipe.notes) : recipe.notes}
          </p>
        </section>
      )}

      {/* Sits above the phone tab bar; flush with the bottom on larger screens. */}
      <div className="fixed inset-x-0 bottom-16 z-10 border-t border-paper-line bg-paper/90 p-3 shadow-[0_-4px_16px_-8px_rgba(78,59,33,0.25)] backdrop-blur sm:bottom-0">
        <div className="mx-auto max-w-3xl">
          <Button size="lg" className="w-full" onClick={() => setCooking(true)}>
            <ChefHat className="h-5 w-5" />
            Cook mode
          </Button>
        </div>
      </div>
    </main>
  );
}
