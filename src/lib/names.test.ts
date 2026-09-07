import { describe, it, expect } from "vitest";
import { firstName, initials } from "./names";

describe("initials", () => {
  it("uses first name + surname, not the first two words", () => {
    expect(initials("Jack Bahal Saini")).toBe("JS");
    expect(initials("Nina Florence Saini")).toBe("NS");
    expect(initials("John Jungman")).toBe("JJ");
  });

  it("skips quoted nicknames", () => {
    expect(initials('Rajinder "Tony" Saini')).toBe("RS");
    expect(initials('Robert "Bob" Jungman')).toBe("RJ");
  });

  it("skips generational suffixes", () => {
    expect(initials("William Harvey Skipwith Sr")).toBe("WS");
    expect(initials("William Harvey Skipwith Jr")).toBe("WS");
    expect(initials("John Jungman III")).toBe("JJ");
  });

  it("handles single names and accents", () => {
    expect(initials("Ash")).toBe("A");
    expect(initials("Frédérique Jungman")).toBe("FJ");
  });

  it("survives empty or punctuation-only input", () => {
    expect(initials("")).toBe("");
    expect(initials("   ")).toBe("");
  });
});

describe("firstName", () => {
  it("strips surrounding quotes and parentheses", () => {
    expect(firstName('"Skippy" Jungman')).toBe("Skippy");
    expect(firstName("Robert Jungman")).toBe("Robert");
  });

  it("falls back to the trimmed original when nothing is usable", () => {
    expect(firstName("  ")).toBe("");
  });
});
