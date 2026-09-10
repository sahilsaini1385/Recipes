import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  buildCreditIndex,
  groupByPerson,
  matchCredit,
  type CreditMatch,
  type CreditPerson,
} from "@/lib/credits";

/** All this needs of a recipe. The family tree passes rows with nothing else
 *  on them: the whole collection is 294 KB and the credits alone are 5 KB. */
interface Credited {
  credit: string | null;
}

/**
 * Who in the family a recipe came from.
 *
 * Reads the tree directly rather than going through useFamilyTree, which
 * builds a nested chart nobody needs here — three columns of 38 rows is a
 * cheaper thing to ask for than the whole shape of the family.
 */
export function useRecipeAttribution<T extends Credited>(recipes: T[] | null) {
  const [people, setPeople] = useState<CreditPerson[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("tree_members")
        .select("id, name, spouse_name");
      // A failure here is not worth surfacing: the credit simply stays plain
      // text, which is what it was before this feature existed.
      if (alive) setPeople((data ?? []) as CreditPerson[]);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const index = useMemo(
    () => buildCreditIndex(people ?? []),
    [people]
  );

  /** Everyone on the tree a given credit names. */
  const matchesFor = useMemo(
    () => (credit: string | null) => matchCredit(credit, index),
    [index]
  );

  /** personId -> the recipes credited to that tree row. See groupByPerson. */
  const byPerson = useMemo(
    () =>
      recipes && people
        ? groupByPerson(recipes, index)
        : new Map<string, { names: string[]; recipes: T[] }>(),
    [recipes, people, index]
  );

  return { matchesFor, byPerson, ready: people !== null };
}

/**
 * Just the credit column, for callers that want to know who cooked what
 * without downloading the collection. The family tree is the only one so far.
 */
export function useRecipeCredits() {
  const [credits, setCredits] = useState<Credited[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.from("recipes").select("credit");
      if (alive) setCredits((data ?? []) as Credited[]);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return credits;
}

export type { CreditMatch };
