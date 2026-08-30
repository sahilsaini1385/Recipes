import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BedDouble,
  Binoculars,
  Camera,
  Check,
  Coffee,
  Croissant,
  ExternalLink,
  Landmark,
  Lightbulb,
  Link2,
  Loader2,
  Map as MapIcon,
  MapPin,
  Martini,
  Navigation,
  Route,
  ShoppingBag,
  Ticket,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import MapView from "@/components/MapView";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  deleteItinerary,
  getItinerary,
} from "@/lib/itineraries";
import { downloadKml } from "@/lib/kml";
import { dayRouteUrls, directionsToStopUrl, placeSearchUrl } from "@/lib/gmaps";
import { dayColor, type ItineraryRecord, type Stop, type StopKind } from "@/lib/types";

const KIND_ICONS: Record<StopKind, typeof MapPin> = {
  sight: Camera,
  museum: Landmark,
  restaurant: Utensils,
  cafe: Coffee,
  bakery: Croissant,
  bar: Martini,
  hotel: BedDouble,
  shop: ShoppingBag,
  activity: Ticket,
  neighborhood: MapPin,
  viewpoint: Binoculars,
  other: MapPin,
};

export default function ItineraryPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isFamily } = useAuth();

  const [record, setRecord] = useState<ItineraryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [showMyMapsHelp, setShowMyMapsHelp] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    getItinerary(slug)
      .then(setRecord)
      .catch(() => setRecord(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const shownDays = useMemo(() => {
    if (!record) return [];
    return record.data.days.filter(
      (d) => activeDay === null || d.day === activeDay
    );
  }, [record, activeDay]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-soft">
        <Loader2 className="mr-2 animate-spin" size={18} /> Loading itinerary…
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-serif text-2xl">Itinerary not found</p>
        <p className="text-ink-soft">
          The link may be wrong, or the itinerary was deleted.
        </p>
        <Link to="/" className="font-medium text-accent">
          ← Back home
        </Link>
      </div>
    );
  }

  const it = record.data;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard can be unavailable; the URL bar still works
    }
  }

  async function onDelete() {
    if (!window.confirm("Delete this itinerary for everyone?")) return;
    await deleteItinerary(record!.id);
    navigate("/");
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-paper-deep/70 bg-paper/95 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4">
          <div className="flex h-12 items-center gap-2">
            <Link
              to="/"
              className="-ml-1 flex items-center gap-1 rounded-lg px-1 py-1 text-sm text-ink-soft hover:text-ink"
            >
              <ArrowLeft size={16} /> Home
            </Link>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={copyLink}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-ink-soft hover:bg-paper-warm hover:text-ink"
                title="Copy share link"
              >
                {copied ? <Check size={15} /> : <Link2 size={15} />}
                {copied ? "Copied" : "Share"}
              </button>
              {isFamily && record.id !== "sample" && (
                <button
                  onClick={onDelete}
                  className="rounded-lg p-1.5 text-ink-faint hover:bg-red-50 hover:text-red-700"
                  title="Delete itinerary"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4">
        <section className="pt-5 pb-4">
          <h1 className="font-serif text-3xl font-semibold leading-tight">
            {it.title}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
            <span className="flex items-center gap-1">
              <MapPin size={13} /> {it.destination}
            </span>
            {record.source_url && (
              <a
                href={record.source_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-accent hover:text-accent-dark"
              >
                <ExternalLink size={13} /> Source article
              </a>
            )}
          </p>
          {it.summary && (
            <p className="mt-2 text-[15px] text-ink-soft">{it.summary}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setShowMyMapsHelp(true)}>
              <MapIcon size={15} /> Google My Maps
            </Button>
          </div>
        </section>

        {/* Map */}
        <MapView
          days={it.days}
          activeDay={activeDay}
          destination={it.destination}
          className="z-0 h-[46vh] min-h-[300px] w-full overflow-hidden rounded-2xl border border-paper-deep shadow-card"
        />

        {/* Day filter */}
        <nav className="sticky top-12 z-10 -mx-4 mt-4 flex gap-2 overflow-x-auto bg-paper/95 px-4 py-2 backdrop-blur">
          <DayChip
            label="All days"
            active={activeDay === null}
            color="#54646b"
            onClick={() => setActiveDay(null)}
          />
          {it.days.map((d) => (
            <DayChip
              key={d.day}
              label={`Day ${d.day}`}
              active={activeDay === d.day}
              color={dayColor(d.day - 1)}
              onClick={() =>
                setActiveDay((cur) => (cur === d.day ? null : d.day))
              }
            />
          ))}
        </nav>

        {/* Days */}
        {shownDays.map((day) => {
          const color = dayColor(day.day - 1);
          const routeUrls = dayRouteUrls(day.stops, it.destination);
          return (
            <section key={day.day} className="mt-6">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="flex items-center gap-2 font-serif text-2xl font-semibold">
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  Day {day.day}: {day.title}
                </h2>
                {day.stops.length >= 2 &&
                  routeUrls.map((u, i) => (
                    <a
                      key={u}
                      href={u}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-dark"
                    >
                      <Route size={14} />
                      {routeUrls.length > 1
                        ? `Walking route ${i + 1}/${routeUrls.length}`
                        : "Walking route in Google Maps"}
                    </a>
                  ))}
              </div>

              <ol className="mt-3 space-y-3">
                {day.stops.map((stop, i) => (
                  <StopCard
                    key={`${stop.name}-${i}`}
                    stop={stop}
                    index={i + 1}
                    color={color}
                    destination={it.destination}
                  />
                ))}
              </ol>
            </section>
          );
        })}

        {/* General tips */}
        {activeDay === null && it.tips.length > 0 && (
          <section className="mt-8 rounded-2xl border border-paper-deep bg-paper-warm/70 p-4">
            <h2 className="mb-2 flex items-center gap-2 font-serif text-xl font-semibold">
              <Lightbulb size={18} className="text-accent" /> Good to know
            </h2>
            <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-ink-soft">
              {it.tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {showMyMapsHelp && (
        <MyMapsModal
          onClose={() => setShowMyMapsHelp(false)}
          onDownload={() => downloadKml(it, record.slug)}
        />
      )}
    </div>
  );
}

function DayChip({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-transparent text-white"
          : "border-paper-deep bg-white text-ink-soft hover:text-ink"
      }`}
      style={active ? { backgroundColor: color } : undefined}
    >
      {label}
    </button>
  );
}

function StopCard({
  stop,
  index,
  color,
  destination,
}: {
  stop: Stop;
  index: number;
  color: string;
  destination: string;
}) {
  const KindIcon = KIND_ICONS[stop.kind] ?? MapPin;
  return (
    <li className="rounded-xl border border-paper-deep bg-white p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium leading-snug">{stop.name}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-faint">
            <span className="flex items-center gap-1 capitalize">
              <KindIcon size={12} /> {stop.kind}
            </span>
            {stop.time_of_day !== "flexible" && (
              <span className="capitalize">· {stop.time_of_day}</span>
            )}
            {(stop.area || stop.address) && (
              <span className="truncate">· {stop.area || stop.address}</span>
            )}
          </p>
          {stop.description && (
            <p className="mt-1.5 text-[15px] text-ink-soft">
              {stop.description}
            </p>
          )}
          {stop.tip && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-accent-soft/60 px-2.5 py-1.5 text-sm text-accent-dark">
              <Lightbulb size={14} className="mt-0.5 shrink-0" /> {stop.tip}
            </p>
          )}
          <div className="mt-2.5 flex gap-2">
            <a
              href={placeSearchUrl(stop, destination)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-lg border border-paper-deep px-2.5 py-1.5 text-sm font-medium text-ink-soft hover:border-accent/40 hover:text-accent"
            >
              <MapPin size={13} /> Google Maps
            </a>
            <a
              href={directionsToStopUrl(stop, destination)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-lg border border-paper-deep px-2.5 py-1.5 text-sm font-medium text-ink-soft hover:border-accent/40 hover:text-accent"
            >
              <Navigation size={13} /> Directions
            </a>
          </div>
        </div>
      </div>
    </li>
  );
}

function MyMapsModal({
  onClose,
  onDownload,
}: {
  onClose: () => void;
  onDownload: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold">
            Create your Google My Map
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-ink-faint hover:bg-paper-warm hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-ink-soft">
          Download this itinerary as a KML file, then import it into Google My
          Maps — every day becomes a toggleable layer with numbered, colored
          pins.
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-soft">
          <li>
            Tap <strong>Download KML</strong> below.
          </li>
          <li>
            Open{" "}
            <a
              href="https://mymaps.google.com"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-accent"
            >
              mymaps.google.com
            </a>{" "}
            (easiest on a computer) and choose{" "}
            <strong>Create a new map</strong>.
          </li>
          <li>
            In the left panel, click <strong>Import</strong> and select the
            downloaded <code>.kml</code> file.
          </li>
          <li>
            On your phone, the map appears in the Google Maps app under{" "}
            <strong>You&nbsp;→ Maps</strong> — pins, notes, and all, even
            offline-ish.
          </li>
        </ol>
        <div className="mt-4 flex gap-2">
          <Button onClick={onDownload}>Download KML</Button>
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
