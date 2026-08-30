export const STOP_KINDS = [
  "sight",
  "museum",
  "restaurant",
  "cafe",
  "bakery",
  "bar",
  "hotel",
  "shop",
  "activity",
  "neighborhood",
  "viewpoint",
  "other",
] as const;
export type StopKind = (typeof STOP_KINDS)[number];

export const TIMES_OF_DAY = [
  "morning",
  "afternoon",
  "evening",
  "flexible",
] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

export interface Stop {
  name: string;
  kind: StopKind;
  /** What the article says about it, in one or two sentences. */
  description: string;
  /** Neighborhood / district, "" when unknown. */
  area: string;
  /** Street address when known, "" when unknown. */
  address: string;
  lat: number;
  lng: number;
  /** True when coordinates are neighborhood-level rather than the exact venue. */
  approx: boolean;
  time_of_day: TimeOfDay;
  /** Insider tip pulled from the article, or null. */
  tip: string | null;
}

export interface ItineraryDay {
  day: number;
  title: string;
  stops: Stop[];
}

export interface ItineraryData {
  title: string;
  destination: string;
  summary: string;
  days: ItineraryDay[];
  /** General advice from the article that isn't tied to one stop. */
  tips: string[];
}

export interface ItineraryRecord {
  id: string;
  slug: string;
  title: string;
  destination: string;
  source_url: string | null;
  data: ItineraryData;
  created_at: string;
}

/** Colors used for day pins on the map, day badges, and KML styles. */
export const DAY_COLORS = [
  "#0f766e", // teal
  "#b45309", // amber-brown
  "#6d28d9", // violet
  "#be185d", // raspberry
  "#1d4ed8", // blue
  "#4d7c0f", // olive
];

export function dayColor(dayIndex: number): string {
  return DAY_COLORS[dayIndex % DAY_COLORS.length];
}
