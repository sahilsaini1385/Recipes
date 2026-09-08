import type { TripPlace } from "@/hooks/useTripPlaces";

/**
 * Places on a trip: the restaurants, hotels and sights it was made of.
 *
 * The interesting question is not "what did we do in Lisbon" — the trip page
 * answers that. It is "where did we eat in Lisbon", asked three years later
 * by someone going back. That is a search across every trip at once, which is
 * what `matchesPlaceQuery` below exists for.
 */

export type PlaceKind =
  | "restaurant"
  | "cafe"
  | "bar"
  | "hotel"
  | "sight"
  | "shop"
  | "other";

/** Ordered for the picker: the ones a family actually records go first. */
export const PLACE_KINDS: readonly PlaceKind[] = [
  "restaurant",
  "cafe",
  "bar",
  "hotel",
  "sight",
  "shop",
  "other",
] as const;

const KIND_LABELS: Record<PlaceKind, string> = {
  restaurant: "Restaurant",
  cafe: "Café",
  bar: "Bar",
  hotel: "Stay",
  sight: "Sight",
  shop: "Shop",
  other: "Other",
};

/** Plural, for the headings a group of places sits under. */
const KIND_PLURALS: Record<PlaceKind, string> = {
  restaurant: "Restaurants",
  cafe: "Cafés",
  bar: "Bars",
  hotel: "Stays",
  sight: "Sights",
  shop: "Shops",
  other: "Other",
};

export function placeKindLabel(kind: string, plural = false): string {
  const k = kind as PlaceKind;
  const table = plural ? KIND_PLURALS : KIND_LABELS;
  return table[k] ?? (plural ? "Other" : "Other");
}

/**
 * Fold accents so "café" is found by typing "cafe", and lowercase. People
 * search for Lisbon restaurants without reaching for the accent keyboard.
 */
function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Does this place match what someone typed? Every word in the query has to
 * appear somewhere in the place — name, city, country, note or kind — so
 * "lisbon dinner" narrows rather than widens. Word order does not matter,
 * because nobody remembers which way round they wrote it.
 */
export function matchesPlaceQuery(
  place: Pick<TripPlace, "name" | "city" | "note" | "kind"> & {
    countryLabel?: string | null;
    tripTitle?: string | null;
  },
  query: string
): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fold(
    [
      place.name,
      place.city ?? "",
      place.note ?? "",
      placeKindLabel(place.kind),
      place.countryLabel ?? "",
      place.tripTitle ?? "",
    ].join(" ")
  );
  return words.every((w) => haystack.includes(w));
}

/**
 * Group places by kind, in PLACE_KINDS order, dropping empty groups. Within a
 * group they keep the order they arrived in, which the caller has already
 * sorted.
 */
export function groupByKind<T extends { kind: string }>(
  places: T[]
): Array<{ kind: PlaceKind; label: string; places: T[] }> {
  return PLACE_KINDS.map((kind) => ({
    kind,
    label: placeKindLabel(kind, true),
    places: places.filter((p) => p.kind === kind),
  })).filter((g) => g.places.length > 0);
}

/**
 * Alphabetical by name, but the ones somebody would go back to float to the
 * top of their group — that is the whole reason to record the flag.
 */
export function byRecommendation(a: TripPlace, b: TripPlace): number {
  const rank = (p: TripPlace) => (p.would_return === true ? 0 : 1);
  const d = rank(a) - rank(b);
  if (d !== 0) return d;
  return a.name.localeCompare(b.name);
}
