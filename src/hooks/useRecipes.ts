import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Recipe } from "@/lib/types";

// Simple module-level cache so navigation between pages is instant. A family
// collection is small enough to fetch whole; search/filter run client-side.
let cache: Recipe[] | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

let inFlight: Promise<Recipe[]> | null = null;

/** Fetch the collection, coalescing concurrent callers into one request. */
export function refreshRecipes(): Promise<Recipe[]> {
  if (!isSupabaseConfigured) return Promise.resolve([]);
  inFlight ??= (async () => {
    try {
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .order("title");
      if (error) throw error;
      cache = (data ?? []) as Recipe[];
      notify();
      return cache;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function invalidateRecipes() {
  cache = null;
  notify();
}

export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[] | null>(cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const fetchOnce = () => {
      refreshRecipes().catch((e) => {
        if (alive) setError((e as Error).message);
      });
    };
    // When the cache is emptied (after a save, say) every mounted consumer
    // hears about it. Refetch instead of sitting on a null cache forever,
    // and never call setState after unmount.
    const update = () => {
      if (!alive) return;
      setRecipes(cache);
      if (!cache) fetchOnce();
    };
    listeners.add(update);
    if (!cache) fetchOnce();
    return () => {
      alive = false;
      listeners.delete(update);
    };
  }, []);

  const reload = useCallback(async () => {
    setError(null);
    try {
      await refreshRecipes();
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  return { recipes, loading: recipes === null && !error, error, reload };
}
