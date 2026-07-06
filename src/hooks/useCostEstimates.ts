import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { refreshRecipes } from "./useRecipes";
import { useAuth } from "./useAuth";

// Module-level guard so the backfill runs at most once per page load.
let started = false;

/**
 * Quietly fills in missing cost-per-serving estimates while a family member
 * has the site open, one small batch at a time, until everything is priced.
 * Failures are silent — cost tags simply stay absent until a later visit.
 */
export function useCostEstimates() {
  const { isFamily } = useAuth();

  useEffect(() => {
    if (!isFamily || started) return;
    started = true;
    let cancelled = false;

    (async () => {
      // Bounded loop so a failure can't spin forever; 60 batches × 8 covers
      // even a large collection in one signed-in visit.
      for (let i = 0; i < 60 && !cancelled; i++) {
        try {
          const { data, error } = await supabase.functions.invoke(
            "estimate-costs",
            { body: {} }
          );
          if (error || !data || data.error) break;
          if (data.updated > 0) await refreshRecipes();
          if (!data.remaining || data.updated === 0) break;
        } catch {
          break;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isFamily]);
}
