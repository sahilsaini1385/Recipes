import { describe, it, expect } from "vitest";
import {
  toMetric,
  formatMetric,
  isConvertibleUnit,
  convertTemperatures,
} from "./units";
import { scaleIngredient } from "./scaling";
import { parseIngredientLine } from "./parseIngredient";

describe("toMetric", () => {
  it("converts common volumes", () => {
    expect(toMetric(1, "cup")).toEqual({ value: 240, unit: "ml" });
    expect(toMetric(0.5, "c.")).toEqual({ value: 120, unit: "ml" });
    expect(toMetric(1, "tbsp")).toEqual({ value: 15, unit: "ml" });
    expect(toMetric(1, "tsp")).toEqual({ value: 5, unit: "ml" });
  });
  it("converts weights and steps up to kg", () => {
    expect(toMetric(1, "pound")).toEqual({ value: 450, unit: "g" });
    expect(toMetric(4, "oz")).toEqual({ value: 115, unit: "g" });
    expect(toMetric(5, "lbs")).toEqual({ value: 2.3, unit: "kg" });
  });
  it("steps large volumes up to liters", () => {
    expect(toMetric(2, "quarts")).toEqual({ value: 1.9, unit: "l" });
  });
  it("returns null for non-convertible units", () => {
    expect(toMetric(1, "can")).toBeNull();
    expect(toMetric(1, "stick")).toBeNull();
    expect(isConvertibleUnit("cloves")).toBe(false);
    expect(isConvertibleUnit("cup")).toBe(true);
  });
});

describe("formatMetric with scaled amounts", () => {
  it("composes with the serving scaler", () => {
    const ing = parseIngredientLine("1/2 c. heavy cream");
    const line = scaleIngredient(ing, 2); // 1 cup
    expect(
      formatMetric(line.scaledLow!, line.scaledHigh, ing.unit!)
    ).toBe("240 ml");
  });
  it("converts both ends of a range", () => {
    const ing = parseIngredientLine("1 to 2 pounds ground beef");
    const line = scaleIngredient(ing, 1);
    expect(
      formatMetric(line.scaledLow!, line.scaledHigh, ing.unit!)
    ).toBe("450–910 g");
  });
  it("keeps both ends when a range crosses into liters or kilos", () => {
    expect(formatMetric(2, 5, "cups")).toBe("0.5–1.2 l");
    expect(formatMetric(1, 3, "pounds")).toBe("0.5–1.4 kg");
  });
});

describe("convertTemperatures", () => {
  it("converts explicit Fahrenheit", () => {
    expect(convertTemperatures("Bake at 350°F for 20 minutes")).toBe(
      "Bake at 175°C for 20 minutes"
    );
    expect(convertTemperatures("heat oven to 425 degrees F")).toBe(
      "heat oven to 220°C"
    );
  });
  it("converts bare oven temperatures in plausible range", () => {
    expect(convertTemperatures("Bake at 350 degrees until golden")).toBe(
      "Bake at 175°C until golden"
    );
  });
  it("converts both ends of Fahrenheit ranges", () => {
    expect(convertTemperatures("Bake at 350–375°F")).toBe("Bake at 175–190°C");
    expect(convertTemperatures("roast at 350 to 375 degrees F")).toBe(
      "roast at 175–190°C"
    );
  });
  it("leaves non-oven numbers alone", () => {
    expect(convertTemperatures("simmer for 20 minutes")).toBe(
      "simmer for 20 minutes"
    );
    expect(convertTemperatures("about 90 degrees is fine")).toBe(
      "about 90 degrees is fine"
    );
    expect(convertTemperatures("Bake at 175°C")).toBe("Bake at 175°C");
  });
});
