import { describe, it, expect } from "vitest";
import { formatCostPerServing } from "./cost";
import { flagEmoji, countryName } from "./countries";

describe("formatCostPerServing", () => {
  it("shows cents under ten dollars", () => {
    expect(formatCostPerServing(1.5)).toBe("~$1.50/serving");
    expect(formatCostPerServing(0.45)).toBe("~$0.45/serving");
  });

  it("drops the cents once it rounds to a whole ten or more", () => {
    expect(formatCostPerServing(12.4)).toBe("~$12/serving");
    // Just under ten still reads as 9.99, not "$10.00".
    expect(formatCostPerServing(9.99)).toBe("~$9.99/serving");
    expect(formatCostPerServing(9.996)).toBe("~$10/serving");
  });

  it("hides an estimate that would round to nothing", () => {
    expect(formatCostPerServing(null)).toBeNull();
    expect(formatCostPerServing(0)).toBeNull();
    expect(formatCostPerServing(0.001)).toBeNull();
    expect(formatCostPerServing(Number.NaN)).toBeNull();
    expect(formatCostPerServing(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("flagEmoji", () => {
  it("builds regional-indicator flags for ordinary countries", () => {
    expect(flagEmoji("FR")).toBe("🇫🇷");
    expect(flagEmoji("us")).toBe("🇺🇸");
  });

  it("uses real tag-sequence flags for the UK's countries", () => {
    expect(flagEmoji("GB-SCT")).toBe("\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}");
    expect(flagEmoji("GB-WLS")).not.toBe(flagEmoji("GB-ENG"));
  });

  it("avoids codes that would render as raw letters", () => {
    expect(flagEmoji("XK")).toBe("🏳️");
    expect(flagEmoji("")).toBe("🏳️");
    expect(flagEmoji("nonsense")).toBe("🏳️");
  });
});

describe("countryName", () => {
  it("names the UK's constituent countries", () => {
    expect(countryName("GB-ENG")).toBe("England");
    expect(countryName("GB")).toBe("United Kingdom");
  });

  it("falls back to the code it was given", () => {
    expect(countryName("ZZ")).toBe("ZZ");
  });
});
