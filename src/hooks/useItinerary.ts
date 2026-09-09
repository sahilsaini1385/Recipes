import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { DayEntry } from "@/lib/itinerary";

export interface ItineraryEntry extends DayEntry {
  trip_id: string;
}

/** What the form hands back. */
export interface ItineraryDraft {
  day: string;
  at: string | null;
  title: string;
  note: string | null;
  place_id: string | null;
}

const COLUMNS = "id, trip_id, day, at, title, note, place_id, position";

/**
 * One trip's itinerary. Unlike places, these are fetched per trip: there is no
 * cross-trip question to answer here, and a family with years of trips would
 * be pulling every day of every holiday to render one page.
 */
async function fetchItinerary(tripId: string): Promise<ItineraryEntry[]> {
  const { data, error } = await supabase
    .from("trip_days")
    .select(COLUMNS)
    .eq("trip_id", tripId)
    // Soft-deleted rows are hidden from the public link by policy, but family
    // can read them, so filter here too or a removed entry would come back
    // for whoever is signed in.
    .is("deleted_at", null)
    .order("day", { ascending: true })
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ItineraryEntry[];
}

export function useItinerary(tripId: string | undefined) {
  const [entries, setEntries] = useState<ItineraryEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!tripId) return;
    setError(null);
    try {
      setEntries(await fetchItinerary(tripId));
    } catch (e) {
      setError((e as Error).message);
    }
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    if (!tripId) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const data = await fetchItinerary(tripId);
        if (alive) setEntries(data);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [tripId]);

  const addEntry = useCallback(
    async (draft: ItineraryDraft): Promise<void> => {
      if (!tripId) return;
      // New entries land at the end of their day. Reading the current tail
      // rather than counting locally keeps the order right when two people
      // are adding to the same day.
      const sameDay = (entries ?? []).filter((e) => e.day === draft.day);
      const position = sameDay.length
        ? Math.max(...sameDay.map((e) => e.position)) + 1
        : 0;
      const { error } = await supabase
        .from("trip_days")
        .insert({ trip_id: tripId, ...draft, position });
      if (error) throw new Error(error.message);
      await reload();
    },
    [tripId, entries, reload]
  );

  const updateEntry = useCallback(
    async (id: string, draft: ItineraryDraft): Promise<void> => {
      const { error } = await supabase
        .from("trip_days")
        .update(draft)
        .eq("id", id);
      if (error) throw new Error(error.message);
      await reload();
    },
    [reload]
  );

  /** Soft delete, like everything else in the archive. */
  const removeEntry = useCallback(
    async (id: string): Promise<void> => {
      const { error } = await supabase
        .from("trip_days")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
      await reload();
    },
    [reload]
  );

  return { entries, loading, error, reload, addEntry, updateEntry, removeEntry };
}
