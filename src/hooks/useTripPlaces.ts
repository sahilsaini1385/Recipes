import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface TripPlace {
  id: string;
  trip_id: string;
  name: string;
  city: string | null;
  country_code: string | null;
  kind: string;
  note: string | null;
  would_return: boolean | null;
  url: string | null;
  created_at: string;
}

/** What the form hands back. */
export interface TripPlaceDraft {
  name: string;
  city: string | null;
  country_code: string | null;
  kind: string;
  note: string | null;
  would_return: boolean | null;
  url: string | null;
}

const COLUMNS =
  "id, trip_id, name, city, country_code, kind, note, would_return, url, created_at";

/**
 * Every place across every trip, in one read.
 *
 * Loaded whole rather than per-trip because the point of the feature is the
 * cross-trip question — "where did we eat in Lisbon" — and the table is a
 * handful of rows per holiday. A trip page filters this list rather than
 * issuing its own query, so opening a trip after the browser costs nothing.
 */
async function fetchPlaces(): Promise<TripPlace[]> {
  const { data, error } = await supabase
    .from("trip_places")
    .select(COLUMNS)
    // Soft-deleted rows are invisible to the public link by policy, but
    // family can read them, so filter here too or a removed place would
    // reappear for whoever is signed in.
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TripPlace[];
}

export function useTripPlaces() {
  const [places, setPlaces] = useState<TripPlace[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setPlaces(await fetchPlaces());
    } catch (e) {
      setError((e as Error).message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchPlaces();
        if (alive) setPlaces(data);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const addPlace = useCallback(
    async (tripId: string, draft: TripPlaceDraft): Promise<void> => {
      const { error } = await supabase
        .from("trip_places")
        .insert({ trip_id: tripId, ...draft });
      if (error) throw new Error(error.message);
      await reload();
    },
    [reload]
  );

  const updatePlace = useCallback(
    async (id: string, draft: TripPlaceDraft): Promise<void> => {
      const { error } = await supabase
        .from("trip_places")
        .update(draft)
        .eq("id", id);
      if (error) throw new Error(error.message);
      await reload();
    },
    [reload]
  );

  /** Soft delete, like trips — the row stays and can be brought back. */
  const removePlace = useCallback(
    async (id: string): Promise<void> => {
      const { error } = await supabase
        .from("trip_places")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
      await reload();
    },
    [reload]
  );

  return { places, loading, error, reload, addPlace, updatePlace, removePlace };
}
