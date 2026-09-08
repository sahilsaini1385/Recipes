import { ExternalLink, Pencil, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { placeKindLabel } from "@/lib/places";
import type { TripPlace } from "@/hooks/useTripPlaces";
import { cn } from "@/lib/utils";

interface Props {
  place: TripPlace;
  /** Shown on the cross-trip browser, where the trip is not obvious. */
  context?: React.ReactNode;
  /** Family-only controls. Omitted entirely for a read-only visitor. */
  onEdit?: () => void;
  onRemove?: () => void;
  removing?: boolean;
  onConfirmRemove?: () => void;
  onCancelRemove?: () => void;
}

/**
 * One place. Deliberately quiet: the name and the note are what somebody came
 * to read, so everything else stays small and out of the way.
 */
export function PlaceCard({
  place,
  context,
  onEdit,
  onRemove,
  removing,
  onConfirmRemove,
  onCancelRemove,
}: Props) {
  return (
    <li className="rounded-xl border border-paper-line bg-paper-card p-3 shadow-plate">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-serif text-lg font-medium leading-snug text-ink">
            {place.name}
            {place.would_return === true && (
              <ThumbsUp
                className="ml-1.5 inline h-3.5 w-3.5 -translate-y-0.5 text-accent"
                aria-label="Would go back"
              />
            )}
            {place.would_return === false && (
              <ThumbsDown
                className="ml-1.5 inline h-3.5 w-3.5 translate-y-0.5 text-ink-faint"
                aria-label="Would not go back"
              />
            )}
          </p>
          <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-ink-faint">
            {placeKindLabel(place.kind)}
            {place.city && <> · {place.city}</>}
          </p>
        </div>
        {(onEdit || onRemove) && (
          <div className="flex shrink-0 gap-1">
            {onEdit && (
              <button
                onClick={onEdit}
                aria-label={`Edit ${place.name}`}
                className="rounded-lg p-2 text-ink-faint hover:bg-paper-warm hover:text-ink"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {onRemove && (
              <button
                onClick={onRemove}
                aria-label={`Remove ${place.name}`}
                className="rounded-lg p-2 text-ink-faint hover:bg-paper-warm hover:text-ink"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {place.note && (
        <p className="mt-1.5 whitespace-pre-wrap font-serif italic leading-relaxed text-ink-soft">
          {place.note}
        </p>
      )}

      {context && <div className="mt-1.5">{context}</div>}

      {place.url && (
        <a
          href={place.url}
          target="_blank"
          rel="noreferrer noopener"
          className={cn(
            "mt-2 inline-flex items-center gap-1 text-sm text-accent-dark underline",
            "hover:text-accent"
          )}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open
        </a>
      )}

      {removing && (
        <div className="mt-3 rounded-lg border border-dashed border-paper-line bg-paper-warm/60 p-2.5">
          <p className="text-sm text-ink-soft">
            Remove {place.name}? It is hidden, not destroyed.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={onConfirmRemove}
              className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800"
            >
              Remove
            </button>
            <button
              onClick={onCancelRemove}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-paper-warm"
            >
              Keep it
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
