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
}

export interface TreeNode extends TreePerson {
  children: TreeNode[];
  /** Ancestor cards floating above this one (e.g. "John's parents"). */
  parentsSelf?: TreeNode;
  parentsSpouse?: TreeNode;
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
    const { data, error } = await supabase
      .from("tree_members")
      .select("id, name, spouse_name, parent_id, parents_of, parents_side, sort_index")
      .order("sort_index")
      .order("name");
    if (error) return setError(error.message);
    const rows = (data ?? []) as TreePerson[];
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
      name: string,
      spouseName: string,
      siblingCount: number
    ) => {
      const { error } = await supabase.from("tree_members").insert({
        name: name.trim(),
        spouse_name: spouseName.trim() || null,
        parent_id: parentId,
        sort_index: siblingCount + 1,
      });
      if (error) throw error;
      await load();
    },
    [load]
  );

  const addParents = useCallback(
    async (
      targetId: string,
      side: "self" | "spouse",
      name: string,
      spouseName: string
    ) => {
      const { error } = await supabase.from("tree_members").insert({
        name: name.trim(),
        spouse_name: spouseName.trim() || null,
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
    async (id: string, name: string, spouseName: string) => {
      const { error } = await supabase
        .from("tree_members")
        .update({
          name: name.trim(),
          spouse_name: spouseName.trim() || null,
        })
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
