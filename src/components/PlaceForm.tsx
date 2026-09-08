import { useState } from "react";
import { Check, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PLACE_KINDS, placeKindLabel } from "@/lib/places";
import type { TripPlace, TripPlaceDraft } from "@/hooks/useTripPlaces";
import { cn } from "@/lib/utils";

interface Props {
  place?: TripPlace;
  /** The trip's city, if it has an obvious one — prefills a new place. */
  defaultCity?: string | null;
  defaultCountry?: string | null;
  onSave: (draft: TripPlaceDraft) => Promise<void>;
  onCancel: () => void;
}

/**
 * Adding a place happens standing on a pavement outside it, one-handed, with
 * a toddler pulling the other arm. So: the name is the only required field,
 * the kind defaults to restaurant because that is what people record, and the
 * city is prefilled from the trip. Everything else can be filled in later
 * from the sofa.
 */
export function PlaceForm({
  place,
  defaultCity,
  defaultCountry,
  onSave,
  onCancel,
}: Props) {
  const [name, setName] = useState(place?.name ?? "");
  const [kind, setKind] = useState(place?.kind ?? "restaurant");
  const [city, setCity] = useState(place?.city ?? defaultCity ?? "");
  const [note, setNote] = useState(place?.note ?? "");
  const [url, setUrl] = useState(place?.url ?? "");
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(
    place?.would_return ?? null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("It needs a name, even a rough one.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({
        name: trimmed,
        kind,
        city: city.trim() || null,
        country_code: place?.country_code ?? defaultCountry ?? null,
        note: note.trim() || null,
        url: url.trim() || null,
        would_return: wouldReturn,
      });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="place-name">Name</Label>
        <Input
          id="place-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Cervejaria Ramiro"
          className="mt-1"
          autoFocus
        />
      </div>

      <div>
        <Label>What kind</Label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {PLACE_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={cn(
                "h-10 rounded-full border px-3.5 text-sm font-medium transition-all active:scale-95",
                kind === k
                  ? "border-accent-dark/40 bg-accent text-white"
                  : "border-paper-line bg-paper-card text-ink-soft hover:border-accent/40 hover:text-ink"
              )}
            >
              {placeKindLabel(k)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="place-city">Town or city</Label>
        <Input
          id="place-city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Lisbon"
          className="mt-1"
        />
      </div>

      <div>
        <Label>Would you go back?</Label>
        {/* Three states, not a checkbox: leaving it unanswered has to stay
            possible, or every place added in a hurry reads as a "no". */}
        <div className="mt-1.5 flex flex-wrap gap-2">
          {(
            [
              { value: true, label: "Yes", Icon: ThumbsUp },
              { value: false, label: "No", Icon: ThumbsDown },
              { value: null, label: "Not sure", Icon: null },
            ] as const
          ).map(({ value, label, Icon }) => (
            <button
              key={label}
              type="button"
              onClick={() => setWouldReturn(value)}
              aria-pressed={wouldReturn === value}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-all active:scale-95",
                wouldReturn === value
                  ? "border-accent-dark/40 bg-accent text-white"
                  : "border-paper-line bg-paper-card text-ink-soft hover:border-accent/40 hover:text-ink"
              )}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="place-note">Notes</Label>
        <Textarea
          id="place-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Garlic prawns. Go early, no bookings."
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="place-url">Link</Label>
        <Input
          id="place-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Optional — a map pin or a website"
          className="mt-1"
        />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex gap-2">
        <Button onClick={submit} disabled={busy}>
          <Check className="h-4 w-4" />
          {busy ? "Saving…" : place ? "Save changes" : "Add place"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
