import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { BookOpen, ChefHat, Pencil, Printer, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { CookLog } from "@/components/CookLog";
import { LoadError } from "@/components/LoadError";
import { ServingsControl } from "@/components/ServingsControl";
import { IngredientList } from "@/components/IngredientList";
import { UnitToggle } from "@/components/UnitToggle";
import { CookMode } from "@/components/CookMode";
import { useRecipes } from "@/hooks/useRecipes";
import { useAuth } from "@/hooks/useAuth";
import { useUnitSystem } from "@/hooks/useUnitSystem";
import { useRecipeAttribution } from "@/hooks/useRecipeAttribution";
import { photoUrl } from "@/lib/supabase";
import { scaleFactor } from "@/lib/scaling";
import { convertTemperatures } from "@/lib/units";
import { formatCostPerServing } from "@/lib/cost";
import { firstName } from "@/lib/names";
import { cn } from "@/lib/utils";

export default function RecipePage() {
  const { slug } = useParams();
  const { recipes, loading, error, reload } = useRecipes();
  const { matchesFor } = useRecipeAttribution(recipes);
  const { isFamily } = useAuth();

  const recipe = useMemo(
    () => recipes?.find((r) => r.slug === slug) ?? null,
    [recipes, slug]
  );

  // Chosen servings live only in component state — never written to the DB.
  const [servings, setServings] = useState<number | null>(null);
  const [units, setUnits] = useUnitSystem();

  // Cook mode lives in the URL (?cook=1) rather than in component state, so
  // the phone's Back button leaves cook mode instead of leaving the recipe
  // altogether — and so the cooking view can be refreshed or shared.
  const [params, setParams] = useSearchParams();
  const cooking = params.get("cook") === "1";
  const setCooking = (on: boolean) => {
    const next = new URLSearchParams(params);
    if (on) next.set("cook", "1");
    else next.delete("cook");
    // Entering pushes a history entry to go Back to; leaving replaces it so
    // Back doesn't drop you straight back into cook mode.
    setParams(next, { replace: !on });
  };

  if (loading) {
    return <p className="mt-10 text-center text-ink-soft">Loading…</p>;
  }
  // A failed read must never be reported as a missing recipe: the collection
  // is the point of the site, and "not found" reads as "gone".
  if (error) {
    return <LoadError what="this recipe" error={error} onRetry={reload} />;
  }
  if (!recipe) {
    return (
      <p className="mt-10 text-center text-ink-soft">
        Recipe not found. <Link to="/" className="text-accent-dark underline">Back to all recipes</Link>
      </p>
    );
  }

  const currentServings = servings ?? recipe.base_servings;
  const factor = scaleFactor(currentServings, recipe.base_servings);
  const photo = photoUrl(recipe.photo_path);
  const creditedTo = matchesFor(recipe.credit ?? null);
  // Six recipes in the collection came out of the importer as shells — one
  // says so in its own notes, "Recipe content could not be extracted". The
  // page used to dress them up as real recipes: a servings control scaling
  // nothing, a metric toggle converting nothing, empty Ingredients and Steps
  // headings, and a Cook mode button leading to a blank screen.
  const hasIngredients = recipe.ingredients.length > 0;
  const hasSteps = recipe.steps.length > 0;
  const isShell = !hasIngredients && !hasSteps;

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
    // pb-40, not pb-24: the Cook mode bar is fixed 64px up from the bottom and
    // is itself ~72px tall, so 96px of padding left the last thing on the page
    // sitting underneath it. The cooking log made that visible.
    <main className="mx-auto max-w-3xl px-4 pb-40 pt-4">
      {photo && (
        <div className="mb-4 rounded-2xl border border-paper-line bg-paper-card p-1.5 shadow-plate print:hidden">
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
          {/* When the credit names somebody on the family tree, offer the
              rest of what they cooked. Most credits are cookbooks and
              websites, so this is quiet and often absent. */}
          {creditedTo.length > 0 && (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 print:hidden">
              {creditedTo.map((m) => (
                <Link
                  key={m.personId}
                  to={`/?from=${m.personId}`}
                  className="inline-flex items-center gap-1 rounded-full border border-paper-line bg-paper-card px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-accent-dark hover:border-accent/40"
                >
                  <BookOpen className="h-3 w-3" />
                  More from {firstName(m.name)}
                </Link>
              ))}
            </p>
          )}
        </div>
        {isFamily && (
          <Link
            to={`/edit/${recipe.slug}`}
            aria-label="Edit recipe"
            className={cn(buttonVariants({ variant: "outline", size: "icon" }), "print:hidden")}
          >
            <Pencil className="h-4 w-4" />
          </Link>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 print:hidden">
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
      <div className="mt-4 h-px bg-gradient-to-r from-paper-line via-paper-line/50 to-transparent print:hidden" />
      {recipe.source_url && (
        <a
          href={recipe.source_url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-sm text-accent-dark underline"
        >
          Source <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {/* On paper the servings are a fact, not a control — but they have to
          be stated, because the amounts below are scaled to them. */}
      <p className={cn("hidden print:mt-1", hasIngredients && "print:block")}>
        Serves {currentServings}
        {units === "metric" && " · metric"}
      </p>

      {hasIngredients && (
      <div className="mt-4 print:hidden">
        <ServingsControl
          servings={currentServings}
          baseServings={recipe.base_servings}
          estimated={recipe.servings_estimated}
          onChange={setServings}
        />
      </div>
      )}

      {hasIngredients && (
      <section className="mt-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex flex-1 items-center gap-3 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-dark after:h-px after:flex-1 after:bg-paper-line">
            Ingredients
          </h2>
          <div className="print:hidden">
            <UnitToggle value={units} onChange={setUnits} />
          </div>
        </div>
        <IngredientList
          ingredients={recipe.ingredients}
          factor={factor}
          units={units}
        />
      </section>
      )}

      {hasSteps && (
      <section className="mt-6">
        <h2 className="mb-4 flex items-center gap-3 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-dark after:h-px after:flex-1 after:bg-paper-line">
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
      )}

      {/* Say plainly that this one is not filled in, rather than leaving a
          page of empty headings and letting somebody conclude the site is
          broken. The recipe is not lost — it never arrived. */}
      {isShell && (
        <section className="mt-6 rounded-2xl border border-dashed border-paper-line bg-paper-card/60 px-6 py-10 text-center">
          <p className="font-serif italic text-ink-soft">
            This one hasn't been written down yet.
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-ink-faint">
            The title came across, the recipe didn't
          </p>
          {isFamily && (
            <Link
              to={`/edit/${recipe.slug}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}
            >
              <Pencil className="h-4 w-4" />
              Add the recipe
            </Link>
          )}
        </section>
      )}

      {recipe.notes && (
        <section className="mt-8 rounded-xl border border-dashed border-paper-line bg-paper-warm/70 p-4">
          <h2 className="mb-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-dark">
            Notes
          </h2>
          <p className="whitespace-pre-wrap font-serif italic leading-relaxed text-ink-soft">
            {units === "metric" ? convertTemperatures(recipe.notes) : recipe.notes}
          </p>
        </section>
      )}

      {/* The cooking history belongs to the archive, not to the counter. */}
      <div className="print:hidden">
        <CookLog recipeId={recipe.id} />
      </div>

      {/* Print only: where this came from, so a sheet found in a drawer in
          ten years can be traced back to the recipe it was printed from. */}
      <p className="mt-8 hidden border-t border-black/20 pt-2 text-xs print:block">
        Jungman family recipes · {window.location.host}/recipe/{recipe.slug}
      </p>

      {!isShell && (
        <button
          onClick={() => window.print()}
          className="mt-8 inline-flex items-center gap-1.5 text-sm text-accent-dark underline print:hidden"
        >
          <Printer className="h-3.5 w-3.5" />
          Print this recipe
        </button>
      )}

      {/* Sits above the phone tab bar; flush with the bottom on larger screens. */}
      {/* Opaque, not frosted: at large serving counts the step text scrolls
          under this bar, and a translucent one let it read through. */}
      {!isShell && (
        <div className="fixed inset-x-0 bottom-16 z-10 border-t border-paper-line bg-paper p-3 shadow-[0_-4px_16px_-8px_rgba(78,59,33,0.25)] sm:bottom-0">
          <div className="mx-auto max-w-3xl">
            <Button size="lg" className="w-full" onClick={() => setCooking(true)}>
              <ChefHat className="h-5 w-5" />
              Cook mode
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
