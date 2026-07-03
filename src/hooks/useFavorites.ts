import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";

const LOCAL_KEY = "recipe-favorites";

function loadLocal(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveLocal(ids: Set<string>) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify([...ids]));
}

/**
 * Favorites live in the database for signed-in users and in localStorage for
 * anonymous visitors, so the toggle works for everyone.
 */
export function useFavorites() {
  const { session } = useAuth();
  const [favorites, setFavorites] = useState<Set<string>>(loadLocal);

  useEffect(() => {
    if (!session) {
      setFavorites(loadLocal());
      return;
    }
    supabase
      .from("favorites")
      .select("recipe_id")
      .then(({ data }) => {
        if (data) setFavorites(new Set(data.map((r) => r.recipe_id)));
      });
  }, [session]);

  const toggle = useCallback(
    async (recipeId: string) => {
      const next = new Set(favorites);
      const isFav = next.has(recipeId);
      if (isFav) next.delete(recipeId);
      else next.add(recipeId);
      setFavorites(next);

      if (session) {
        if (isFav) {
          await supabase
            .from("favorites")
            .delete()
            .eq("recipe_id", recipeId);
        } else {
          await supabase.from("favorites").insert({ recipe_id: recipeId });
        }
      } else {
        saveLocal(next);
      }
    },
    [favorites, session]
  );

  return { favorites, toggle };
}
