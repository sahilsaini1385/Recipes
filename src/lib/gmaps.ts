import type { Stop } from "./types";

// Google Maps universal URLs (no API key needed):
// https://developers.google.com/maps/documentation/urls/get-started

/** Query string that finds the actual venue, not just a dot on the map. */
export function placeQuery(stop: Stop, destination: string): string {
  if (stop.address) return `${stop.name}, ${stop.address}`;
  if (stop.area) return `${stop.name}, ${stop.area}, ${destination}`;
  return `${stop.name}, ${destination}`;
}

/** Deep link that opens the place in the Google Maps app / site. */
export function placeSearchUrl(stop: Stop, destination: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    placeQuery(stop, destination)
  )}`;
}

/** Directions from the user's current location to one stop. */
export function directionsToStopUrl(stop: Stop, destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    placeQuery(stop, destination)
  )}&travelmode=walking`;
}

// A Google Maps directions URL allows an origin, a destination, and at most
// 9 waypoints (11 stops per link). Longer days are split into legs, with the
// last stop of one leg repeated as the origin of the next.
const MAX_STOPS_PER_LINK = 11;

export function dayRouteUrls(stops: Stop[], destination: string): string[] {
  if (stops.length < 2) {
    return stops.map((s) => placeSearchUrl(s, destination));
  }
  const chunks: Stop[][] = [];
  let start = 0;
  while (start < stops.length - 1) {
    const end = Math.min(start + MAX_STOPS_PER_LINK, stops.length);
    chunks.push(stops.slice(start, end));
    if (end === stops.length) break;
    start = end - 1; // overlap: leg ends where the next begins
  }
  return chunks.map((chunk) => {
    const origin = placeQuery(chunk[0], destination);
    const dest = placeQuery(chunk[chunk.length - 1], destination);
    const waypoints = chunk
      .slice(1, -1)
      .map((s) => placeQuery(s, destination))
      .join("|");
    const params = new URLSearchParams({
      api: "1",
      origin,
      destination: dest,
      travelmode: "walking",
    });
    if (waypoints) params.set("waypoints", waypoints);
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  });
}
