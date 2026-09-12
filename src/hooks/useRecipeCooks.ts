import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { RecipeCook } from "@/lib/cooks";

export interface CookDraft {
  cooked_on: string;
  cooked_by: string | null;
  note: string | null;
}

const COLUMNS = "id, recipe_id, cooked_on, cooked_by, note";

/**
 * The cooking log for one recipe.
 *
 * Loaded per-recipe rather than whole, unlike places: this table is the one
 * in the archive designed to grow without limit, and a phone opening a recipe
 * has no use for the other 177 recipes' histories.
 */
async function fetchCooks(recipeId: string): Promise<RecipeCook[]> {
  const { data, error } = await supabase
    .from("recipe_cooks")
    .select(COLUMNS)
    // Soft-deleted rows are hidden from the public link by policy, but family
    // can read them, so filter here too or a removed entry would come back
    // for whoever is signed in.
    .is("deleted_at", null)
    .eq("recipe_id", recipeId)
    .order("cooked_on", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as RecipeCook[];
}

export function useRecipeCooks(recipeId: string | null) {
  const [cooks, setCooks] = useState<RecipeCook[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!recipeId) return;
    setError(null);
    try {
      setCooks(await fetchCooks(recipeId));
    } catch (e) {
      setError((e as Error).message);
    }
    setLoading(false);
  }, [recipeId]);

  useEffect(() => {
    if (!recipeId) {
      // No recipe yet (still loading the page). Stay in the loading state
      // rather than reporting an empty log for a recipe nobody has named.
      setCooks(null);
      setLoading(true);
      return;
    }
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const data = await fetchCooks(recipeId);
        if (alive) setCooks(data);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [recipeId]);

  const addCook = useCallback(
    async (draft: CookDraft): Promise<void> => {
      if (!recipeId) return;
      const { error } = await supabase
        .from("recipe_cooks")
        .insert({ recipe_id: recipeId, ...draft });
      if (error) throw new Error(error.message);
      await reload();
    },
    [recipeId, reload]
  );

  /** Soft delete, like everything else here — the row stays recoverable. */
  const removeCook = useCallback(
    async (id: string): Promise<void> => {
      const { error } = await supabase
        .from("recipe_cooks")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
      await reload();
    },
    [reload]
  );

  return { cooks, loading, error, addCook, removeCook, reload };
}
