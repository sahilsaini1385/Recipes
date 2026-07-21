import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface FamilyMember {
  id: string;
  name: string;
  sort_index: number;
}

export type PlaceKind = "country" | "state";

export interface Passport {
  members: FamilyMember[];
  /** member_id -> set of country codes visited. */
  countries: Record<string, Set<string>>;
  /** member_id -> set of US state codes visited. */
  states: Record<string, Set<string>>;
}

function groupVisits(
  rows: Array<{ member_id: string; code: string }>
): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const r of rows) (out[r.member_id] ??= new Set()).add(r.code);
  return out;
}

export function usePassport() {
  const [data, setData] = useState<Passport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [membersRes, countryRes, stateRes] = await Promise.all([
      supabase
        .from("family_members")
        .select("id, name, sort_index")
        .order("sort_index")
        .order("name"),
      supabase.from("country_visits").select("member_id, country_code"),
      supabase.from("state_visits").select("member_id, state_code"),
    ]);
    if (membersRes.error) return setError(membersRes.error.message);
    if (countryRes.error) return setError(countryRes.error.message);
    // state_visits may not exist yet if that migration hasn't run — tolerate it.
    setData({
      members: (membersRes.data ?? []) as FamilyMember[],
      countries: groupVisits(
        (countryRes.data ?? []).map((r) => ({
          member_id: r.member_id,
          code: r.country_code,
        }))
      ),
      states: groupVisits(
        (stateRes.data ?? []).map((r) => ({
          member_id: r.member_id,
          code: r.state_code,
        }))
      ),
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addMember = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const sort_index = (data?.members.length ?? 0) + 1;
      const { error } = await supabase
        .from("family_members")
        .insert({ name: trimmed, sort_index });
      if (error) throw error;
      await load();
    },
    [data, load]
  );

  const removeMember = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("family_members")
        .delete()
        .eq("id", id);
      if (error) throw error;
      await load();
    },
    [load]
  );

  const table = (kind: PlaceKind) =>
    kind === "country" ? "country_visits" : "state_visits";
  const column = (kind: PlaceKind) =>
    kind === "country" ? "country_code" : "state_code";
  const bucket = (kind: PlaceKind) =>
    kind === "country" ? "countries" : "states";

  const addVisit = useCallback(
    async (kind: PlaceKind, memberId: string, code: string) => {
      setData((d) => {
        if (!d) return d;
        const b = bucket(kind);
        const map = { ...d[b] };
        map[memberId] = new Set(map[memberId] ?? []).add(code);
        return { ...d, [b]: map };
      });
      const { error } = await supabase
        .from(table(kind))
        .insert({ member_id: memberId, [column(kind)]: code });
      if (error && !/duplicate key/i.test(error.message)) {
        await load();
        throw error;
      }
    },
    [load]
  );

  const removeVisit = useCallback(
    async (kind: PlaceKind, memberId: string, code: string) => {
      setData((d) => {
        if (!d) return d;
        const b = bucket(kind);
        const map = { ...d[b] };
        const set = new Set(map[memberId] ?? []);
        set.delete(code);
        map[memberId] = set;
        return { ...d, [b]: map };
      });
      const { error } = await supabase
        .from(table(kind))
        .delete()
        .eq("member_id", memberId)
        .eq(column(kind), code);
      if (error) {
        await load();
        throw error;
      }
    },
    [load]
  );

  return {
    data,
    error,
    reload: load,
    addMember,
    removeMember,
    addVisit,
    removeVisit,
  };
}
