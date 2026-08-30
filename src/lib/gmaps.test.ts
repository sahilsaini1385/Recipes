import { describe, expect, it } from "vitest";
import { dayRouteUrls, placeQuery, placeSearchUrl } from "./gmaps";
import type { Stop } from "./types";

function stop(name: string, overrides: Partial<Stop> = {}): Stop {
  return {
    name,
    kind: "sight",
    description: "",
    area: "",
    address: "",
    lat: 48.85,
    lng: 2.35,
    approx: false,
    time_of_day: "flexible",
    tip: null,
    ...overrides,
  };
}

describe("placeQuery", () => {
  it("prefers the street address, then area, then destination", () => {
    expect(
      placeQuery(stop("Café X", { address: "1 Rue de Y, Paris" }), "Paris, France")
    ).toBe("Café X, 1 Rue de Y, Paris");
    expect(placeQuery(stop("Café X", { area: "Le Marais" }), "Paris, France")).toBe(
      "Café X, Le Marais, Paris, France"
    );
    expect(placeQuery(stop("Café X"), "Paris, France")).toBe(
      "Café X, Paris, France"
    );
  });
});

describe("placeSearchUrl", () => {
  it("builds an encoded google maps search url", () => {
    const url = placeSearchUrl(stop("Café de Flore"), "Paris, France");
    expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
    expect(url).toContain(encodeURIComponent("Café de Flore, Paris, France"));
  });
});

describe("dayRouteUrls", () => {
  it("returns a search link for a single stop", () => {
    const urls = dayRouteUrls([stop("A")], "Paris, France");
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("/maps/search/");
  });

  it("fits 11 stops in a single directions link (9 waypoints)", () => {
    const stops = Array.from({ length: 11 }, (_, i) => stop(`S${i}`));
    const urls = dayRouteUrls(stops, "Paris, France");
    expect(urls).toHaveLength(1);
    const waypoints = new URL(urls[0]).searchParams.get("waypoints")!;
    expect(waypoints.split("|")).toHaveLength(9);
  });

  it("splits longer days into overlapping legs", () => {
    const stops = Array.from({ length: 14 }, (_, i) => stop(`S${i}`));
    const urls = dayRouteUrls(stops, "Paris, France");
    expect(urls).toHaveLength(2);
    const leg1 = new URL(urls[0]).searchParams;
    const leg2 = new URL(urls[1]).searchParams;
    // Leg 1 ends where leg 2 begins, so the route is continuous.
    expect(leg1.get("destination")).toBe(leg2.get("origin"));
    expect(leg2.get("destination")).toContain("S13");
  });
});
