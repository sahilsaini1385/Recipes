import { describe, it, expect } from "vitest";
import {
  buildCreditIndex,
  groupByPerson,
  matchCredit,
  normalizeName,
} from "./credits";

/**
 * Every credit string below is real, taken from the recipes table, and the
 * tree is the real tree. The cases that matter most are the ones this must
 * NOT match: attributing a recipe to the wrong grandfather is a real harm in
 * a family archive, while leaving it as plain text costs nothing.
 */
const TREE = [
  // Spouses are a field, not a row — which is how Nancy, who has more
  // recipes than anyone, gets into the index at all.
  { id: "john", name: "John Jungman", spouse_name: "Nancy Jungman" },
  { id: "will", name: "Will Jungman", spouse_name: "Frédérique Jungman" },
  { id: "kathryn", name: "Kathryn Saini", spouse_name: "Sahil Saini" },
  { id: "yfrank", name: "Y Frank Jungman", spouse_name: "Marilyn Jungman" },
  { id: "jfrank", name: "J Frank Jungman", spouse_name: "Thelma Jungman" },
  { id: "cliff", name: "Cliff Siegel", spouse_name: "Karina Litwack" },
  { id: "kay", name: 'Kathryn "Kay" Reeves', spouse_name: "Irvin Reeves" },
  { id: "bob", name: 'Robert "Bob" Jungman', spouse_name: null },
  { id: "knox", name: "Thomas “Knox” Emerson", spouse_name: null },
  { id: "linda", name: "Linda Walker", spouse_name: "Michael Walker" },
];
const index = buildCreditIndex(TREE);
const names = (credit: string) =>
  matchCredit(credit, index)
    .map((m) => m.name)
    .sort();

describe("normalizeName", () => {
  it("drops quoted nicknames, straight and curly", () => {
    expect(normalizeName('Robert "Bob" Jungman')).toBe("robert jungman");
    expect(normalizeName("Thomas “Knox” Emerson")).toBe("thomas emerson");
  });

  it("keeps accents, which are part of the name", () => {
    expect(normalizeName("Frédérique Jungman")).toBe("frédérique jungman");
  });
});

describe("matchCredit — the ones it should find", () => {
  it("matches a spouse, who is a field rather than a row", () => {
    // 34 recipes hang on this one working.
    const m = matchCredit("Nancy Jungman", index);
    expect(m).toHaveLength(1);
    expect(m[0].name).toBe("Nancy Jungman");
    expect(m[0].personId).toBe("john");
  });

  it("matches an ordinary full name", () => {
    expect(names("John Jungman")).toEqual(["John Jungman"]);
    expect(names("Will Jungman")).toEqual(["Will Jungman"]);
  });

  it("matches a bare first name when only one person has it", () => {
    expect(names("Nancy")).toEqual(["Nancy Jungman"]);
    expect(names("John")).toEqual(["John Jungman"]);
  });

  it("finds two people in one credit", () => {
    expect(names("John and Will Jungman")).toEqual([
      "John Jungman",
      "Will Jungman",
    ]);
    expect(names("Betsy Rayle / Nancy Jungman")).toEqual(["Nancy Jungman"]);
  });

  it("finds a name buried in prose", () => {
    expect(
      names(
        "Giada De Laurentiis, Everyday Italian cookbook, p. 197 (submitted by Nancy Jungman)"
      )
    ).toEqual(["Nancy Jungman"]);
    expect(
      names("Glenn Pinkerton (toned down by John Jungman), submitted by Nancy Jungman")
    ).toEqual(["John Jungman", "Nancy Jungman"]);
    expect(
      names("John Jungman (meat from Ina Garten; glaze from NatashasKitchen.com)")
    ).toEqual(["John Jungman"]);
  });

  it("reads a surname-first credit", () => {
    // The tree spells her Kathryn Saini, so this finds nobody — but it must
    // not throw, and if she were on the tree as a Jungman it would resolve.
    expect(() => names("Jungman, Kathryn")).not.toThrow();
    const asJungman = buildCreditIndex([
      { id: "k", name: "Kathryn Jungman", spouse_name: null },
    ]);
    expect(matchCredit("Jungman, Kathryn", asJungman)[0]?.name).toBe(
      "Kathryn Jungman"
    );
  });

  it("looks past a quoted nickname on the tree side", () => {
    expect(names("Robert Jungman")).toEqual(['Robert "Bob" Jungman']);
  });
});

describe("matchCredit — the ones it must refuse", () => {
  it("will not choose between two people with the same name", () => {
    // The tree holds Y Frank Jungman and J Frank Jungman. A recipe credited
    // to "Frank Jungman" belongs to one of them and there is no way to know
    // which, so it stays plain text.
    expect(names("Frank Jungman")).toEqual([]);
  });

  it("will not match a shared first name", () => {
    // Kathryn Saini and Kathryn "Kay" Reeves.
    expect(names("Kathryn")).toEqual([]);
  });

  it("will not match on a first name when the surname disagrees", () => {
    // The tree has Karina Litwack; the recipe credits Karina Valencia. They
    // may well be the same person, but the app must not decide that.
    expect(names("Karina Valencia")).toEqual([]);
  });

  it("tells apart the three different Nancys in the collection", () => {
    // Nancy Jungman has 48 recipes; Nancy Vason and Nancy Woodall have their
    // own. Matching a first name found inside a longer name would hand all
    // of them to the wrong person.
    expect(names("Nancy Jungman")).toEqual(["Nancy Jungman"]);
    expect(names("Nancy Vason")).toEqual([]);
    expect(names("Nancy Woodall")).toEqual([]);
    expect(names("Nancy Woodall (Aunt Dorothy's recipe)")).toEqual([]);
  });

  it("does not claim a married name it was never told about", () => {
    // "Kathryn Jungman" is Kathryn Saini before she married. The tree holds
    // no maiden names, so the app has no basis to connect them and says so
    // by leaving the credit as plain text.
    expect(names("Kathryn Jungman")).toEqual([]);
  });

  it("leaves cookbooks, magazines and websites alone", () => {
    for (const credit of [
      "Charleston Receipts, 1950",
      "sallysbakingaddiction.com",
      "The Pioneer Woman",
      "Solid Starts",
      "Ina Garten",
      "Cookie and Kate",
      "Ann Meyer, Cooking Light Magazine",
      "Carla Lalli Music, Where Cooking Begins",
      "Chris Kimball / Milk Street",
      "Garden & Gun",
      "A Sweet Pea Chef / Lois Smitherman",
      "Howard Menard, Kaplan, Louisiana",
      "Ali Weiner and Ryan Winograd",
    ]) {
      expect(names(credit)).toEqual([]);
    }
  });

  it("survives the junk credits already in the table", () => {
    expect(names(",")).toEqual([]);
    expect(matchCredit("", index)).toEqual([]);
    expect(matchCredit(null, index)).toEqual([]);
    expect(names("   ")).toEqual([]);
  });
});

describe("buildCreditIndex", () => {
  it("registers a person under both their full and shortened name", () => {
    const solo = buildCreditIndex([
      { id: "y", name: "Y Frank Jungman", spouse_name: null },
    ]);
    // With only one of them on the tree, the shortened form is unambiguous.
    expect(matchCredit("Frank Jungman", solo)[0]?.name).toBe("Y Frank Jungman");
    expect(matchCredit("Y Frank Jungman", solo)[0]?.name).toBe("Y Frank Jungman");
  });

  it("points a spouse at the row they are married into", () => {
    const m = matchCredit("Marilyn Jungman", index);
    expect(m[0].personId).toBe("yfrank");
    expect(m[0].name).toBe("Marilyn Jungman");
  });

  it("copes with a tree that has nobody on it", () => {
    expect(matchCredit("Nancy Jungman", buildCreditIndex([]))).toEqual([]);
  });
});

describe("groupByPerson", () => {
  const recipes = [
    { slug: "cornbread", credit: "Nancy Jungman" },
    { slug: "brisket", credit: "Nancy Jungman" },
    { slug: "gumbo", credit: "John Jungman" },
    { slug: "chili", credit: "John and Will Jungman" },
    { slug: "tart", credit: "Ina Garten" },
    { slug: "cake", credit: null },
  ];

  it("puts a couple in one bucket and names both of them", () => {
    // The whole point: John's row holds Nancy's cooking too, and a page
    // showing this bucket must not credit John with her brisket.
    const john = groupByPerson(recipes, index).get("john");
    expect(john?.recipes.map((r) => r.slug)).toEqual([
      "cornbread",
      "brisket",
      "gumbo",
      "chili",
    ]);
    expect(john?.names).toEqual(["Nancy Jungman", "John Jungman"]);
  });

  it("counts a recipe against everyone it credits", () => {
    // "John and Will Jungman" is one recipe on two rows, not half each.
    expect(
      groupByPerson(recipes, index).get("will")?.recipes.map((r) => r.slug)
    ).toEqual(["chili"]);
  });

  it("leaves out people and sources it could not place", () => {
    const grouped = groupByPerson(recipes, index);
    expect(grouped.has("kathryn")).toBe(false);
    expect([...grouped.keys()].sort()).toEqual(["john", "will"]);
  });

  it("is empty for a collection with nothing credited", () => {
    expect(groupByPerson([{ credit: null }], index).size).toBe(0);
    expect(groupByPerson([], index).size).toBe(0);
  });
});
