import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface FamilyMember {
  id: string;
  name: string;
  sort_index: number;
}

export interface Passport {
  members: FamilyMember[];
  /** member_id -> set of country codes visited. */
  visits: Record<string, Set<string>>;
}

export function usePassport() {
  const [data, setData] = useState<Passport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [membersRes, visitsRes] = await Promise.all([
      supabase
        .from("family_members")
        .select("id, name, sort_index")
        .order("sort_index")
        .order("name"),
      supabase.from("country_visits").select("member_id, country_code"),
    ]);
    if (membersRes.error) return setError(membersRes.error.message);
    if (visitsRes.error) return setError(visitsRes.error.message);

    const visits: Record<string, Set<string>> = {};
    for (const v of visitsRes.data ?? []) {
      (visits[v.member_id] ??= new Set()).add(v.country_code);
    }
    setData({ members: (membersRes.data ?? []) as FamilyMember[], visits });
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

  const addVisit = useCallback(
    async (memberId: string, code: string) => {
      // Optimistic update so the flag appears instantly.
      setData((d) => {
        if (!d) return d;
        const visits = { ...d.visits };
        visits[memberId] = new Set(visits[memberId] ?? []).add(code);
        return { ...d, visits };
      });
      const { error } = await supabase
        .from("country_visits")
        .insert({ member_id: memberId, country_code: code });
      if (error && !/duplicate key/i.test(error.message)) {
        await load();
        throw error;
      }
    },
    [load]
  );

  const removeVisit = useCallback(
    async (memberId: string, code: string) => {
      setData((d) => {
        if (!d) return d;
        const visits = { ...d.visits };
        const set = new Set(visits[memberId] ?? []);
        set.delete(code);
        visits[memberId] = set;
        return { ...d, visits };
      });
      const { error } = await supabase
        .from("country_visits")
        .delete()
        .eq("member_id", memberId)
        .eq("country_code", code);
      if (error) {
        await load();
        throw error;
      }
    },
    [load]
  );

  return { data, error, reload: load, addMember, removeMember, addVisit, removeVisit };
}
