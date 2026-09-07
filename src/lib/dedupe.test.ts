import { describe, it, expect } from "vitest";
import { normalizeTitle, completeness } from "./dedupe";
import type { RecipeDraft } from "./types";

describe("dedupe", () => {
  it("normalizes Copy of / (1) / extension variants to one title", () => {
    expect(normalizeTitle("Copy of Chili (1).docx")).toBe("chili");
    expect(normalizeTitle("Chili.doc")).toBe("chili");
    expect(normalizeTitle("CHILI")).toBe("chili");
  });
});

describe("completeness", () => {
  const base: RecipeDraft = {
    title: "x",
    category: "Entrees",
    credit: "",
    source_url: null,
    base_servings: 4,
    servings_estimated: true,
    ingredients: [],
    steps: [],
    tags: [],
    notes: null,
    photo_path: null,
  };
  it("scores a fuller draft higher", () => {
    const sparse = { ...base, steps: ["do it"] };
    const full = { ...base, steps: ["do it"], notes: "n", credit: "c" };
    expect(completeness(full)).toBeGreaterThan(completeness(sparse));
  });
});
