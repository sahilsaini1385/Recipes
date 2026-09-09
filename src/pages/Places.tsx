import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Search, ThumbsUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PlaceCard } from "@/components/PlaceCard";
import { useTripPlaces } from "@/hooks/useTripPlaces";
import { useTrips } from "@/hooks/useTrips";
import {
  PLACE_KINDS,
  matchesPlaceQuery,
  placeKindLabel,
  byRecommendation,
} from "@/lib/places";
import { countryName } from "@/lib/countries";
import { cn } from "@/lib/utils";

const CHIP_BASE =
  "flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-all active:scale-95";
const CHIP_ON =
  "border-accent-dark/40 bg-accent text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(78,59,33,0.18)]";
const CHIP_OFF =
  "border-paper-line bg-paper-card text-ink-soft hover:border-accent/40 hover:text-ink";

/**
 * Every place from every trip, in one searchable list.
 *
 * The trip page already shows a trip's own places. This page exists for the
 * question the trip page cannot answer: "where did we eat in Lisbon", asked
 * years later by somebody going back, who does not remember which trip it was.
 */
export default function Places() {
  const { places, loading: placesLoading, error, reload } = useTripPlaces();
  // This page needs both: places carry the content, trips supply the titles a
  // place is filtered and labelled by. Reporting "no places yet" while either
  // is still in flight is a confident wrong answer -- and on a phone on hotel
  // wifi it is the only answer anybody sees.
  const { trips, loading: tripsLoading } = useTrips();
  const loading = placesLoading || tripsLoading;
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<string | null>(null);
  const [onlyReturns, setOnlyReturns] = useState(false);

  const tripsById = useMemo(
    () => new Map((trips ?? []).map((t) => [t.id, t])),
    [trips]
  );

  // A place whose trip has been removed keeps its row but has nothing to link
  // to, so it drops out of the browser rather than rendering a dead card.
  const visible = useMemo(
    () => (places ?? []).filter((p) => tripsById.has(p.trip_id)),
    [places, tripsById]
  );

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of visible) map.set(p.kind, (map.get(p.kind) ?? 0) + 1);
    return map;
  }, [visible]);

  const returnCount = useMemo(
    () => visible.filter((p) => p.would_return === true).length,
    [visible]
  );

  const filtered = useMemo(() => {
    let list = visible;
    if (kind) list = list.filter((p) => p.kind === kind);
    if (onlyReturns) list = list.filter((p) => p.would_return === true);
    if (query.trim()) {
      list = list.filter((p) =>
        matchesPlaceQuery(
          {
            ...p,
            countryLabel: p.country_code ? countryName(p.country_code) : null,
            tripTitle: tripsById.get(p.trip_id)?.title ?? null,
          },
          query.trim()
        )
      );
    }
    return [...list].sort(byRecommendation);
  }, [visible, kind, onlyReturns, query, tripsById]);

  const empty = useMemo(() => {
    if (visible.length === 0) {
      return {
        headline: "No places yet.",
        hint: "Open a trip and add the restaurants worth remembering",
      };
    }
    if (query.trim()) {
      return {
        headline: `Nothing matches “${query.trim()}”.`,
        hint: kind || onlyReturns ? "Try clearing the filters too" : "Try another word",
      };
    }
    if (onlyReturns) {
      return {
        headline: "Nothing marked worth going back to yet.",
        hint: "Open a place and set “would you go back”",
      };
    }
    return {
      headline: `No ${placeKindLabel(kind ?? "other", true).toLowerCase()} yet.`,
      hint: "Try another kind",
    };
  }, [visible, query, kind, onlyReturns]);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-5">
      <div className="mb-4 rounded-2xl bg-gradient-to-br from-accent to-accent-dark p-5 text-white shadow-card">
        <div className="flex items-center gap-2">
          <MapPin className="h-6 w-6" />
          <h1 className="font-serif text-2xl font-semibold">Places</h1>
        </div>
        <p className="mt-1 text-sm text-white/85">
          {visible.length > 0 ? (
            <>
              <strong>{visible.length}</strong>{" "}
              {visible.length === 1 ? "place" : "places"} from{" "}
              <strong>{new Set(visible.map((p) => p.trip_id)).size}</strong>{" "}
              {new Set(visible.map((p) => p.trip_id)).size === 1 ? "trip" : "trips"}.
            </>
          ) : (
            "Everywhere the family has eaten, stayed and wandered."
          )}
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <Input
          type="search"
          placeholder="Search places, towns and notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 rounded-full border-paper-line bg-paper-card pl-10 shadow-[inset_0_1px_2px_rgba(78,59,33,0.05)] placeholder:font-serif placeholder:italic placeholder:text-ink-faint focus-visible:ring-accent/60"
        />
      </div>

      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        <button
          onClick={() => setOnlyReturns(!onlyReturns)}
          className={cn(CHIP_BASE, onlyReturns ? CHIP_ON : CHIP_OFF)}
        >
          <ThumbsUp
            className={cn("h-4 w-4", onlyReturns ? "text-white" : "text-accent")}
          />
          Would go back
          {returnCount > 0 && (
            <span
              className={cn(
                "rounded-full px-1.5 text-[11px] tabular-nums",
                onlyReturns ? "bg-white/25 text-white" : "bg-paper-warm text-ink-faint"
              )}
            >
              {returnCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setKind(null)}
          className={cn(CHIP_BASE, kind === null ? CHIP_ON : CHIP_OFF)}
        >
          All
          {/* No count until both sources are in, or it reads "0" mid-load. */}
          {!loading && (
            <span
              className={cn(
                "rounded-full px-1.5 text-[11px] tabular-nums",
                kind === null ? "bg-white/25 text-white" : "bg-paper-warm text-ink-faint"
              )}
            >
              {visible.length}
            </span>
          )}
        </button>
        {PLACE_KINDS.filter((k) => (counts.get(k) ?? 0) > 0).map((k) => (
          <button
            key={k}
            onClick={() => setKind(kind === k ? null : k)}
            className={cn(CHIP_BASE, kind === k ? CHIP_ON : CHIP_OFF)}
          >
            {placeKindLabel(k, true)}
            <span
              className={cn(
                "rounded-full px-1.5 text-[11px] tabular-nums",
                kind === k ? "bg-white/25 text-white" : "bg-paper-warm text-ink-faint"
              )}
            >
              {counts.get(k)}
            </span>
          </button>
        ))}
      </div>

      {loading && (
        <p className="mt-10 text-center text-ink-soft">Loading places…</p>
      )}
      {error && (
        <div className="mt-10 text-center">
          <p className="text-red-700">Could not load places: {error}</p>
          <button className="mt-2 text-accent underline" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-paper-line bg-paper-card/60 px-6 py-10 text-center">
          <p className="font-serif italic text-ink-soft">{empty.headline}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-ink-faint">
            {empty.hint}
          </p>
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {filtered.map((p) => {
          const trip = tripsById.get(p.trip_id);
          return (
            <PlaceCard
              key={p.id}
              place={p}
              context={
                trip && (
                  <Link
                    to={`/trips/${trip.id}`}
                    className="text-sm text-accent-dark underline hover:text-accent"
                  >
                    {trip.title}
                  </Link>
                )
              }
            />
          );
        })}
      </ul>
    </main>
  );
}
