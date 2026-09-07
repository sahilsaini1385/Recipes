import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, Users, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TripForm } from "@/components/TripForm";
import { useAuth } from "@/hooks/useAuth";
import { useTrips } from "@/hooks/useTrips";
import { usePassport } from "@/hooks/usePassport";
import { formatTripDates, tripNights, isUpcoming } from "@/lib/trips";
import { countryName, flagEmoji } from "@/lib/countries";
import { stateName } from "@/lib/usStates";
import { firstName } from "@/lib/names";

export default function TripPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isFamily } = useAuth();
  const { trips, loading, updateTrip, deleteTrip } = useTrips();
  const { data: passport } = usePassport();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const trip = trips?.find((t) => t.id === id) ?? null;
  const members = passport?.members ?? [];

  if (loading) {
    return <p className="mt-10 text-center text-ink-soft">Loading…</p>;
  }
  if (!trip) {
    return (
      <p className="mt-10 text-center text-ink-soft">
        Trip not found.{" "}
        <Link to="/trips" className="text-accent underline">
          Back to all trips
        </Link>
      </p>
    );
  }

  const dates = formatTripDates(trip.start_date, trip.end_date);
  const nights = tripNights(trip.start_date, trip.end_date);
  const who = trip.travellers
    .map((tid) => members.find((m) => m.id === tid))
    .filter(Boolean)
    .map((m) => firstName(m!.name));

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-4">
      <Link
        to="/trips"
        className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> All trips
      </Link>

      {editing ? (
        <Card className="mt-4 p-4">
          <TripForm
            members={members}
            trip={trip}
            onSave={async (draft) => {
              await updateTrip(trip.id, draft);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </Card>
      ) : (
        <>
          <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight text-ink">
            {trip.title}
          </h1>
          <p className="mt-1 text-ink-soft">
            {dates ?? (
              <span className="font-serif italic">Dates not recorded</span>
            )}
            {nights !== null && nights > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-sm text-ink-faint">
                <Moon className="h-3.5 w-3.5" />
                {nights} {nights === 1 ? "night" : "nights"}
              </span>
            )}
          </p>

          {trip.destinations.length > 0 && (
            <section className="mt-5">
              <h2 className="mb-2 flex items-center gap-3 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-dark/80 after:h-px after:flex-1 after:bg-paper-line">
                Where
              </h2>
              <div className="flex flex-wrap gap-2">
                {trip.destinations.map((d) => (
                  <span
                    key={`${d.kind}:${d.code}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-paper-line bg-paper-card px-3 py-1.5 text-sm"
                  >
                    {d.kind === "country" ? (
                      <>
                        <span>{flagEmoji(d.code)}</span>
                        {countryName(d.code)}
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] uppercase tracking-wider text-ink-faint">
                          US
                        </span>
                        {stateName(d.code)}
                      </>
                    )}
                  </span>
                ))}
              </div>
            </section>
          )}

          {who.length > 0 && (
            <section className="mt-5">
              {/* A trip that hasn't happened yet has nobody who "went". */}
              <h2 className="mb-2 flex items-center gap-3 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-dark/80 after:h-px after:flex-1 after:bg-paper-line">
                {isUpcoming(trip) ? "Who's going" : "Who went"}
              </h2>
              <p className="flex items-center gap-1.5 text-ink-soft">
                <Users className="h-4 w-4 text-ink-faint" />
                {who.join(" · ")}
              </p>
            </section>
          )}

          {trip.blurb && (
            <section className="mt-6 rounded-xl border border-dashed border-paper-line bg-paper-warm/70 p-4">
              <p className="whitespace-pre-wrap font-serif italic leading-relaxed text-ink-soft">
                {trip.blurb}
              </p>
            </section>
          )}

          {isFamily && (
            <div className="mt-8 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              {confirmDelete ? (
                <>
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      await deleteTrip(trip.id);
                      navigate("/trips");
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Really remove
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                    Keep it
                  </Button>
                </>
              ) : (
                <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4" /> Remove
                </Button>
              )}
            </div>
          )}
          {confirmDelete && (
            <p className="mt-2 text-xs text-ink-faint">
              The trip is hidden, not destroyed — it can be brought back.
            </p>
          )}
        </>
      )}
    </main>
  );
}
