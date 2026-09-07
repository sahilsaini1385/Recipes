import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Luggage, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TripForm } from "@/components/TripForm";
import { useAuth } from "@/hooks/useAuth";
import { useTrips, type Trip } from "@/hooks/useTrips";
import { usePassport } from "@/hooks/usePassport";
import { formatTripDates, isUpcoming } from "@/lib/trips";
import { countryName, flagEmoji } from "@/lib/countries";
import { stateName } from "@/lib/usStates";
import { firstName } from "@/lib/names";

function TripCard({
  trip,
  nameFor,
}: {
  trip: Trip;
  nameFor: (id: string) => string | null;
}) {
  const dates = formatTripDates(trip.start_date, trip.end_date);
  const who = trip.travellers.map(nameFor).filter(Boolean) as string[];
  const upcoming = isUpcoming(trip);

  return (
    <Link
      to={`/trips/${trip.id}`}
      className="block rounded-2xl border border-paper-line bg-paper-card p-4 shadow-plate transition-shadow hover:shadow-plate-hover"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-serif text-lg font-semibold leading-tight text-ink">
          {trip.title}
        </h2>
        {upcoming && (
          <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent-dark">
            Upcoming
          </span>
        )}
      </div>

      <p className="mt-0.5 text-sm text-ink-soft">
        {dates ?? <span className="font-serif italic">Dates not recorded</span>}
      </p>

      {trip.destinations.length > 0 && (
        <p className="mt-2 text-sm text-ink-soft">
          {trip.destinations.map((d) => (
            <span key={`${d.kind}:${d.code}`} className="mr-2 inline-block">
              {d.kind === "country" ? `${flagEmoji(d.code)} ${countryName(d.code)}` : stateName(d.code)}
            </span>
          ))}
        </p>
      )}

      {who.length > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-ink-faint">
          <Users className="h-3.5 w-3.5" />
          {who.join(" · ")}
        </p>
      )}
    </Link>
  );
}

export default function Trips() {
  const { isFamily } = useAuth();
  const { trips, loading, error, createTrip } = useTrips();
  const { data: passport } = usePassport();
  const [adding, setAdding] = useState(false);

  const members = passport?.members ?? [];
  const nameFor = (id: string) => {
    const m = members.find((x) => x.id === id);
    return m ? firstName(m.name) : null;
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-5">
      <div className="mb-4 rounded-2xl bg-gradient-to-br from-accent to-accent-dark p-5 text-white shadow-card">
        <div className="flex items-center gap-2">
          <Luggage className="h-6 w-6" />
          <h1 className="font-serif text-2xl font-semibold">Trips</h1>
        </div>
        <p className="mt-1 text-sm text-white/85">
          {trips === null
            ? "Where the family has been, and when."
            : trips.length === 0
              ? "Where the family has been, and when."
              : `${trips.length} ${trips.length === 1 ? "trip" : "trips"} recorded.`}
        </p>
      </div>

      {isFamily && !adding && (
        <Button className="mb-4 w-full" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add a trip
        </Button>
      )}

      {adding && (
        <Card className="mb-4 p-4">
          <TripForm
            members={members}
            onSave={async (draft) => {
              await createTrip(draft);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        </Card>
      )}

      {loading && <p className="mt-10 text-center text-ink-soft">Loading trips…</p>}
      {error && (
        <p className="mt-10 text-center text-red-700">
          Could not load trips: {error}
        </p>
      )}

      {!loading && !error && trips?.length === 0 && !adding && (
        <div className="mt-10 rounded-2xl border border-dashed border-paper-line bg-paper-card/60 px-6 py-10 text-center">
          <p className="font-serif italic text-ink-soft">No trips yet.</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-ink-faint">
            {isFamily
              ? "Add the last one you took"
              : "Sign in as family to add one"}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {trips?.map((t) => (
          <TripCard key={t.id} trip={t} nameFor={nameFor} />
        ))}
      </div>
    </main>
  );
}
