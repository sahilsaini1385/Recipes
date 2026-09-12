import { describe, it, expect } from "vitest";
import {
  byMostRecent,
  cookSuggestions,
  dominantCook,
  formatCookDate,
  parseISODate,
  summarise,
  todayISO,
  type RecipeCook,
} from "./cooks";

let n = 0;
const cook = (
  cooked_on: string,
  cooked_by: string | null = null,
  note: string | null = null
): RecipeCook => ({
  id: `c${++n}`,
  recipe_id: "r1",
  cooked_on,
  cooked_by,
  note,
});

describe("dates", () => {
  it("reads an ISO date as a local one", () => {
    // new Date("2026-09-12") is UTC midnight, which renders as the 11th
    // anywhere in the Americas. The passport sync hit this once already.
    const d = parseISODate("2026-09-12")!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(12);
  });

  it("gives today in local time, not UTC", () => {
    // 8pm in California on the 12th is the 13th in UTC. The entry belongs to
    // the evening the cook was standing in.
    const evening = new Date(2026, 8, 12, 20, 30);
    expect(todayISO(evening)).toBe("2026-09-12");
  });

  it("pads single-digit months and days", () => {
    expect(todayISO(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("drops the year for dates in the current year and keeps it otherwise", () => {
    const now = new Date(2026, 8, 12);
    expect(formatCookDate("2026-09-12", now)).toBe("12 September");
    expect(formatCookDate("2024-12-25", now)).toBe("25 December 2024");
  });

  it("hands back anything it cannot parse rather than showing NaN", () => {
    expect(formatCookDate("not a date")).toBe("not a date");
    expect(parseISODate("2026-13-45")).toBeNull();
    expect(parseISODate("")).toBeNull();
  });

  it("sorts newest first, stably", () => {
    const rows = [
      cook("2026-01-01"),
      cook("2026-09-12"),
      cook("2025-06-30"),
    ];
    expect([...rows].sort(byMostRecent).map((c) => c.cooked_on)).toEqual([
      "2026-09-12",
      "2026-01-01",
      "2025-06-30",
    ]);
  });
});

describe("dominantCook", () => {
  it("says nothing until there are enough entries to mean anything", () => {
    expect(dominantCook([])).toBeNull();
    expect(dominantCook([cook("2026-01-01", "Nancy")])).toBeNull();
    expect(
      dominantCook([cook("2026-01-01", "Nancy"), cook("2026-02-01", "Nancy")])
    ).toBeNull();
  });

  it("names the person who clearly makes it", () => {
    expect(
      dominantCook([
        cook("2026-01-01", "Nancy"),
        cook("2026-02-01", "Nancy"),
        cook("2026-03-01", "John"),
      ])
    ).toBe("Nancy");
  });

  it("stays quiet when nobody has a majority", () => {
    expect(
      dominantCook([
        cook("2026-01-01", "Nancy"),
        cook("2026-02-01", "John"),
        cook("2026-03-01", "Will"),
      ])
    ).toBeNull();
    // An exact half is not a majority.
    expect(
      dominantCook([
        cook("2026-01-01", "Nancy"),
        cook("2026-02-01", "Nancy"),
        cook("2026-03-01", "John"),
        cook("2026-04-01", "Will"),
      ])
    ).toBeNull();
  });

  it("treats one person's name as one person however it is capitalised", () => {
    expect(
      dominantCook([
        cook("2026-01-01", "Nancy"),
        cook("2026-02-01", "nancy"),
        cook("2026-03-01", "John"),
      ])
    ).toBe("Nancy");
  });

  it("ignores entries where nobody said who cooked", () => {
    expect(
      dominantCook([cook("2026-01-01"), cook("2026-02-01"), cook("2026-03-01")])
    ).toBeNull();
  });
});

describe("summarise", () => {
  const now = new Date(2026, 8, 12);

  it("says nothing about an empty log", () => {
    expect(summarise([], now)).toBe("");
  });

  it("counts one properly", () => {
    expect(summarise([cook("2026-09-01", "Nancy")], now)).toBe(
      "Cooked once · last on 1 September"
    );
  });

  it("does not guess a regular cook from two entries", () => {
    expect(
      summarise([cook("2026-09-01", "Nancy"), cook("2026-08-01", "Nancy")], now)
    ).toBe("Cooked 2 times · last on 1 September");
  });

  it("names the regular cook once the log supports it", () => {
    expect(
      summarise(
        [
          cook("2026-09-10", "Nancy"),
          cook("2026-08-01", "Nancy"),
          cook("2025-12-25", "John"),
        ],
        now
      )
    ).toBe("Cooked 3 times · usually Nancy · last on 10 September");
  });

  it("reports the most recent date even when the rows arrive jumbled", () => {
    expect(
      summarise([cook("2026-01-05"), cook("2026-09-11"), cook("2026-04-02")], now)
    ).toBe("Cooked 3 times · last on 11 September");
  });
});

describe("cookSuggestions", () => {
  it("offers the people who actually cook, commonest first", () => {
    expect(
      cookSuggestions([
        cook("2026-01-01", "John"),
        cook("2026-02-01", "Nancy"),
        cook("2026-03-01", "Nancy"),
      ])
    ).toEqual(["Nancy", "John"]);
  });

  it("counts one person once however they typed it, keeping their spelling", () => {
    expect(
      cookSuggestions([cook("2026-01-01", "Nancy"), cook("2026-02-01", "nancy")])
    ).toEqual(["Nancy"]);
  });

  it("skips blanks and caps the list", () => {
    expect(cookSuggestions([cook("2026-01-01"), cook("2026-02-01", "  ")])).toEqual(
      []
    );
    const many = ["a", "b", "c", "d", "e", "f", "g", "h"].map((x) =>
      cook("2026-01-01", x)
    );
    expect(cookSuggestions(many)).toHaveLength(6);
    expect(cookSuggestions(many, 2)).toHaveLength(2);
  });
});
