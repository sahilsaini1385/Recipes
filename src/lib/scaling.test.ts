import { describe, it, expect } from "vitest";
import { formatQuantity, scaleIngredient, isScalable } from "./scaling";
import { parseIngredientLine } from "./parseIngredient";

describe("formatQuantity", () => {
  it("keeps whole numbers whole", () => {
    expect(formatQuantity(2).text).toBe("2");
    expect(formatQuantity(12).text).toBe("12");
  });
  it("converts decimals to common fractions", () => {
    expect(formatQuantity(0.75).text).toBe("¾");
    expect(formatQuantity(0.5).text).toBe("½");
    expect(formatQuantity(1 / 3).text).toBe("⅓");
    expect(formatQuantity(0.33).text).toBe("⅓");
    expect(formatQuantity(0.125).text).toBe("⅛");
    expect(formatQuantity(1.5).text).toBe("1½");
    expect(formatQuantity(2 / 3).text).toBe("⅔");
  });
  it("never displays zero for a positive amount", () => {
    expect(formatQuantity(0.05).text).toBe("⅛");
  });
});

describe("parseIngredientLine", () => {
  it("parses simple quantities and units", () => {
    const ing = parseIngredientLine("1/2 c. heavy cream");
    expect(ing.quantity).toBe(0.5);
    expect(ing.unit).toBe("c");
    expect(ing.item).toBe("heavy cream");
    expect(ing.scalable).toBe(true);
  });
  it("parses number words", () => {
    const ing = parseIngredientLine("One pound ground beef");
    expect(ing.quantity).toBe(1);
    expect(ing.unit).toBe("pound");
    expect(ing.item).toBe("ground beef");
  });
  it("parses ranges", () => {
    const ing = parseIngredientLine("2 to 3 cloves garlic");
    expect(ing.quantity).toBe(2);
    expect(ing.quantity_max).toBe(3);
    expect(ing.unit).toBe("cloves");
  });
  it("leaves unparseable lines intact", () => {
    const ing = parseIngredientLine("Large can chili beans in sauce");
    expect(ing.quantity).toBeNull();
    expect(ing.scalable).toBe(false);
    expect(ing.raw).toBe("Large can chili beans in sauce");
  });
  it("extracts to-taste qualifiers", () => {
    const ing = parseIngredientLine("Salt and pepper, to taste");
    expect(ing.note).toBe("to taste");
    expect(ing.scalable).toBe(false);
  });
});

describe("scaleIngredient", () => {
  it("scales numeric quantities and formats as fractions", () => {
    const ing = parseIngredientLine("1/2 c. heavy cream");
    const line = scaleIngredient(ing, 1.5); // 6 servings from 4
    expect(line.quantityText).toBe("¾");
    expect(line.scaled).toBe(true);
  });
  it("scales both ends of a range", () => {
    const ing = parseIngredientLine("2 to 3 cloves garlic");
    const line = scaleIngredient(ing, 2);
    expect(line.quantityText).toBe("4–6");
  });
  it("never scales 'to taste' lines", () => {
    const ing = parseIngredientLine("Salt and pepper, to taste");
    const line = scaleIngredient(ing, 3);
    expect(line.quantityText).toBeNull();
    expect(line.showHint).toBe(true);
  });
  it("never scales can/stick/package units", () => {
    const stick = parseIngredientLine("1/2 stick salted butter");
    expect(isScalable(stick)).toBe(false);
    const line = scaleIngredient(stick, 2);
    expect(line.quantityText).toBeNull();
    expect(line.showHint).toBe(true);

    const can = parseIngredientLine("1 can cream of mushroom soup");
    expect(scaleIngredient(can, 1.33).quantityText).toBeNull();
  });
  it("rounds countable items to the nearest half and flags approx", () => {
    const eggs = parseIngredientLine("2 eggs");
    const line = scaleIngredient(eggs, 2 / 3); // 1.333 eggs
    expect(line.quantityText).toBe("1½");
    expect(line.approx).toBe(true);
  });
  it("never displays values like 1.333", () => {
    const eggs = parseIngredientLine("1 egg");
    for (const f of [1.333, 0.75, 2.2, 1 / 3]) {
      const line = scaleIngredient(eggs, f);
      expect(line.quantityText).not.toMatch(/\d\.\d/);
    }
  });
  it("shows no hint at the original serving count", () => {
    const can = parseIngredientLine("1 can cream of mushroom soup");
    expect(scaleIngredient(can, 1).showHint).toBe(false);
  });
});
