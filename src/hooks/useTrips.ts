import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { byNewest } from "@/lib/trips";

export interface TripDestination {
  kind: "country" | "state";
  code: string;
}

export interface Trip {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  blurb: string | null;
  deleted_at: string | null;
  created_at: string;
  /** family_members ids. */
  travellers: string[];
  destinations: TripDestination[];
}

/** The editable shape, as the form hands it back. */
export interface TripDraft {
  title: string;
  start_date: string | null;
  end_date: string | null;
  blurb: string | null;
  travellers: string[];
  destinations: TripDestination[];
}

interface TripRow {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  blurb: string | null;
  deleted_at: string | null;
  created_at: string;
}

/**
 * Trips are read in three queries rather than one nested select: PostgREST's
 * embedded resources need a foreign key it can name, and the two child tables
 * are plain join tables. Three small reads of a table this size is nothing,
 * and the shape stays obvious.
 */
async function fetchTrips(): Promise<Trip[]> {
  const [tripRes, travRes, destRes] = await Promise.all([
    supabase
      .from("trips")
      .select("id, title, start_date, end_date, blurb, deleted_at, created_at"),
    supabase.from("trip_travellers").select("trip_id, member_id"),
    supabase.from("trip_destinations").select("trip_id, kind, code"),
  ]);
  if (tripRes.error) throw new Error(tripRes.error.message);
  if (travRes.error) throw new Error(travRes.error.message);
  if (destRes.error) throw new Error(destRes.error.message);

  const travellers = new Map<string, string[]>();
  for (const r of travRes.data ?? []) {
    const list = travellers.get(r.trip_id) ?? [];
    list.push(r.member_id);
    travellers.set(r.trip_id, list);
  }
  const destinations = new Map<string, TripDestination[]>();
  for (const r of destRes.data ?? []) {
    const list = destinations.get(r.trip_id) ?? [];
    list.push({ kind: r.kind as "country" | "state", code: r.code });
    destinations.set(r.trip_id, list);
  }

  return ((tripRes.data ?? []) as TripRow[])
    // A soft-deleted trip stays readable to family so it can be restored, but
    // it should not appear in the list.
    .filter((t) => !t.deleted_at)
    .map((t) => ({
      ...t,
      travellers: travellers.get(t.id) ?? [],
      destinations: destinations.get(t.id) ?? [],
    }))
    .sort(byNewest);
}

/** Replace a trip's travellers and destinations to match the draft. */
async function saveChildren(tripId: string, draft: TripDraft): Promise<void> {
  // Add before removing, so a failure halfway leaves a trip with too many
  // rows rather than none -- the same order the passport sync uses.
  if (draft.travellers.length) {
    const { error } = await supabase.from("trip_travellers").upsert(
      draft.travellers.map((member_id) => ({ trip_id: tripId, member_id })),
      { onConflict: "trip_id,member_id", ignoreDuplicates: true }
    );
    if (error) throw new Error(`Saving travellers failed: ${error.message}`);
  }
  if (draft.destinations.length) {
    const { error } = await supabase.from("trip_destinations").upsert(
      draft.destinations.map((d) => ({ trip_id: tripId, ...d })),
      { onConflict: "trip_id,kind,code", ignoreDuplicates: true }
    );
    if (error) throw new Error(`Saving destinations failed: ${error.message}`);
  }

  const stale = supabase.from("trip_travellers").delete().eq("trip_id", tripId);
  const { error: tErr } = draft.travellers.length
    ? await stale.not("member_id", "in", `(${draft.travellers.join(",")})`)
    : await stale;
  if (tErr) throw new Error(`Tidying travellers failed: ${tErr.message}`);

  const { data: existing, error: readErr } = await supabase
    .from("trip_destinations")
    .select("kind, code")
    .eq("trip_id", tripId);
  if (readErr) throw new Error(`Tidying destinations failed: ${readErr.message}`);
  const wanted = new Set(draft.destinations.map((d) => `${d.kind}:${d.code}`));
  for (const row of existing ?? []) {
    if (wanted.has(`${row.kind}:${row.code}`)) continue;
    const { error } = await supabase
      .from("trip_destinations")
      .delete()
      .eq("trip_id", tripId)
      .eq("kind", row.kind)
      .eq("code", row.code);
    if (error) throw new Error(`Tidying destinations failed: ${error.message}`);
  }
}

export function useTrips() {
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTrips(await fetchTrips());
    } catch (e) {
      setError((e as Error).message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchTrips();
        if (alive) setTrips(data);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const createTrip = useCallback(
    async (draft: TripDraft): Promise<string> => {
      const { data, error } = await supabase
        .from("trips")
        .insert({
          title: draft.title,
          start_date: draft.start_date,
          end_date: draft.end_date,
          blurb: draft.blurb,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await saveChildren(data.id, draft);
      await reload();
      return data.id as string;
    },
    [reload]
  );

  const updateTrip = useCallback(
    async (id: string, draft: TripDraft): Promise<void> => {
      const { error } = await supabase
        .from("trips")
        .update({
          title: draft.title,
          start_date: draft.start_date,
          end_date: draft.end_date,
          blurb: draft.blurb,
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
      await saveChildren(id, draft);
      await reload();
    },
    [reload]
  );

  /** Soft delete -- the row stays, readable by family, restorable by hand. */
  const deleteTrip = useCallback(
    async (id: string): Promise<void> => {
      const { error } = await supabase
        .from("trips")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
      await reload();
    },
    [reload]
  );

  return { trips, loading, error, reload, createTrip, updateTrip, deleteTrip };
}
