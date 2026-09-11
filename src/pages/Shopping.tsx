import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Check, X, Plus, ShoppingCart, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRecipes } from "@/hooks/useRecipes";
import { buildShoppingList, countLines } from "@/lib/shopping";
import { cn } from "@/lib/utils";
import type { Recipe } from "@/lib/types";

// Ticked items survive a reload — the list is used walking round a shop, and
// a phone that locks in a pocket must not lose what is already in the basket.
// Per-viewer and per-device on purpose: two people shopping from the same
// list are not ticking the same trolley.
const TICKED_KEY = "shopping-ticked";

function loadTicked(): Set<string> {
  try {
    const raw = localStorage.getItem(TICKED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export default function Shopping() {
  const { recipes, loading } = useRecipes();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [ticked, setTicked] = useState<Set<string>>(loadTicked);
  // Once there is a list, the picker folds away: on a phone it filled the
  // screen and left room for three items of the thing you came for.
  const [picking, setPicking] = useState(false);

  // The chosen recipes live in the URL, so a list can be sent to whoever is
  // going to the shop.
  const chosenSlugs = useMemo(() => {
    const raw = params.get("r");
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [params]);

  const setChosen = (slugs: string[]) => {
    const next = new URLSearchParams(params);
    if (slugs.length) next.set("r", slugs.join(","));
    else next.delete("r");
    setParams(next, { replace: true });
  };

  const toggleRecipe = (slug: string) =>
    setChosen(
      chosenSlugs.includes(slug)
        ? chosenSlugs.filter((s) => s !== slug)
        : [...chosenSlugs, slug]
    );

  useEffect(() => {
    try {
      localStorage.setItem(TICKED_KEY, JSON.stringify([...ticked]));
    } catch {
      // A phone with storage disabled still gets a working list, it just
      // forgets the ticks. Not worth telling anyone about.
    }
  }, [ticked]);

  const toggleTick = (key: string) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const chosen = useMemo(() => {
    const bySlug = new Map((recipes ?? []).map((r) => [r.slug, r]));
    // Keep the order they were picked in, and drop a slug whose recipe has
    // since been removed rather than rendering a gap.
    return chosenSlugs
      .map((s) => bySlug.get(s))
      .filter((r): r is Recipe => Boolean(r));
  }, [recipes, chosenSlugs]);

  const groups = useMemo(() => buildShoppingList(chosen), [chosen]);
  const total = countLines(groups);
  const tickedHere = groups
    .flatMap((g) => g.lines)
    .filter((l) => ticked.has(l.key)).length;

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = recipes ?? [];
    if (!q) return all.slice(0, 40);
    return all.filter((r) => r.title.toLowerCase().includes(q)).slice(0, 40);
  }, [recipes, query]);

  if (loading) {
    return <p className="mt-10 text-center text-ink-soft">Loading recipes…</p>;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-serif text-2xl">Shopping list</h1>
        {total > 0 && (
          <p className="text-sm tabular-nums text-ink-soft">
            {tickedHere} of {total}
          </p>
        )}
      </div>

      {/* ---- What is on the list ---- */}
      {chosen.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chosen.map((r) => (
            <span
              key={r.slug}
              className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent-soft py-1 pl-3 pr-1 text-sm text-accent-dark"
            >
              <Link to={`/recipe/${r.slug}`} className="hover:underline">
                {r.title}
              </Link>
              <button
                aria-label={`Remove ${r.title}`}
                onClick={() => toggleRecipe(r.slug)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-accent-dark/70 hover:bg-white/60 hover:text-accent-dark"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          <button
            onClick={() => setChosen([])}
            className="rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-[0.1em] text-ink-faint hover:text-ink"
          >
            Start over
          </button>
        </div>
      )}

      {/* ---- Picking recipes ---- */}
      {chosen.length > 0 && !picking && (
        <button
          onClick={() => setPicking(true)}
          className="mt-4 flex h-11 w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-paper-deep text-sm font-medium text-ink-soft hover:border-accent/50 hover:text-accent-dark"
        >
          <Plus className="h-4 w-4" />
          Add another recipe
        </button>
      )}

      <div hidden={chosen.length > 0 && !picking}>
      <div className="relative mt-4">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <Input
          type="search"
          placeholder="Find a recipe to add…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 rounded-full border-paper-line bg-paper-card pl-10 placeholder:font-serif placeholder:italic placeholder:text-ink-faint focus-visible:ring-accent/60"
        />
      </div>

      <div className="mt-2 max-h-60 overflow-y-auto rounded-xl border border-paper-line bg-paper-card/60">
        {searchResults.length === 0 ? (
          <p className="px-4 py-6 text-center font-serif italic text-ink-soft">
            Nothing matches “{query.trim()}”.
          </p>
        ) : (
          <ul>
            {searchResults.map((r) => {
              const on = chosenSlugs.includes(r.slug);
              return (
                <li key={r.slug}>
                  <button
                    onClick={() => toggleRecipe(r.slug)}
                    aria-pressed={on}
                    className="flex w-full items-center gap-3 border-b border-paper-line/60 px-3 py-2.5 text-left last:border-0 hover:bg-paper-warm/60"
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                        on
                          ? "border-accent bg-accent text-white"
                          : "border-paper-deep bg-paper"
                      )}
                    >
                      {on && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className="flex-1 text-sm">{r.title}</span>
                    <span className="text-[11px] uppercase tracking-wider text-ink-faint">
                      {r.category}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {chosen.length > 0 && (
        <button
          onClick={() => {
            setPicking(false);
            setQuery("");
          }}
          className="mt-2 text-sm font-medium text-accent-dark hover:underline"
        >
          Done adding
        </button>
      )}
      </div>

      {/* ---- The list ---- */}
      {chosen.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-paper-line bg-paper-card/60 px-6 py-12 text-center">
          <ShoppingCart className="mx-auto h-8 w-8 text-accent/40" />
          <p className="mt-3 font-serif italic text-ink-soft">
            Tick a few recipes and they become one list.
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-ink-faint">
            Grouped by aisle, amounts added up
          </p>
        </div>
      ) : (
        <div className="mt-6">
          {groups.map((group) => (
            <section key={group.aisle} className="mb-5">
              <h2 className="mb-2 flex items-center gap-3 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-dark/80 after:h-px after:flex-1 after:bg-paper-line">
                {group.aisle}
              </h2>
              <ul className="space-y-0.5">
                {group.lines.map((line) => {
                  const done = ticked.has(line.key);
                  return (
                    <li key={line.key}>
                      <button
                        onClick={() => toggleTick(line.key)}
                        aria-pressed={done}
                        // h-11 minimum: this is tapped one-handed pushing a
                        // trolley.
                        className="flex min-h-11 w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-paper-warm/60"
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                            done
                              ? "border-accent bg-accent text-white"
                              : "border-paper-deep bg-paper"
                          )}
                        >
                          {done && <Check className="h-3.5 w-3.5" />}
                        </span>
                        <span className="flex-1">
                          <span
                            className={cn(
                              "block",
                              done && "text-ink-faint line-through"
                            )}
                          >
                            {line.amounts.length > 0 && (
                              <span className="font-medium tabular-nums">
                                {line.amounts.join(" + ")}{" "}
                              </span>
                            )}
                            {line.label}
                          </span>
                          {/* Only when more than one recipe wants it — that
                              is the case where a total looks surprising. */}
                          {line.from.length > 1 && !done && (
                            <span className="mt-0.5 block text-xs text-ink-faint">
                              {line.from.join(" · ")}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {tickedHere > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTicked(new Set())}
            >
              <RotateCcw className="h-4 w-4" />
              Untick everything
            </Button>
          )}
        </div>
      )}
    </main>
  );
}
