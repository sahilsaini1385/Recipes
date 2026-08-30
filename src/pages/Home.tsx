import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ClipboardPaste,
  Link2,
  Loader2,
  MapPin,
  Sparkles,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  ArticleFetchError,
  listItineraries,
  parseArticle,
  saveItinerary,
  type ItinerarySummary,
} from "@/lib/itineraries";
import { sampleItinerary } from "@/lib/sampleParis";

export default function Home() {
  const navigate = useNavigate();
  const { session, isFamily, loading: authLoading } = useAuth();

  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<ItinerarySummary[]>([]);

  useEffect(() => {
    listItineraries()
      .then(setSaved)
      .catch(() => {});
  }, []);

  const canCreate = isSupabaseConfigured && session && isFamily;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedUrl = url.trim();
    const trimmedText = text.trim();
    if (!showPaste && !trimmedUrl) return;
    if (showPaste && !trimmedText) return;

    setBusy(true);
    setPhase(
      showPaste ? "Reading the article…" : "Fetching the article…"
    );
    const phaseTimer = window.setTimeout(
      () =>
        setPhase(
          "Building your itinerary — finding every place, day by day. This can take a minute or two…"
        ),
      6000
    );
    try {
      const itinerary = await parseArticle(
        showPaste ? { text: trimmedText } : { url: trimmedUrl }
      );
      setPhase("Saving…");
      const slug = await saveItinerary(itinerary, showPaste ? null : trimmedUrl);
      navigate(`/t/${slug}`);
    } catch (err) {
      if (err instanceof ArticleFetchError) {
        setShowPaste(true);
        setError(
          "That site wouldn't let us read the article directly. Open it in your browser, select all the text, and paste it below instead."
        );
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      window.clearTimeout(phaseTimer);
      setBusy(false);
      setPhase("");
    }
  }

  return (
    <div className="min-h-screen pb-16">
      <AppHeader />

      <main className="mx-auto max-w-3xl px-4">
        <section className="pt-10 pb-8 text-center">
          <h1 className="font-serif text-4xl font-semibold leading-tight sm:text-5xl">
            Paste a travel article.
            <br />
            Get a mapped itinerary.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-ink-soft">
            Drop in a link like a &ldquo;three perfect days in Paris&rdquo;
            guide. Waypoint reads it, pulls out every café, museum, and
            viewpoint, and builds a day-by-day plan with a map — ready on your
            phone, with one-tap Google Maps directions and an export for Google
            My Maps.
          </p>
        </section>

        <section className="rounded-2xl border border-paper-deep bg-white p-4 shadow-card sm:p-6">
          {!isSupabaseConfigured ? (
            <p className="text-sm text-ink-soft">
              <strong>Demo mode.</strong> Supabase isn&rsquo;t configured yet,
              so creating new itineraries is off — but you can explore the{" "}
              <Link to={`/t/${sampleItinerary.slug}`} className="font-medium text-accent">
                sample Paris itinerary
              </Link>{" "}
              below. See the README for the 15-minute setup.
            </p>
          ) : !session && !authLoading ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <p className="text-ink-soft">
                Sign in to turn an article into an itinerary.
              </p>
              <Link to="/signin">
                <Button>
                  Sign in with email <ArrowRight size={16} />
                </Button>
              </Link>
            </div>
          ) : session && !isFamily && !authLoading ? (
            <p className="text-sm text-ink-soft">
              Your email isn&rsquo;t on the allowlist yet — ask the site owner
              to add it (see README). You can still open any shared itinerary
              link.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
              {!showPaste ? (
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink-soft">
                    <Link2 size={14} /> Article link
                  </label>
                  <Input
                    type="url"
                    inputMode="url"
                    placeholder="https://www.cntraveler.com/story/…"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={busy}
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink-soft">
                    <ClipboardPaste size={14} /> Article text
                  </label>
                  <Textarea
                    placeholder="Paste the full article text here…"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={busy}
                    rows={8}
                    required
                  />
                </div>
              )}

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={busy || !canCreate}>
                  {busy ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Working…
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} /> Build itinerary
                    </>
                  )}
                </Button>
                <button
                  type="button"
                  className="text-sm text-ink-soft underline underline-offset-2 hover:text-ink"
                  onClick={() => setShowPaste((v) => !v)}
                  disabled={busy}
                >
                  {showPaste ? "Use a link instead" : "Paste the text instead"}
                </button>
              </div>

              {busy && phase && (
                <p className="text-sm text-ink-soft">{phase}</p>
              )}
            </form>
          )}
        </section>

        <section className="mt-10">
          <h2 className="mb-3 font-serif text-2xl font-semibold">
            Your itineraries
          </h2>
          <ul className="space-y-2.5">
            <li>
              <ItineraryLink
                slug={sampleItinerary.slug}
                title={sampleItinerary.title}
                destination={`${sampleItinerary.destination} · built-in sample`}
              />
            </li>
            {saved.map((it) => (
              <li key={it.id}>
                <ItineraryLink
                  slug={it.slug}
                  title={it.title}
                  destination={it.destination}
                />
              </li>
            ))}
          </ul>
          {isSupabaseConfigured && saved.length === 0 && (
            <p className="mt-3 text-sm text-ink-faint">
              Itineraries you create will appear here — open this page on your
              phone to take them with you.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

function ItineraryLink({
  slug,
  title,
  destination,
}: {
  slug: string;
  title: string;
  destination: string;
}) {
  return (
    <Link
      to={`/t/${slug}`}
      className="flex items-center gap-3 rounded-xl border border-paper-deep bg-white px-4 py-3 shadow-card transition-shadow hover:shadow-card-hover"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
        <MapPin size={17} />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium">{title}</span>
        <span className="block truncate text-sm text-ink-soft">
          {destination}
        </span>
      </span>
      <ArrowRight size={16} className="ml-auto shrink-0 text-ink-faint" />
    </Link>
  );
}
