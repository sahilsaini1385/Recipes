import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Heart, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { RecipeCard } from "@/components/RecipeCard";
import { useRecipes } from "@/hooks/useRecipes";
import { useFavorites } from "@/hooks/useFavorites";
import { useCostEstimates } from "@/hooks/useCostEstimates";
import { useRecipeAttribution } from "@/hooks/useRecipeAttribution";
import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { Recipe } from "@/lib/types";

// The filter row's pills — the Favorites toggle and the category chips — are
// the same control in two flavours, so they share their styling here.
// h-11 (44px) rather than something daintier: these sit in a horizontal
// scroller on a phone, where a short chip is easy to swipe past by accident.
const CHIP_BASE =
  "flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-all active:scale-95";
const CHIP_ON =
  "border-accent-dark/40 bg-accent text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(78,59,33,0.18)]";
const CHIP_OFF =
  "border-paper-line bg-paper-card text-ink-soft hover:border-accent/40 hover:text-ink";
const CHIP_COUNT = "rounded-full px-1.5 text-[11px] tabular-nums";
const CHIP_COUNT_ON = "bg-white/25 text-white";
const CHIP_COUNT_OFF = "bg-paper-warm text-ink-faint";

function matchesQuery(recipe: Recipe, q: string): boolean {
  const needle = q.toLowerCase();
  if (recipe.title.toLowerCase().includes(needle)) return true;
  return recipe.ingredients.some(
    (i) =>
      i.raw.toLowerCase().includes(needle) ||
      i.item.toLowerCase().includes(needle)
  );
}

export default function Home() {
  const { recipes, loading, error, reload } = useRecipes();
  const { favorites, toggle } = useFavorites();
  useCostEstimates(); // quietly backfills missing cost estimates
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // "Everything from Nancy" lives in the URL rather than in state, so the
  // link from a recipe page and the link from the family tree are the same
  // link, and it can be sent to somebody.
  const [params, setParams] = useSearchParams();
  const from = params.get("from");
  const { byPerson, ready: attributionReady } = useRecipeAttribution(recipes);
  const fromPerson = from ? byPerson.get(from) ?? null : null;
  const clearFrom = () => {
    const next = new URLSearchParams(params);
    next.delete("from");
    setParams(next, { replace: true });
  };

  // "Everything from Nancy" is a scope, not another chip: the chips count
  // and filter inside it, so tapping Desserts while looking at her recipes
  // says how many of *hers* are desserts rather than how many exist.
  const scoped = useMemo(() => {
    const all = recipes ?? [];
    if (!from) return all;
    const ids = new Set((fromPerson?.recipes ?? []).map((r) => r.id));
    return all.filter((r) => ids.has(r.id));
  }, [recipes, from, fromPerson]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of scoped) {
      map.set(r.category, (map.get(r.category) ?? 0) + 1);
    }
    return map;
  }, [scoped]);

  const favoriteCount = useMemo(
    () => scoped.filter((r) => favorites.has(r.id)).length,
    [scoped, favorites]
  );

  const filtered = useMemo(() => {
    let list = scoped;
    if (favoritesOnly) list = list.filter((r) => favorites.has(r.id));
    if (category) list = list.filter((r) => r.category === category);
    if (query.trim()) list = list.filter((r) => matchesQuery(r, query.trim()));
    return list;
  }, [scoped, category, favoritesOnly, query, favorites]);

  // What to say when nothing shows, phrased for the filter you actually used
  // — telling someone to "try another search" when they only tapped
  // Favorites is no help at all.
  const empty = useMemo(() => {
    if (from && !fromPerson) {
      return {
        headline: "Nothing here came from them.",
        hint: "Clear the filter to see every recipe",
      };
    }
    if (recipes && recipes.length === 0) {
      return {
        headline: "No recipes yet.",
        hint: "Sign in and add the first one",
      };
    }
    if (favoritesOnly && favoriteCount === 0) {
      return {
        headline: "No favorites yet.",
        hint: "Tap the heart on any recipe to keep it here",
      };
    }
    if (query.trim()) {
      return {
        headline: `Nothing matches “${query.trim()}”.`,
        hint: category ? "Try clearing the category too" : "Try another word",
      };
    }
    if (category) {
      return {
        headline: `Nothing in ${category} yet.`,
        hint: "Try another category",
      };
    }
    return { headline: "No recipes match.", hint: "Try clearing the filters" };
  }, [recipes, from, fromPerson, favoritesOnly, favoriteCount, query, category]);

  // The tree loads separately from the recipes, so a ?from= link that shows
  // its empty state before attribution has arrived would flash "nothing came
  // from them" at somebody who has recipes. Wait for both.
  const busy = loading || (from !== null && !attributionReady);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-5">
      {/* Shown for any ?from=, including one that matches nobody: the Clear
          button is the only way back out, and an empty state telling you to
          clear a filter with no control to clear it is a dead end. */}
      {from && !busy && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-accent/25 bg-accent-soft px-4 py-3">
          <p className="font-serif italic leading-snug text-accent-dark">
            {fromPerson
              ? `${fromPerson.recipes.length} ${
                  fromPerson.recipes.length === 1 ? "recipe" : "recipes"
                } from ${fromPerson.names.join(" & ")}`
              : "Showing one person's recipes"}
          </p>
          <button
            onClick={clearFrom}
            className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-accent/25 bg-paper-card px-3 text-[11px] font-medium uppercase tracking-[0.1em] text-accent-dark hover:border-accent/50"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <Input
          type="search"
          placeholder="Search recipes and ingredients…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 rounded-full border-paper-line bg-paper-card pl-10 shadow-[inset_0_1px_2px_rgba(78,59,33,0.05)] placeholder:font-serif placeholder:italic placeholder:text-ink-faint focus-visible:ring-accent/60"
        />
      </div>

      {/* One row: Favorites toggle + category chips with counts */}
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        <button
          onClick={() => setFavoritesOnly(!favoritesOnly)}
          className={cn(CHIP_BASE, favoritesOnly ? CHIP_ON : CHIP_OFF)}
        >
          <Heart
            className={cn(
              "h-4 w-4",
              favoritesOnly ? "fill-white text-white" : "text-accent"
            )}
          />
          Favorites
          {favoriteCount > 0 && (
            <span
              className={cn(
                CHIP_COUNT,
                favoritesOnly ? CHIP_COUNT_ON : CHIP_COUNT_OFF
              )}
            >
              {favoriteCount}
            </span>
          )}
        </button>
        <CategoryChip
          label="All"
          count={scoped.length}
          active={category === null}
          onClick={() => setCategory(null)}
        />
        {CATEGORIES.filter(
          // Unfiltered, an empty category still says something — nobody has
          // added a soup yet. Inside one person's recipes it says nothing,
          // and eleven chips reading 0 bury the one that has anything in it.
          (c) => !from || category === c || (counts.get(c) ?? 0) > 0
        ).map((c) => (
          <CategoryChip
            key={c}
            label={c}
            count={counts.get(c) ?? 0}
            active={category === c}
            onClick={() => setCategory(category === c ? null : c)}
          />
        ))}
      </div>

      {busy && (
        <p className="mt-10 text-center text-ink-soft">Loading recipes…</p>
      )}
      {error && (
        <div className="mt-10 text-center">
          <p className="text-red-700">Could not load recipes: {error}</p>
          <button className="mt-2 text-accent underline" onClick={reload}>
            Try again
          </button>
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-paper-line bg-paper-card/60 px-6 py-10 text-center">
          <p className="font-serif italic text-ink-soft">{empty.headline}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-ink-faint">
            {empty.hint}
          </p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filtered.map((r) => (
          <RecipeCard
            key={r.id}
            recipe={r}
            isFavorite={favorites.has(r.id)}
            onToggleFavorite={toggle}
          />
        ))}
      </div>
    </main>
  );
}

function CategoryChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(CHIP_BASE, active ? CHIP_ON : CHIP_OFF)}
    >
      {label}
      <span className={cn(CHIP_COUNT, active ? CHIP_COUNT_ON : CHIP_COUNT_OFF)}>
        {count}
      </span>
    </button>
  );
}
