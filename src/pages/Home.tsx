import { useMemo, useState } from "react";
import { Search, Heart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RecipeCard } from "@/components/RecipeCard";
import { useRecipes } from "@/hooks/useRecipes";
import { useFavorites } from "@/hooks/useFavorites";
import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { Recipe } from "@/lib/types";

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
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of recipes ?? []) {
      map.set(r.category, (map.get(r.category) ?? 0) + 1);
    }
    return map;
  }, [recipes]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const r of recipes ?? []) for (const t of r.tags) set.add(t);
    return [...set].sort();
  }, [recipes]);

  const filtered = useMemo(() => {
    let list = recipes ?? [];
    if (category) list = list.filter((r) => r.category === category);
    if (tag) list = list.filter((r) => r.tags.includes(tag));
    if (favoritesOnly) list = list.filter((r) => favorites.has(r.id));
    if (query.trim()) list = list.filter((r) => matchesQuery(r, query.trim()));
    return list;
  }, [recipes, category, tag, favoritesOnly, query, favorites]);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <Input
          type="search"
          placeholder="Search by title or ingredient"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Category chips with counts */}
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        <CategoryChip
          label="All"
          count={recipes?.length ?? 0}
          active={category === null}
          onClick={() => setCategory(null)}
        />
        {CATEGORIES.map((c) => (
          <CategoryChip
            key={c}
            label={c}
            count={counts.get(c) ?? 0}
            active={category === c}
            onClick={() => setCategory(category === c ? null : c)}
          />
        ))}
      </div>

      {/* Tag filter + favorites toggle */}
      <div className="-mx-4 mt-2 flex items-center gap-2 overflow-x-auto px-4 pb-1">
        <button
          onClick={() => setFavoritesOnly(!favoritesOnly)}
          className={cn(
            "flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-sm",
            favoritesOnly
              ? "border-accent bg-accent-soft text-accent-dark"
              : "border-paper-deep bg-white text-ink-soft"
          )}
        >
          <Heart
            className={cn(
              "h-3.5 w-3.5",
              favoritesOnly && "fill-accent text-accent"
            )}
          />
          Favorites
        </button>
        {allTags.map((t) => (
          <button
            key={t}
            onClick={() => setTag(tag === t ? null : t)}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3 text-sm",
              tag === t
                ? "border-accent bg-accent-soft text-accent-dark"
                : "border-paper-deep bg-white text-ink-soft"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {loading && (
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
        <p className="mt-10 text-center text-ink-soft">
          {recipes && recipes.length === 0
            ? "No recipes yet. Sign in and add the first one."
            : "No recipes match."}
        </p>
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
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium",
        active
          ? "border-accent bg-accent text-white"
          : "border-paper-deep bg-white text-ink"
      )}
    >
      {label}
      <Badge
        variant={active ? "default" : "secondary"}
        className={cn(active && "bg-white/20 text-white")}
      >
        {count}
      </Badge>
    </button>
  );
}
