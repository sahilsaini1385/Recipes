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

export async function refreshRecipes(): Promise<Recipe[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .order("title");
  if (error) throw error;
  cache = (data ?? []) as Recipe[];
  notify();
  return cache;
}

export function invalidateRecipes() {
  cache = null;
  notify();
}

export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[] | null>(cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setRecipes(cache);
    listeners.add(update);
    if (!cache) {
      refreshRecipes().catch((e) => setError(e.message));
    }
    return () => {
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
