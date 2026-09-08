import { describe, it, expect } from "vitest";
import {
  matchesPlaceQuery,
  groupByKind,
  placeKindLabel,
  byRecommendation,
  PLACE_KINDS,
} from "./places";
import type { TripPlace } from "@/hooks/useTripPlaces";

function place(over: Partial<TripPlace> = {}): TripPlace {
  return {
    id: "p1",
    trip_id: "t1",
    name: "Cervejaria Ramiro",
    city: "Lisbon",
    country_code: "PT",
    kind: "restaurant",
    note: "Garlic prawns, go early",
    would_return: true,
    url: null,
    created_at: "2025-01-01T00:00:00Z",
    ...over,
  };
}

describe("matchesPlaceQuery", () => {
  it("finds a place by name, city, note or kind", () => {
    const p = place();
    for (const q of ["ramiro", "lisbon", "prawns", "restaurant"]) {
      expect(matchesPlaceQuery(p, q)).toBe(true);
    }
  });

  it("narrows as words are added rather than widening", () => {
    const p = place();
    expect(matchesPlaceQuery(p, "lisbon prawns")).toBe(true);
    expect(matchesPlaceQuery(p, "lisbon sushi")).toBe(false);
  });

  it("ignores word order", () => {
    const p = place();
    expect(matchesPlaceQuery(p, "prawns lisbon")).toBe(true);
    expect(matchesPlaceQuery(p, "lisbon prawns")).toBe(true);
  });

  it("folds accents so a café is found without the accent key", () => {
    const p = place({ name: "Café Nicola", city: "Lisboa", note: null });
    expect(matchesPlaceQuery(p, "cafe")).toBe(true);
    expect(matchesPlaceQuery(p, "café")).toBe(true);
    expect(matchesPlaceQuery(p, "nicola")).toBe(true);
  });

  it("searches the country and trip when they are supplied", () => {
    const p = { ...place(), countryLabel: "Portugal", tripTitle: "Christmas in Lisbon" };
    expect(matchesPlaceQuery(p, "portugal")).toBe(true);
    expect(matchesPlaceQuery(p, "christmas")).toBe(true);
  });

  it("matches everything on an empty or blank query", () => {
    const p = place();
    expect(matchesPlaceQuery(p, "")).toBe(true);
    expect(matchesPlaceQuery(p, "   ")).toBe(true);
  });

  it("copes with a place that has almost nothing filled in", () => {
    const bare = place({ city: null, note: null, would_return: null });
    expect(matchesPlaceQuery(bare, "ramiro")).toBe(true);
    expect(matchesPlaceQuery(bare, "lisbon")).toBe(false);
  });
});

describe("groupByKind", () => {
  it("groups in picker order and drops empty groups", () => {
    const groups = groupByKind([
      place({ id: "a", kind: "sight" }),
      place({ id: "b", kind: "restaurant" }),
      place({ id: "c", kind: "restaurant" }),
    ]);
    expect(groups.map((g) => g.kind)).toEqual(["restaurant", "sight"]);
    expect(groups[0].places).toHaveLength(2);
    expect(groups[0].label).toBe("Restaurants");
  });

  it("returns nothing for no places", () => {
    expect(groupByKind([])).toEqual([]);
  });
});

describe("placeKindLabel", () => {
  it("labels every kind the database allows", () => {
    for (const k of PLACE_KINDS) {
      expect(placeKindLabel(k)).toBeTruthy();
      expect(placeKindLabel(k, true)).toBeTruthy();
    }
  });

  it("falls back rather than showing a blank for an unknown kind", () => {
    expect(placeKindLabel("nonsense")).toBe("Other");
    expect(placeKindLabel("nonsense", true)).toBe("Other");
  });
});

describe("byRecommendation", () => {
  it("floats the ones worth going back to, then sorts by name", () => {
    const sorted = [
      place({ id: "1", name: "Zulu", would_return: null }),
      place({ id: "2", name: "Alpha", would_return: null }),
      place({ id: "3", name: "Yankee", would_return: true }),
    ].sort(byRecommendation);
    expect(sorted.map((p) => p.name)).toEqual(["Yankee", "Alpha", "Zulu"]);
  });

  it("treats 'would not return' the same as unanswered for ordering", () => {
    // A no is information, but it is not a reason to bury the place — the
    // note explaining why is often the useful part.
    const sorted = [
      place({ id: "1", name: "Beta", would_return: false }),
      place({ id: "2", name: "Alpha", would_return: null }),
    ].sort(byRecommendation);
    expect(sorted.map((p) => p.name)).toEqual(["Alpha", "Beta"]);
  });
});
