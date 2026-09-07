import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COUNTRIES, countryName, flagEmoji } from "@/lib/countries";
import { US_STATES, stateName } from "@/lib/usStates";
import { firstName } from "@/lib/names";
import type { FamilyMember } from "@/hooks/usePassport";
import type { Trip, TripDraft, TripDestination } from "@/hooks/useTrips";
import { cn } from "@/lib/utils";

interface Props {
  members: FamilyMember[];
  trip?: Trip;
  onSave: (draft: TripDraft) => Promise<void>;
  onCancel: () => void;
}

const key = (d: TripDestination) => `${d.kind}:${d.code}`;

export function TripForm({ members, trip, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(trip?.title ?? "");
  const [start, setStart] = useState(trip?.start_date ?? "");
  const [end, setEnd] = useState(trip?.end_date ?? "");
  const [blurb, setBlurb] = useState(trip?.blurb ?? "");
  const [travellers, setTravellers] = useState<Set<string>>(
    new Set(trip?.travellers ?? [])
  );
  const [destinations, setDestinations] = useState<TripDestination[]>(
    trip?.destinations ?? []
  );
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = useMemo(
    () => new Set(destinations.map(key)),
    [destinations]
  );

  // One search box over both lists: nobody thinks "is Texas a country?", they
  // just type where they went.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: TripDestination[] = [];
    for (const c of COUNTRIES) {
      if (c.name.toLowerCase().includes(q)) out.push({ kind: "country", code: c.code });
    }
    for (const s of US_STATES) {
      if (s.name.toLowerCase().includes(q)) out.push({ kind: "state", code: s.code });
    }
    return out.filter((d) => !chosen.has(key(d))).slice(0, 8);
  }, [query, chosen]);

  const toggleTraveller = (id: string) => {
    const next = new Set(travellers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setTravellers(next);
  };

  const labelFor = (d: TripDestination) =>
    d.kind === "country" ? countryName(d.code) : stateName(d.code);

  const submit = async () => {
    setError(null);
    if (!title.trim()) return setError("Give the trip a name.");
    if (start && end && end < start) {
      return setError("The end date is before the start date.");
    }
    setBusy(true);
    try {
      await onSave({
        title: title.trim(),
        start_date: start || null,
        end_date: end || null,
        blurb: blurb.trim() || null,
        travellers: [...travellers],
        destinations,
      });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="trip-title">Trip</Label>
        <Input
          id="trip-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Christmas in Lisbon"
          className="mt-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="trip-start">Left</Label>
          <Input
            id="trip-start"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="trip-end">Came home</Label>
          <Input
            id="trip-end"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-ink-faint">
        Both optional — a trip nobody can date is still worth recording.
      </p>

      <div>
        <Label>Who went</Label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => toggleTraveller(m.id)}
              aria-pressed={travellers.has(m.id)}
              className={cn(
                "h-10 rounded-full border px-3.5 text-sm font-medium transition-all active:scale-95",
                travellers.has(m.id)
                  ? "border-accent-dark/40 bg-accent text-white"
                  : "border-paper-line bg-paper-card text-ink-soft hover:border-accent/40 hover:text-ink"
              )}
            >
              {firstName(m.name)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="trip-where">Where</Label>
        {destinations.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {destinations.map((d) => (
              <span
                key={key(d)}
                className="inline-flex items-center gap-1.5 rounded-full border border-paper-line bg-paper-warm px-2.5 py-1 text-sm"
              >
                {d.kind === "country" && <span>{flagEmoji(d.code)}</span>}
                {labelFor(d)}
                <button
                  type="button"
                  aria-label={`Remove ${labelFor(d)}`}
                  onClick={() =>
                    setDestinations(destinations.filter((x) => key(x) !== key(d)))
                  }
                  className="text-ink-faint hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="relative mt-1.5">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input
            id="trip-where"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Add a country or state…"
            className="pl-9"
          />
        </div>
        {matches.length > 0 && (
          <ul className="mt-1.5 overflow-hidden rounded-xl border border-paper-line bg-paper-card">
            {matches.map((d) => (
              <li key={key(d)}>
                <button
                  type="button"
                  onClick={() => {
                    setDestinations([...destinations, d]);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-paper-warm"
                >
                  {d.kind === "country" ? (
                    <span>{flagEmoji(d.code)}</span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wider text-ink-faint">
                      US
                    </span>
                  )}
                  {labelFor(d)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <Label htmlFor="trip-blurb">Notes</Label>
        <Textarea
          id="trip-blurb"
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
          rows={3}
          placeholder="What you want to remember about it."
          className="mt-1"
        />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex gap-2">
        <Button onClick={submit} disabled={busy}>
          {busy ? "Saving…" : trip ? "Save changes" : "Add trip"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
