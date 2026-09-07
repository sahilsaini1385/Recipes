import type { Trip } from "@/hooks/useTrips";

/**
 * Trip dates, written the way a person writes them.
 *
 * Both dates are optional, because half the point of the trips table is
 * recording a holiday somebody half-remembers. So this has to read well when
 * it knows everything, when it knows only a start, and when it knows nothing.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Dates are stored as plain `date` columns -- no time, no zone. Parsing
 * "2024-06-12" with the Date constructor treats it as UTC midnight, which in
 * the Americas renders as the 11th. Split the string instead so a date means
 * the day it says.
 */
export function parseTripDate(value: string | null): {
  y: number;
  m: number;
  d: number;
} | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

/**
 * "12–19 June 2024" · "28 June – 3 July 2024" · "28 Dec 2024 – 3 Jan 2025"
 * A single day collapses to "12 June 2024"; a start with no end reads
 * "From 12 June 2024"; an end with no start reads "Until …". Nothing at all
 * returns null so the caller can decide what to show instead.
 */
export function formatTripDates(
  start: string | null,
  end: string | null
): string | null {
  const a = parseTripDate(start);
  const b = parseTripDate(end);
  if (!a && !b) return null;
  if (a && !b) return `From ${a.d} ${MONTHS[a.m - 1]} ${a.y}`;
  if (!a && b) return `Until ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  if (!a || !b) return null; // unreachable, keeps the checker happy

  if (a.y === b.y && a.m === b.m) {
    if (a.d === b.d) return `${a.d} ${MONTHS[a.m - 1]} ${a.y}`;
    return `${a.d}–${b.d} ${MONTHS[a.m - 1]} ${a.y}`;
  }
  if (a.y === b.y) {
    return `${a.d} ${MONTHS[a.m - 1]} – ${b.d} ${MONTHS[b.m - 1]} ${a.y}`;
  }
  // Across a new year the months get abbreviated, or the line runs too long
  // for a phone-width card.
  const short = (mo: number) => MONTHS[mo - 1].slice(0, 3);
  return `${a.d} ${short(a.m)} ${a.y} – ${b.d} ${short(b.m)} ${b.y}`;
}

/** How many nights, when both ends are known. */
export function tripNights(start: string | null, end: string | null): number | null {
  const a = parseTripDate(start);
  const b = parseTripDate(end);
  if (!a || !b) return null;
  const ms =
    Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d);
  const nights = Math.round(ms / 86_400_000);
  return nights >= 0 ? nights : null;
}

/**
 * Newest first. Trips with no start date sort to the bottom rather than the
 * top -- an undated memory is the vaguest one, not the most recent -- and ties
 * break on when the row was created so the order never wobbles between loads.
 */
export function byNewest(a: Trip, b: Trip): number {
  const as = a.start_date ?? "";
  const bs = b.start_date ?? "";
  if (as && bs && as !== bs) return as < bs ? 1 : -1;
  if (as && !bs) return -1;
  if (!as && bs) return 1;
  return (b.created_at ?? "").localeCompare(a.created_at ?? "");
}

/** Is this trip still ahead of us? Used to label the upcoming ones. */
export function isUpcoming(trip: Trip, today = new Date()): boolean {
  const ref = trip.end_date ?? trip.start_date;
  const d = parseTripDate(ref);
  if (!d) return false;
  const todayUtc = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  return Date.UTC(d.y, d.m - 1, d.d) > todayUtc;
}
