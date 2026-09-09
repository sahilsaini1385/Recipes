import { useMemo, useState } from "react";
import { CalendarDays, Check, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildItinerary, formatDayHeading } from "@/lib/itinerary";
import type { ItineraryEntry, ItineraryDraft } from "@/hooks/useItinerary";
import type { TripPlace } from "@/hooks/useTripPlaces";
import { cn } from "@/lib/utils";

interface Props {
  entries: ItineraryEntry[];
  loading: boolean;
  places: TripPlace[];
  startDate: string | null;
  endDate: string | null;
  /** Ahead of us: lay out every day so the plan can be filled in. */
  upcoming: boolean;
  isFamily: boolean;
  onAdd: (draft: ItineraryDraft) => Promise<void>;
  onUpdate: (id: string, draft: ItineraryDraft) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

function EntryForm({
  day,
  entry,
  places,
  onSave,
  onCancel,
}: {
  day: string;
  entry?: ItineraryEntry;
  places: TripPlace[];
  onSave: (draft: ItineraryDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(entry?.title ?? "");
  const [at, setAt] = useState(entry?.at ?? "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [placeId, setPlaceId] = useState<string | null>(entry?.place_id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("It needs a line about what happens.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({
        day: entry?.day ?? day,
        title: trimmed,
        at: at.trim() || null,
        note: note.trim() || null,
        place_id: placeId,
      });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Card className="p-3">
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="w-28 shrink-0">
            <Label htmlFor="entry-at">When</Label>
            {/* Free text, not a time picker: "morning" and "after nap" are
                what people actually write. */}
            <Input
              id="entry-at"
              value={at}
              onChange={(e) => setAt(e.target.value)}
              placeholder="9:30"
              className="mt-1"
            />
          </div>
          <div className="min-w-0 flex-1">
            <Label htmlFor="entry-title">What</Label>
            <Input
              id="entry-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tram up to Graça"
              className="mt-1"
              autoFocus
            />
          </div>
        </div>

        {places.length > 0 && (
          <div>
            <Label>Somewhere already saved?</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {places.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlaceId(placeId === p.id ? null : p.id)}
                  aria-pressed={placeId === p.id}
                  className={cn(
                    "h-9 rounded-full border px-3 text-sm transition-all active:scale-95",
                    placeId === p.id
                      ? "border-accent-dark/40 bg-accent text-white"
                      : "border-paper-line bg-paper-card text-ink-soft hover:border-accent/40 hover:text-ink"
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="entry-note">Notes</Label>
          <Textarea
            id="entry-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Optional — booked, or what to remember."
            className="mt-1"
          />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="flex gap-2">
          <Button size="sm" onClick={submit} disabled={busy}>
            <Check className="h-4 w-4" />
            {busy ? "Saving…" : entry ? "Save" : "Add"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * A trip's days, laid out in order.
 *
 * Before the trip these rows are the plan; afterwards they are the diary. The
 * component does not distinguish, because the trip does not: the same line
 * that said "book the tram" ends up being what you remember doing.
 */
export function Itinerary({
  entries,
  loading,
  places,
  startDate,
  endDate,
  upcoming,
  isFamily,
  onAdd,
  onUpdate,
  onRemove,
}: Props) {
  const [addingOn, setAddingOn] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  // On a past trip the empty days are hidden, but family may still want to
  // write up a day nobody got round to. This opens them back up on request.
  const [showAllDays, setShowAllDays] = useState(false);

  const layOutEveryDay = upcoming || showAllDays;
  const days = useMemo(
    () => buildItinerary(entries, startDate, endDate, layOutEveryDay),
    [entries, startDate, endDate, layOutEveryDay]
  );
  const hiddenDays = useMemo(() => {
    if (layOutEveryDay) return 0;
    const all = buildItinerary(entries, startDate, endDate, true).length;
    return Math.max(0, all - days.length);
  }, [entries, startDate, endDate, layOutEveryDay, days.length]);
  const placeById = useMemo(
    () => new Map(places.map((p) => [p.id, p])),
    [places]
  );
  const count = entries.length;

  if (loading) {
    return <p className="py-6 text-center text-ink-soft">Loading the days…</p>;
  }

  // Nothing to lay out: either the trip has no dates to hang days off, or it
  // is a past trip nobody wrote up. Those want different sentences.
  if (days.length === 0) {
    const datedButBlank = hiddenDays > 0;
    return (
      <div className="rounded-2xl border border-dashed border-paper-line bg-paper-card/60 px-6 py-8 text-center">
        <CalendarDays className="mx-auto h-5 w-5 text-accent/40" />
        <p className="mt-2 font-serif italic text-ink-soft">
          {upcoming ? "Nothing planned yet." : "Nobody wrote this one up."}
        </p>
        {isFamily ? (
          datedButBlank ? (
            <button
              onClick={() => setShowAllDays(true)}
              className="mt-1 text-[11px] uppercase tracking-[0.14em] text-ink-faint underline hover:text-ink"
            >
              Open the {hiddenDays} {hiddenDays === 1 ? "day" : "days"} and add
              something
            </button>
          ) : (
            <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-ink-faint">
              Give the trip dates and the days appear here
            </p>
          )
        ) : (
          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-ink-faint">
            Sign in as family to add to it
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {days.map((d) => (
        <div key={d.day}>
          <div className="flex items-baseline gap-2">
            <h3 className="font-serif text-lg font-medium text-ink">
              {formatDayHeading(d.day, startDate)}
            </h3>
            {d.index !== null && (
              <span className="text-[11px] uppercase tracking-[0.12em] text-ink-faint">
                Day {d.index}
              </span>
            )}
          </div>

          <div className="mt-1.5 border-l-2 border-paper-line pl-3">
            {d.entries.length === 0 && addingOn !== d.day && (
              <p className="py-1 font-serif text-sm italic text-ink-faint">
                Nothing planned.
              </p>
            )}

            <ul className="space-y-2">
              {d.entries.map((e) =>
                editing === e.id ? (
                  <li key={e.id}>
                    <EntryForm
                      day={d.day}
                      entry={e as ItineraryEntry}
                      places={places}
                      onSave={async (draft) => {
                        await onUpdate(e.id, draft);
                        setEditing(null);
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  </li>
                ) : (
                  <li
                    key={e.id}
                    className="rounded-xl border border-paper-line bg-paper-card p-2.5 shadow-plate"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="leading-snug text-ink">
                          {e.at && (
                            <span className="mr-2 font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-accent-dark">
                              {e.at}
                            </span>
                          )}
                          {e.title}
                        </p>
                        {e.place_id && placeById.has(e.place_id) && (
                          <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.1em] text-ink-faint">
                            <MapPin className="h-3 w-3" />
                            {placeById.get(e.place_id)!.name}
                          </p>
                        )}
                        {e.note && (
                          <p className="mt-1 whitespace-pre-wrap font-serif italic leading-relaxed text-ink-soft">
                            {e.note}
                          </p>
                        )}
                      </div>
                      {isFamily && (
                        <div className="flex shrink-0 gap-1">
                          <button
                            onClick={() => setEditing(e.id)}
                            aria-label={`Edit ${e.title}`}
                            className="rounded-lg p-1.5 text-ink-faint hover:bg-paper-warm hover:text-ink"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setRemoving(e.id)}
                            aria-label={`Remove ${e.title}`}
                            className="rounded-lg p-1.5 text-ink-faint hover:bg-paper-warm hover:text-ink"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {removing === e.id && (
                      <div className="mt-2 rounded-lg border border-dashed border-paper-line bg-paper-warm/60 p-2">
                        <p className="text-sm text-ink-soft">
                          Remove this? It is hidden, not destroyed.
                        </p>
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={async () => {
                              await onRemove(e.id);
                              setRemoving(null);
                            }}
                            className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800"
                          >
                            Remove
                          </button>
                          <button
                            onClick={() => setRemoving(null)}
                            className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-paper-warm"
                          >
                            Keep it
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              )}
            </ul>

            {addingOn === d.day && (
              <div className="mt-2">
                <EntryForm
                  day={d.day}
                  places={places}
                  onSave={async (draft) => {
                    await onAdd(draft);
                    setAddingOn(null);
                  }}
                  onCancel={() => setAddingOn(null)}
                />
              </div>
            )}

            {isFamily && addingOn !== d.day && (
              <button
                onClick={() => setAddingOn(d.day)}
                className="mt-1.5 inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm text-ink-faint hover:bg-paper-warm hover:text-ink"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            )}
          </div>
        </div>
      ))}

      {hiddenDays > 0 && isFamily && (
        <button
          onClick={() => setShowAllDays(true)}
          className="text-[11px] uppercase tracking-[0.14em] text-ink-faint underline hover:text-ink"
        >
          Show the other {hiddenDays} {hiddenDays === 1 ? "day" : "days"} to
          write one up
        </button>
      )}

      {count === 0 && isFamily && upcoming && (
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">
          Plan it now, and it becomes the record of what you did
        </p>
      )}
    </div>
  );
}
