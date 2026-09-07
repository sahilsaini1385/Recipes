import { describe, it, expect } from "vitest";
import { pluralizeItem } from "./plural";

/**
 * Every string below is a real ingredient name from the family collection,
 * pulled from the recipes table. The "leaves alone" cases matter more than
 * the rest: they are the ones a generic English pluraliser gets wrong.
 */
describe("pluralizeItem", () => {
  it("pluralises countable things when the recipe scales up", () => {
    expect(pluralizeItem("lemon", 3)).toBe("lemons");
    expect(pluralizeItem("egg", 4)).toBe("eggs");
    expect(pluralizeItem("onion", 2)).toBe("onions");
    expect(pluralizeItem("apple", 6)).toBe("apples");
  });

  it("inflects the last word of a described ingredient", () => {
    expect(pluralizeItem("large egg", 4)).toBe("large eggs");
    expect(pluralizeItem("red onion", 2)).toBe("red onions");
    expect(pluralizeItem("green bell pepper", 3)).toBe("green bell peppers");
    expect(pluralizeItem("whole chicken", 2)).toBe("whole chickens");
    expect(pluralizeItem("egg white", 3)).toBe("egg whites");
  });

  it("handles irregular plurals", () => {
    expect(pluralizeItem("bay leaf", 2)).toBe("bay leaves");
    expect(pluralizeItem("fresh basil leaf", 4)).toBe("fresh basil leaves");
    expect(pluralizeItem("ripe tomato", 3)).toBe("ripe tomatoes");
    expect(pluralizeItem("baking potato", 5)).toBe("baking potatoes");
  });

  it("inflects the name and keeps a trailing preparation note", () => {
    expect(pluralizeItem("medium onion, finely chopped", 3)).toBe(
      "medium onions, finely chopped"
    );
    expect(pluralizeItem("small onion, grated", 2)).toBe(
      "small onions, grated"
    );
    expect(pluralizeItem("turnip", 4)).toBe("turnips");
    expect(pluralizeItem("pineapple", 2)).toBe("pineapples");
  });

  it("counts the thing before 'of', not the thing after", () => {
    expect(pluralizeItem("green stalk of green onion", 2)).toBe(
      "green stalks of green onion"
    );
    expect(pluralizeItem("clove of garlic", 4)).toBe("cloves of garlic");
  });

  it("leaves an already-plural name alone", () => {
    for (const item of [
      "eggs",
      "large eggs",
      "onions",
      "carrots",
      "bay leaves",
      "chicken breasts",
      "plum tomatoes",
      "corn tortillas",
      "garlic cloves",
      "egg yolks",
    ]) {
      expect(pluralizeItem(item, 4)).toBe(item);
    }
  });

  it("never invents a plural for a mass noun", () => {
    // These are the ones that make a rules-based pluraliser unusable here.
    for (const item of [
      "garlic",
      "flour",
      "lime juice",
      "blue food gel",
      "kraft cheez links garlic flavor",
      "hormel teriyaki-flavored pork tenderloin",
    ]) {
      expect(pluralizeItem(item, 8)).toBe(item);
    }
  });

  it("refuses to touch a phrase listing alternatives", () => {
    for (const item of [
      "cauliflower head or 3 large zucchinis or 2-3 stalks of broccoli",
      "ham bone, hock, or leftover ham pieces",
      "hen or chicken breasts",
      "celery stalks with leaves",
      "eggs, beaten",
      "corn tortillas, cut into med-sized triangles",
    ]) {
      expect(pluralizeItem(item, 4)).toBe(item);
    }
  });

  it("leaves everything alone at one serving or less", () => {
    expect(pluralizeItem("lemon", 1)).toBe("lemon");
    expect(pluralizeItem("lemon", 0.5)).toBe("lemon");
    expect(pluralizeItem("egg", 1)).toBe("egg");
  });

  it("survives odd input", () => {
    expect(pluralizeItem("", 4)).toBe("");
    expect(pluralizeItem("   ", 4)).toBe("   ");
    expect(pluralizeItem("lemon", Number.NaN)).toBe("lemon");
    expect(pluralizeItem("jalapeño", 3)).toBe("jalapeños");
  });
});
