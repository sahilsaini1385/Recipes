import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface TreePerson {
  id: string;
  name: string;
  spouse_name: string | null;
  parent_id: string | null;
  parents_of: string | null;
  parents_side: "self" | "spouse";
  sort_index: number;
  born_year: number | null;
  died_year: number | null;
  spouse_born_year: number | null;
  spouse_died_year: number | null;
  divorced: boolean;
}

export interface TreeNode extends TreePerson {
  children: TreeNode[];
  /** Ancestor cards floating above this one (e.g. "John's parents"). */
  parentsSelf?: TreeNode;
  parentsSpouse?: TreeNode;
}

/** What the add/edit forms collect; empty strings mean "not set". */
export interface PersonDetails {
  name: string;
  spouse: string;
  born: string;
  died: string;
  spouseBorn: string;
  spouseDied: string;
  divorced: boolean;
}

function yearOrNull(raw: string): number | null {
  const n = parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function detailColumns(d: PersonDetails) {
  return {
    name: d.name.trim(),
    spouse_name: d.spouse.trim() || null,
    born_year: yearOrNull(d.born),
    died_year: yearOrNull(d.died),
    spouse_born_year: yearOrNull(d.spouseBorn),
    spouse_died_year: yearOrNull(d.spouseDied),
    divorced: d.divorced && !!d.spouse.trim(),
  };
}

function buildTree(rows: TreePerson[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>(
    rows.map((r) => [r.id, { ...r, children: [] }])
  );
  const roots: TreeNode[] = [];
  for (const node of nodes.values()) {
    if (node.parents_of) {
      const target = nodes.get(node.parents_of);
      if (target) {
        if (node.parents_side === "spouse") target.parentsSpouse = node;
        else target.parentsSelf = node;
        continue;
      }
    }
    const parent = node.parent_id ? nodes.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function useFamilyTree() {
  const [roots, setRoots] = useState<TreeNode[] | null>(null);
  const [peopleCount, setPeopleCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    let res = await supabase
      .from("tree_members")
      .select(
        "id, name, spouse_name, parent_id, parents_of, parents_side, sort_index, born_year, died_year, spouse_born_year, spouse_died_year, divorced"
      )
      .order("sort_index")
      .order("name");
    if (res.error && /divorced/.test(res.error.message)) {
      // The divorced column's migration hasn't been run yet — load without it.
      res = (await supabase
        .from("tree_members")
        .select(
          "id, name, spouse_name, parent_id, parents_of, parents_side, sort_index, born_year, died_year, spouse_born_year, spouse_died_year"
        )
        .order("sort_index")
        .order("name")) as typeof res;
    }
    const { data, error } = res;
    if (error) return setError(error.message);
    const rows = ((data ?? []) as Array<Omit<TreePerson, "divorced"> & { divorced?: boolean }>).map(
      (r) => ({ ...r, divorced: r.divorced ?? false })
    ) as TreePerson[];
    setRoots(buildTree(rows));
    setPeopleCount(
      rows.length + rows.filter((r) => r.spouse_name?.trim()).length
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addChild = useCallback(
    async (
      parentId: string | null,
      details: PersonDetails,
      siblingCount: number
    ) => {
      const { error } = await supabase.from("tree_members").insert({
        ...detailColumns(details),
        parent_id: parentId,
        sort_index: siblingCount + 1,
      });
      if (error) throw error;
      await load();
    },
    [load]
  );

  const addParents = useCallback(
    async (targetId: string, side: "self" | "spouse", details: PersonDetails) => {
      const { error } = await supabase.from("tree_members").insert({
        ...detailColumns(details),
        parents_of: targetId,
        parents_side: side,
        sort_index: side === "self" ? 1 : 2,
      });
      if (error) throw error;
      await load();
    },
    [load]
  );

  const updatePerson = useCallback(
    async (id: string, details: PersonDetails) => {
      const { error } = await supabase
        .from("tree_members")
        .update(detailColumns(details))
        .eq("id", id);
      if (error) throw error;
      await load();
    },
    [load]
  );

  // Deleting a person also deletes everyone below them and their ancestor
  // cards (database cascade).
  const removePerson = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("tree_members")
        .delete()
        .eq("id", id);
      if (error) throw error;
      await load();
    },
    [load]
  );

  return {
    roots,
    peopleCount,
    error,
    addChild,
    addParents,
    updatePerson,
    removePerson,
  };
}
