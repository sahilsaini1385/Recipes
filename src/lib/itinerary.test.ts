import { describe, it, expect } from "vitest";
import {
  buildItinerary,
  formatDayHeading,
  daySpan,
  nextDay,
  MAX_LAID_OUT_DAYS,
  type DayEntry,
} from "./itinerary";

let seq = 0;
function entry(day: string, over: Partial<DayEntry> = {}): DayEntry {
  return {
    id: `e${++seq}`,
    day,
    at: null,
    title: "Something",
    note: null,
    place_id: null,
    position: 0,
    ...over,
  };
}

describe("nextDay", () => {
  it("crosses months and years without a timezone shifting it", () => {
    expect(nextDay("2026-03-28")).toBe("2026-03-29");
    expect(nextDay("2026-01-31")).toBe("2026-02-01");
    expect(nextDay("2024-12-31")).toBe("2025-01-01");
  });

  it("handles a leap day", () => {
    expect(nextDay("2028-02-28")).toBe("2028-02-29");
    expect(nextDay("2028-02-29")).toBe("2028-03-01");
  });
});

describe("daySpan", () => {
  it("counts both ends", () => {
    expect(daySpan("2025-04-11", "2025-04-14")).toBe(4);
    expect(daySpan("2025-04-11", "2025-04-11")).toBe(1);
  });

  it("is null when either end is unknown or the order is wrong", () => {
    expect(daySpan(null, "2025-04-14")).toBeNull();
    expect(daySpan("2025-04-11", null)).toBeNull();
    expect(daySpan("2025-04-14", "2025-04-11")).toBeNull();
  });
});

describe("buildItinerary", () => {
  it("lays out every day a dated trip covers, so a plan can be filled in", () => {
    const days = buildItinerary([], "2025-04-11", "2025-04-14");
    expect(days.map((d) => d.day)).toEqual([
      "2025-04-11",
      "2025-04-12",
      "2025-04-13",
      "2025-04-14",
    ]);
    expect(days.every((d) => d.empty)).toBe(true);
    expect(days.map((d) => d.index)).toEqual([1, 2, 3, 4]);
  });

  it("places entries on their day and marks it non-empty", () => {
    const days = buildItinerary(
      [entry("2025-04-12", { title: "Deer feeding" })],
      "2025-04-11",
      "2025-04-14"
    );
    expect(days[1].entries.map((e) => e.title)).toEqual(["Deer feeding"]);
    expect(days[1].empty).toBe(false);
    expect(days[0].empty).toBe(true);
  });

  it("never hides an entry dated outside the trip's range", () => {
    // Dates get edited after entries are written. Losing somebody's note
    // because the trip was shortened is the one unacceptable outcome.
    const days = buildItinerary(
      [entry("2025-05-01", { title: "Stayed on an extra week" })],
      "2025-04-11",
      "2025-04-14"
    );
    expect(days.map((d) => d.day)).toContain("2025-05-01");
    expect(days[days.length - 1].entries[0].title).toBe(
      "Stayed on an extra week"
    );
  });

  it("orders entries within a day by position, then stably", () => {
    const days = buildItinerary(
      [
        entry("2025-04-11", { title: "Dinner", position: 2 }),
        entry("2025-04-11", { title: "Breakfast", position: 0 }),
        entry("2025-04-11", { title: "Lunch", position: 1 }),
      ],
      "2025-04-11",
      "2025-04-11"
    );
    expect(days[0].entries.map((e) => e.title)).toEqual([
      "Breakfast",
      "Lunch",
      "Dinner",
    ]);
  });

  it("shows only written-on days for an undated trip", () => {
    const days = buildItinerary(
      [entry("2019-08-02"), entry("2019-07-30")],
      null,
      null
    );
    expect(days.map((d) => d.day)).toEqual(["2019-07-30", "2019-08-02"]);
    expect(days.every((d) => d.index === null)).toBe(true);
  });

  it("offers a first day for a trip with a start but no end", () => {
    const days = buildItinerary([], "2027-03-28", null);
    expect(days.map((d) => d.day)).toEqual(["2027-03-28"]);
  });

  it("refuses to lay out a year of empty days", () => {
    const long = buildItinerary([entry("2025-06-01")], "2025-01-01", "2025-12-31");
    // Only the day that has something on it.
    expect(long).toHaveLength(1);
    expect(long[0].day).toBe("2025-06-01");
    // The boundary itself still lays out in full.
    const atLimit = buildItinerary([], "2025-01-01", "2025-03-01");
    expect(atLimit.length).toBeLessThanOrEqual(MAX_LAID_OUT_DAYS);
  });

  it("does not number a day that falls before the trip starts", () => {
    const days = buildItinerary(
      [entry("2025-04-09", { title: "Flew out early" })],
      "2025-04-11",
      "2025-04-12"
    );
    expect(days[0].day).toBe("2025-04-09");
    expect(days[0].index).toBeNull();
    expect(days[1].index).toBe(1);
  });

  it("drops empty days when remembering rather than planning", () => {
    // A fortnight with three days written up should read as three entries,
    // not three entries and eleven lines saying nothing happened.
    const written = [entry("2024-12-22"), entry("2024-12-24")];
    const planning = buildItinerary(written, "2024-12-21", "2025-01-02", true);
    const remembering = buildItinerary(written, "2024-12-21", "2025-01-02", false);
    expect(planning.length).toBe(13);
    expect(remembering.map((d) => d.day)).toEqual(["2024-12-22", "2024-12-24"]);
    // Day numbering still counts from the trip's real start.
    expect(remembering[0].index).toBe(2);
    expect(remembering[1].index).toBe(4);
  });

  it("still shows an out-of-range entry when empty days are dropped", () => {
    const days = buildItinerary(
      [entry("2025-05-01", { title: "Stayed on" })],
      "2025-04-11",
      "2025-04-14",
      false
    );
    expect(days.map((d) => d.day)).toEqual(["2025-05-01"]);
  });

  it("ignores an entry whose date cannot be read, rather than crashing", () => {
    const days = buildItinerary(
      [entry("not-a-date"), entry("2025-04-11")],
      null,
      null
    );
    expect(days.map((d) => d.day)).toEqual(["2025-04-11"]);
  });
});

describe("formatDayHeading", () => {
  it("leads with the weekday, which is half the question when planning", () => {
    expect(formatDayHeading("2025-04-11", "2025-04-11")).toBe("Fri 11 April");
  });

  it("adds the year only when it differs from the trip's start", () => {
    expect(formatDayHeading("2024-12-31", "2024-12-21")).toBe("Tue 31 December");
    expect(formatDayHeading("2025-01-02", "2024-12-21")).toBe(
      "Thu 2 January 2025"
    );
  });

  it("shows the year when there is no trip start to compare against", () => {
    expect(formatDayHeading("2025-04-11")).toBe("Fri 11 April 2025");
  });

  it("gives back what it was handed if it cannot read the date", () => {
    expect(formatDayHeading("nonsense")).toBe("nonsense");
  });
});
