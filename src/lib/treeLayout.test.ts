import { describe, it, expect } from "vitest";
import { CARD_H, CARD_W, PAD, layoutChart } from "./treeLayout";
import type { TreeNode } from "@/hooks/useFamilyTree";

let seq = 0;
function person(
  name: string,
  extra: Partial<TreeNode> = {}
): TreeNode {
  return {
    id: `p${++seq}`,
    name,
    spouse_name: null,
    parent_id: null,
    parents_of: null,
    parents_side: "self",
    sort_index: 1,
    born_year: null,
    died_year: null,
    spouse_born_year: null,
    spouse_died_year: null,
    divorced: false,
    children: [],
    ...extra,
  };
}

/** Cards on the same row must never overlap. */
function noOverlaps(cards: ReturnType<typeof layoutChart>["cards"]) {
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const a = cards[i];
      const b = cards[j];
      if (a.row !== b.row) continue;
      if (Math.abs(a.x - b.x) < CARD_W) return `${a.node.name} / ${b.node.name}`;
    }
  }
  return null;
}

describe("layoutChart", () => {
  const singleRoot = () => [
    person("John", {
      spouse_name: "Nancy",
      children: [person("Will"), person("Kathryn"), person("Robert")],
    }),
  ];

  const withInLaws = () => [
    person("John", {
      spouse_name: "Nancy",
      children: [
        person("Will", {
          spouse_name: "Frédérique",
          parentsSpouse: person("Cliff", { spouse_name: "Karina" }),
          children: [person("Elisabeth"), person("James")],
        }),
        person("Kathryn", {
          spouse_name: "Sahil",
          parentsSpouse: person("Rajinder", { spouse_name: "Jatinder" }),
        }),
      ],
      parentsSelf: person("Frank", { spouse_name: "Marilyn" }),
    }),
  ];

  it("places every person exactly once", () => {
    const { cards } = layoutChart(singleRoot());
    expect(cards).toHaveLength(4);
    expect(new Set(cards.map((c) => c.node.id)).size).toBe(4);
  });

  it("never overlaps cards on the same row", () => {
    for (const roots of [singleRoot(), withInLaws()]) {
      const { cards } = layoutChart(roots);
      expect(noOverlaps(cards)).toBeNull();
    }
  });

  it("keeps every card inside the reported canvas", () => {
    const { cards, chartW, chartH } = layoutChart(withInLaws());
    for (const c of cards) {
      expect(c.x).toBeGreaterThanOrEqual(PAD - 0.001);
      expect(c.x + CARD_W).toBeLessThanOrEqual(chartW + 0.001);
      expect(c.y ?? 0).toBeGreaterThanOrEqual(PAD - 0.001);
      expect((c.y ?? 0) + CARD_H).toBeLessThanOrEqual(chartH + 0.001);
    }
  });

  it("connects only cards that exist", () => {
    const { cards, paths } = layoutChart(withInLaws());
    const ids = new Set(cards.map((c) => c.node.id));
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) {
      expect(ids.has(p.fromId)).toBe(true);
      expect(ids.has(p.toId)).toBe(true);
    }
  });

  it("labels hoisted ancestor couples", () => {
    const { cards } = layoutChart(withInLaws());
    const labelled = cards.filter((c) => c.label);
    expect(labelled.length).toBeGreaterThan(0);
    for (const c of labelled) expect(c.label).toMatch(/parents$/);
  });

  it("is deterministic", () => {
    const a = layoutChart(withInLaws());
    const b = layoutChart(withInLaws());
    expect(a.cards.map((c) => [c.node.name, c.x, c.row])).toEqual(
      b.cards.map((c) => [c.node.name, c.x, c.row])
    );
  });

  it("handles a lone person and disjoint families", () => {
    expect(layoutChart([person("Solo")]).cards).toHaveLength(1);
    const two = layoutChart([person("A"), person("B")]);
    expect(two.cards).toHaveLength(2);
    expect(noOverlaps(two.cards)).toBeNull();
  });
});
