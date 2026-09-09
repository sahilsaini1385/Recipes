import { parseTripDate } from "./trips";

/**
 * The day-by-day shape of a trip.
 *
 * The same rows are the plan beforehand and the diary afterwards, so this has
 * to read well in both directions: empty days must be visible while you are
 * planning (you cannot add to a day that is not on screen), and must not
 * clutter the page years later when only three of twelve days had anything
 * written down.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * A trip long enough to be a sabbatical should not render a heading per day.
 * Past this, only days with something written on them appear.
 */
export const MAX_LAID_OUT_DAYS = 60;

/** "2026-03-28" -> "2026-03-29". Pure string in, string out, no timezones. */
export function nextDay(iso: string): string {
  const d = parseTripDate(iso);
  if (!d) return iso;
  const t = new Date(Date.UTC(d.y, d.m - 1, d.d + 1));
  return t.toISOString().slice(0, 10);
}

/** Whole days between two dates, inclusive of both ends. Null if unbounded. */
export function daySpan(start: string | null, end: string | null): number | null {
  const a = parseTripDate(start);
  const b = parseTripDate(end);
  if (!a || !b) return null;
  const ms = Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d);
  const days = Math.round(ms / 86_400_000) + 1;
  return days >= 1 ? days : null;
}

export interface DayEntry {
  id: string;
  day: string;
  at: string | null;
  title: string;
  note: string | null;
  place_id: string | null;
  position: number;
}

export interface ItineraryDay {
  /** ISO date. */
  day: string;
  /** 1-based, counted from the trip's start. Null when the trip has no start. */
  index: number | null;
  entries: DayEntry[];
  /** True when the day only exists because the trip's dates cover it. */
  empty: boolean;
}

/**
 * Which days to lay out, and what sits on each.
 *
 * `layOutEveryDay` is the difference between planning and remembering. While
 * a trip is ahead of you, every day it covers should be on screen — you
 * cannot add to a day you cannot see. Once it is behind you those same empty
 * days are noise: a fortnight in Lisbon with three days written up should
 * read as three entries, not as three entries and eleven lines saying
 * nothing happened.
 *
 * An entry dated outside the trip's range always appears either way. Dates
 * get edited after entries are written, and silently hiding somebody's note
 * is the one thing this must never do.
 */
export function buildItinerary(
  entries: DayEntry[],
  start: string | null,
  end: string | null,
  layOutEveryDay = true
): ItineraryDay[] {
  const byDay = new Map<string, DayEntry[]>();
  for (const e of entries) {
    if (!parseTripDate(e.day)) continue; // unparseable date, nothing to place it on
    const list = byDay.get(e.day) ?? [];
    list.push(e);
    byDay.set(e.day, list);
  }

  const days = new Set<string>(byDay.keys());

  const span = daySpan(start, end);
  if (layOutEveryDay && start && span !== null && span <= MAX_LAID_OUT_DAYS) {
    let cursor = start;
    for (let i = 0; i < span; i++) {
      days.add(cursor);
      cursor = nextDay(cursor);
    }
  } else if (layOutEveryDay && start && !end && byDay.size === 0) {
    // A one-day trip, or one whose end is not known yet: offer the first day
    // so there is somewhere to start writing.
    days.add(start);
  }

  const first = parseTripDate(start);
  return [...days]
    .sort()
    .map((day) => {
      const list = (byDay.get(day) ?? []).slice().sort(byPosition);
      const d = parseTripDate(day)!;
      const index =
        first === null
          ? null
          : Math.round(
              (Date.UTC(d.y, d.m - 1, d.d) -
                Date.UTC(first.y, first.m - 1, first.d)) /
                86_400_000
            ) + 1;
      return {
        day,
        // A day before the trip officially starts should not read "Day 0".
        index: index !== null && index >= 1 ? index : null,
        entries: list,
        empty: list.length === 0,
      };
    });
}

/** Stable order within a day: position first, then whatever was added first. */
export function byPosition(a: DayEntry, b: DayEntry): number {
  if (a.position !== b.position) return a.position - b.position;
  return a.id.localeCompare(b.id);
}

/**
 * "Sat 21 December" — weekday included because when you are planning, which
 * day of the week it falls on is half the question. The year is added only
 * when it is not the year the trip starts in, which keeps New Year trips
 * honest without repeating 2025 twelve times.
 */
export function formatDayHeading(iso: string, tripStart?: string | null): string {
  const d = parseTripDate(iso);
  if (!d) return iso;
  const weekday = WEEKDAYS[new Date(Date.UTC(d.y, d.m - 1, d.d)).getUTCDay()];
  const startYear = parseTripDate(tripStart ?? null)?.y;
  const showYear = startYear === undefined || startYear !== d.y;
  return `${weekday} ${d.d} ${MONTHS[d.m - 1]}${showYear ? ` ${d.y}` : ""}`;
}
