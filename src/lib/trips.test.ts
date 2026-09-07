import { describe, it, expect } from "vitest";
import {
  parseTripDate,
  formatTripDates,
  tripNights,
  byNewest,
  isUpcoming,
} from "./trips";
import type { Trip } from "@/hooks/useTrips";

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: "t1",
  title: "A trip",
  start_date: null,
  end_date: null,
  blurb: null,
  deleted_at: null,
  created_at: "2024-01-01T00:00:00Z",
  travellers: [],
  destinations: [],
  ...over,
});

describe("parseTripDate", () => {
  it("reads a plain date column as the day it says", () => {
    // The Date constructor would call this UTC midnight and render it as the
    // 11th anywhere west of Greenwich. That bug is the reason this exists.
    expect(parseTripDate("2024-06-12")).toEqual({ y: 2024, m: 6, d: 12 });
  });

  it("rejects anything that isn't a date", () => {
    expect(parseTripDate(null)).toBeNull();
    expect(parseTripDate("")).toBeNull();
    expect(parseTripDate("June 2024")).toBeNull();
    expect(parseTripDate("2024-13-01")).toBeNull();
    expect(parseTripDate("2024-06-00")).toBeNull();
  });
});

describe("formatTripDates", () => {
  it("collapses a range inside one month", () => {
    expect(formatTripDates("2024-06-12", "2024-06-19")).toBe("12–19 June 2024");
  });

  it("keeps both months when the trip crosses one", () => {
    expect(formatTripDates("2024-06-28", "2024-07-03")).toBe(
      "28 June – 3 July 2024"
    );
  });

  it("abbreviates across a new year so the line still fits a phone", () => {
    expect(formatTripDates("2024-12-28", "2025-01-03")).toBe(
      "28 Dec 2024 – 3 Jan 2025"
    );
  });

  it("collapses a single day", () => {
    expect(formatTripDates("2024-06-12", "2024-06-12")).toBe("12 June 2024");
  });

  it("copes with only one end known", () => {
    expect(formatTripDates("2024-06-12", null)).toBe("From 12 June 2024");
    expect(formatTripDates(null, "2024-06-19")).toBe("Until 19 June 2024");
  });

  it("returns null when it knows nothing", () => {
    expect(formatTripDates(null, null)).toBeNull();
    expect(formatTripDates("", "")).toBeNull();
  });
});

describe("tripNights", () => {
  it("counts nights, not days", () => {
    expect(tripNights("2024-06-12", "2024-06-19")).toBe(7);
    expect(tripNights("2024-06-12", "2024-06-12")).toBe(0);
  });

  it("spans a month and a leap day without drifting", () => {
    expect(tripNights("2024-02-27", "2024-03-01")).toBe(3);
  });

  it("needs both ends", () => {
    expect(tripNights("2024-06-12", null)).toBeNull();
    expect(tripNights(null, null)).toBeNull();
  });
});

describe("byNewest", () => {
  it("puts the most recent trip first", () => {
    const older = trip({ id: "a", start_date: "2023-05-01" });
    const newer = trip({ id: "b", start_date: "2024-05-01" });
    expect([older, newer].sort(byNewest).map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("sinks undated trips below dated ones", () => {
    const dated = trip({ id: "a", start_date: "2010-01-01" });
    const undated = trip({ id: "b", start_date: null });
    expect([undated, dated].sort(byNewest).map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("breaks ties on creation so the order never wobbles", () => {
    const first = trip({ id: "a", created_at: "2024-01-01T00:00:00Z" });
    const second = trip({ id: "b", created_at: "2024-02-01T00:00:00Z" });
    expect([first, second].sort(byNewest).map((t) => t.id)).toEqual(["b", "a"]);
  });
});

describe("isUpcoming", () => {
  const today = new Date(2026, 8, 7); // 7 September 2026, local

  it("counts a trip that has not finished", () => {
    expect(isUpcoming(trip({ start_date: "2026-12-01" }), today)).toBe(true);
    expect(
      isUpcoming(trip({ start_date: "2026-09-01", end_date: "2026-09-30" }), today)
    ).toBe(true);
  });

  it("does not count one already over", () => {
    expect(
      isUpcoming(trip({ start_date: "2024-06-01", end_date: "2024-06-10" }), today)
    ).toBe(false);
  });

  it("does not count today as upcoming", () => {
    expect(isUpcoming(trip({ start_date: "2026-09-07" }), today)).toBe(false);
  });

  it("an undated trip is never upcoming", () => {
    expect(isUpcoming(trip(), today)).toBe(false);
  });
});
