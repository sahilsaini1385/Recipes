import { describe, it, expect } from "vitest";
import {
  aisleFor,
  buildShoppingList,
  countLines,
  isTapWater,
  itemKey,
  unitKey,
  type ShoppingSource,
} from "./shopping";
import type { Ingredient } from "./types";

/**
 * Every item and unit string below is real, taken from the recipes table.
 * The collection writes the same thing many ways, and most of these tests
 * exist because the first version of the rules got that case wrong on the
 * real data.
 */
function ing(
  raw: string,
  item: string,
  quantity: number | null,
  unit: string | null,
  extra: Partial<Ingredient> = {}
): Ingredient {
  return {
    raw,
    item,
    quantity,
    unit,
    note: "",
    scalable: quantity != null,
    ...extra,
  };
}

const recipe = (title: string, ingredients: Ingredient[]): ShoppingSource => ({
  title,
  ingredients,
});

/** Flatten to "label: amounts" for compact assertions. */
function flat(sources: ShoppingSource[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const g of buildShoppingList(sources)) {
    for (const l of g.lines) out[l.label] = l.amounts.join(" + ");
  }
  return out;
}

describe("combining amounts", () => {
  it("adds two recipes that ask for the same thing in the same unit", () => {
    const list = flat([
      recipe("A", [ing("2 cups flour", "flour", 2, "cups")]),
      recipe("B", [ing("1 c. flour", "flour", 1, "c.")]),
    ]);
    expect(list.flour).toBe("3 cups");
  });

  it("keeps units apart rather than inventing a conversion", () => {
    // "1 cup + 2 tablespoons" is what the cook wrote. Folding it into
    // "1⅛ cups" would be arithmetic nobody asked for.
    const list = flat([
      recipe("A", [ing("1 cup butter", "butter", 1, "cup")]),
      recipe("B", [ing("2 T butter", "butter", 2, "T")]),
    ]);
    expect(list.butter).toBe("1 cup + 2 tablespoons");
  });

  it("does not add teaspoons to tablespoons", () => {
    // The collection writes both, and they are three times apart.
    const list = flat([
      recipe("A", [ing("1 T salt", "salt", 1, "T")]),
      recipe("B", [ing("1 t salt", "salt", 1, "t")]),
    ]);
    expect(list.salt).toBe("1 tablespoon + 1 teaspoon");
  });

  it("never merges a can with a package", () => {
    // One jar when the cook needs two is the failure this prevents.
    const list = flat([
      recipe("A", [ing("2 cans Rotel", "Rotel", 2, "cans")]),
      recipe("B", [ing("1 pkg Rotel", "Rotel", 1, "pkg")]),
    ]);
    expect(list.Rotel).toBe("2 cans + 1 package");
  });

  it("buys for the top of a range", () => {
    // Running out halfway through is worse than a little left over.
    const list = flat([
      recipe("A", [
        ing("2 to 3 lbs chuck roast", "chuck roast", 2, "lbs", {
          quantity_max: 3,
        }),
      ]),
    ]);
    expect(list["chuck roast"]).toBe("3 pounds");
  });

  it("lists an ingredient with no quantity at all", () => {
    // 'olive oil' and 'avocado, optional' are real lines with no number.
    // You still have to buy them.
    const list = flat([
      recipe("A", [
        ing("olive oil", "olive oil", null, null),
        ing("avocado, optional", "avocado", null, null),
      ]),
    ]);
    expect(list["olive oil"]).toBe("");
    expect(list.avocado).toBe("");
  });

  it("does not let an unquantified line wipe out a total", () => {
    const list = flat([
      recipe("A", [ing("2 cups sugar", "sugar", 2, "cups")]),
      recipe("B", [ing("sugar, for dusting", "sugar", null, null)]),
    ]);
    expect(list.sugar).toBe("2 cups");
  });

  it("counts unitless things, and says 4 eggs rather than 4 egg", () => {
    const list = flat([
      recipe("A", [ing("3 eggs, beaten", "eggs", 3, null)]),
      recipe("B", [ing("1 egg", "egg", 1, null)]),
    ]);
    expect(list.eggs).toBe("4");
    expect(Object.keys(list)).toEqual(["eggs"]);
  });

  it("leaves alone the words that pluralise badly", () => {
    // A general pluraliser turned these into garlics and broccolis once.
    const list = flat([
      recipe("A", [ing("3 cloves garlic", "garlic", 3, null)]),
      recipe("B", [ing("2 broccoli", "broccoli", 2, null)]),
    ]);
    expect(Object.keys(list).sort()).toEqual(["broccoli", "garlic"]);
  });
});

describe("itemKey — folding spellings together", () => {
  it("folds a plural into its singular", () => {
    expect(itemKey("onions")).toBe(itemKey("onion"));
    expect(itemKey("carrots")).toBe(itemKey("carrot"));
    expect(itemKey("Eggs")).toBe(itemKey("egg"));
  });

  it("folds a word the collection only ever writes as a plural without harm", () => {
    // "capers" folds to "caper" internally, which nothing else collides
    // with. What matters is that the shopper still reads the real spelling.
    const list = flat([
      recipe("A", [ing("2 T. capers", "capers", 2, "T.")]),
      recipe("B", [ing("1 T capers", "capers", 1, "T")]),
    ]);
    expect(list.capers).toBe("3 tablespoons");
    expect(Object.keys(list)).toEqual(["capers"]);
  });

  it("does not merge different things that happen to look alike", () => {
    expect(itemKey("butter")).not.toBe(itemKey("peanut butter"));
    expect(itemKey("flour")).not.toBe(itemKey("all-purpose flour"));
    expect(itemKey("onion")).not.toBe(itemKey("red onion"));
  });

  it("merges three spellings into one counted line", () => {
    const list = flat([
      recipe("A", [ing("1 Onion", "Onion", 1, null)]),
      recipe("B", [ing("2 onions", "onions", 2, null)]),
      recipe("C", [ing("1 onion", "onion", 1, null)]),
    ]);
    expect(Object.keys(list)).toEqual(["onions"]);
    expect(list.onions).toBe("4");
  });

  it("shows the commonest spelling when it is not being counted", () => {
    // With a unit in play the name is not inflected, so this is purely a
    // question of which of the two spellings the collection prefers.
    const list = flat([
      recipe("A", [ing("1 cup Sugar", "Sugar", 1, "cup")]),
      recipe("B", [ing("2 cups sugar", "sugar", 2, "cups")]),
      recipe("C", [ing("1 c sugar", "sugar", 1, "c")]),
    ]);
    expect(Object.keys(list)).toEqual(["sugar"]);
    expect(list.sugar).toBe("4 cups");
  });
});

describe("unitKey", () => {
  it("keeps the recipe-card T and t apart", () => {
    expect(unitKey("T")).toBe("tablespoon");
    expect(unitKey("t")).toBe("teaspoon");
    expect(unitKey("T.")).toBe("tablespoon");
    expect(unitKey("t.")).toBe("teaspoon");
  });

  it("folds the collection's many spellings of one unit", () => {
    for (const u of ["cup", "cups", "c", "C", "c."]) {
      expect(unitKey(u)).toBe("cup");
    }
    for (const u of ["tbsp", "Tbsp", "Tbs", "TBS", "tablespoons"]) {
      expect(unitKey(u)).toBe("tablespoon");
    }
    for (const u of ["lb", "lbs", "lbs.", "pounds"]) {
      expect(unitKey(u)).toBe("pound");
    }
  });

  it("treats no unit as its own thing", () => {
    expect(unitKey(null)).toBe("");
    expect(unitKey("")).toBe("");
  });
});

describe("aisles — the order of the rules is the logic", () => {
  it("sends a powder to the spices except the two that are baking", () => {
    expect(aisleFor("garlic powder")).toBe("Spices");
    expect(aisleFor("onion powder")).toBe("Spices");
    expect(aisleFor("baking powder")).toBe("Baking");
    expect(aisleFor("baking soda")).toBe("Baking");
  });

  it("does not call peanut butter a dairy product", () => {
    expect(aisleFor("peanut butter")).toBe("Pantry");
    expect(aisleFor("butter")).toBe("Dairy & eggs");
    expect(aisleFor("unsalted butter")).toBe("Dairy & eggs");
  });

  it("keeps canned soup out of the dairy aisle", () => {
    expect(aisleFor("cream of mushroom soup")).toBe("Pantry");
    expect(aisleFor("cream of chicken soup")).toBe("Pantry");
    expect(aisleFor("heavy cream")).toBe("Dairy & eggs");
  });

  it("treats a herb as dried unless the line says fresh", () => {
    // "0.5 t Thyme, dry" is how this collection writes it.
    expect(aisleFor("thyme")).toBe("Spices");
    expect(aisleFor("basil")).toBe("Spices");
    expect(aisleFor("fresh basil")).toBe("Produce");
    expect(aisleFor("fresh parsley")).toBe("Produce");
  });

  it("puts a fresh chile in produce despite the word pepper", () => {
    expect(aisleFor("jalapenos (pickled)")).toBe("Produce");
    expect(aisleFor("serrano chillies")).toBe("Produce");
    expect(aisleFor("sweet peppers")).toBe("Produce");
    expect(aisleFor("black pepper")).toBe("Spices");
    expect(aisleFor("red pepper flakes")).toBe("Spices");
  });

  it("files plurals that a trailing word boundary used to miss", () => {
    // These fell through to Everything else until the sweep caught them.
    expect(aisleFor("blueberries")).toBe("Produce");
    expect(aisleFor("frozen strawberries")).toBe("Produce");
    expect(aisleFor("avocados")).toBe("Produce");
    expect(aisleFor("chopped green chilies")).toBe("Produce");
  });

  it("knows corn tortillas are not produce", () => {
    expect(aisleFor("corn tortillas")).toBe("Pantry");
    expect(aisleFor("ears of corn")).toBe("Produce");
    expect(aisleFor("cornmeal")).toBe("Baking");
  });

  it("puts canned tomatoes in the pantry and fresh ones in produce", () => {
    expect(aisleFor("stewed tomatoes")).toBe("Pantry");
    expect(aisleFor("diced tomatoes")).toBe("Pantry");
    expect(aisleFor("ripe tomatoes")).toBe("Produce");
  });

  it("files the things this collection actually asks for", () => {
    expect(aisleFor("boneless, skinless chicken breasts")).toBe("Meat & seafood");
    expect(aisleFor("Worcestershire sauce")).toBe("Pantry");
    expect(aisleFor("Triple Sec")).toBe("Drinks");
    expect(aisleFor("semi-sweet chocolate chips")).toBe("Baking");
    expect(aisleFor("kosher salt")).toBe("Spices");
  });

  it("admits when it does not know", () => {
    // A wrong aisle is worse than an honest one. These are real lines.
    expect(aisleFor("hickory wood pellets")).toBe("Everything else");
    expect(aisleFor("Cool Whip")).toBe("Everything else");
  });

  it("orders the groups the way you walk a shop", () => {
    const groups = buildShoppingList([
      recipe("A", [
        ing("1 cup sugar", "sugar", 1, "cup"),
        ing("1 onion", "onion", 1, null),
        ing("1 lb shrimp", "shrimp", 1, "lb"),
      ]),
    ]);
    expect(groups.map((g) => g.aisle)).toEqual([
      "Produce",
      "Meat & seafood",
      "Baking",
    ]);
  });
});

describe("tap water", () => {
  it("is left off the list, however it is written", () => {
    for (const w of [
      "water",
      "Water",
      "cold water",
      "hot water",
      "boiling water",
      "ice cold water",
    ]) {
      expect(isTapWater(w)).toBe(true);
    }
    const groups = buildShoppingList([
      recipe("A", [
        ing("6 cups water", "water", 6, "cups"),
        ing("2 cups flour", "flour", 2, "cups"),
      ]),
    ]);
    expect(countLines(groups)).toBe(1);
  });

  it("does not drop things that merely contain the word", () => {
    expect(isTapWater("seltzer water")).toBe(false);
    expect(isTapWater("coconut water")).toBe(false);
    expect(isTapWater("carbonated water")).toBe(false);
  });
});

describe("the whole thing", () => {
  it("records which recipes wanted each item", () => {
    const groups = buildShoppingList([
      recipe("Jambalaya", [ing("1 t salt", "salt", 1, "t")]),
      recipe("Tortilla Soup", [ing("1 t salt", "salt", 1, "t")]),
    ]);
    expect(groups[0].lines[0].from).toEqual(["Jambalaya", "Tortilla Soup"]);
    expect(groups[0].lines[0].amounts).toEqual(["2 teaspoons"]);
  });

  it("copes with nothing selected and with empty recipes", () => {
    expect(buildShoppingList([])).toEqual([]);
    expect(buildShoppingList([recipe("A", [])])).toEqual([]);
    expect(countLines([])).toBe(0);
  });

  it("ignores a blank item rather than making a blank row", () => {
    const groups = buildShoppingList([
      recipe("A", [ing(",", "", null, null), ing("1 onion", "onion", 1, null)]),
    ]);
    expect(countLines(groups)).toBe(1);
  });
});
