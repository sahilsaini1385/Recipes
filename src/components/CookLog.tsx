import { useEffect, useRef, useState } from "react";
import { CookingPot, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useRecipeCooks } from "@/hooks/useRecipeCooks";
import {
  byMostRecent,
  cookSuggestions,
  formatCookDate,
  summarise,
  todayISO,
} from "@/lib/cooks";
import { cn } from "@/lib/utils";

/** How many entries show before the rest fold away. */
const VISIBLE = 5;

/**
 * "We cooked this" — the record of a recipe actually being made.
 *
 * Kept quiet on purpose. A recipe nobody has logged shows one unobtrusive
 * button, because 178 recipes currently have no history and a big empty panel
 * on every one of them would be 178 pieces of clutter.
 */
export function CookLog({ recipeId }: { recipeId: string | null }) {
  const { isFamily } = useAuth();
  const { cooks, loading, error, addCook, removeCook } = useRecipeCooks(recipeId);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO);
  const [who, setWho] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // The form opens at the bottom of a long page, underneath the fixed Cook
  // mode bar. Bring it into view rather than leaving somebody to wonder
  // whether the button worked.
  useEffect(() => {
    if (open) formRef.current?.scrollIntoView({ block: "center" });
  }, [open]);

  const all = [...(cooks ?? [])].sort(byMostRecent);
  // This is the one table in the archive designed to grow without limit. A
  // recipe cooked thirty times should not bury the recipe.
  const rows = showAll ? all : all.slice(0, VISIBLE);
  const hidden = all.length - rows.length;
  const suggestions = cookSuggestions(cooks ?? []);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await addCook({
        cooked_on: date,
        cooked_by: who.trim() || null,
        note: note.trim() || null,
      });
      setWho("");
      setNote("");
      setDate(todayISO());
      setOpen(false);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Nothing to show and nothing to offer: a signed-out visitor looking at a
  // recipe nobody has cooked gets no empty panel at all.
  if (loading || (all.length === 0 && !isFamily)) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-3 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-dark/80 after:h-px after:flex-1 after:bg-paper-line">
        In this kitchen
      </h2>

      {all.length > 0 && (
        <p className="mb-3 font-serif italic text-ink-soft">
          {/* Counts the whole log, not the five that happen to be on screen. */}
          {summarise(all)}
        </p>
      )}

      {error && (
        <p className="mb-3 text-sm text-red-800">
          Couldn't load the cooking log — nothing has been lost.
        </p>
      )}

      {all.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {rows.map((c) => (
            <li
              key={c.id}
              className="flex items-start gap-3 rounded-lg border border-paper-line bg-paper-card px-3 py-2"
            >
              <CookingPot className="mt-0.5 h-4 w-4 shrink-0 text-accent/60" />
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-medium">{formatCookDate(c.cooked_on)}</span>
                  {c.cooked_by && (
                    <span className="text-ink-soft"> · {c.cooked_by}</span>
                  )}
                </p>
                {c.note && (
                  <p className="mt-0.5 font-serif italic leading-snug text-ink-soft">
                    {c.note}
                  </p>
                )}
              </div>
              {isFamily && (
                <button
                  aria-label="Remove this entry"
                  onClick={() => removeCook(c.id)}
                  className="p-1 text-ink-faint hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {hidden > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="mb-3 text-sm font-medium text-accent-dark hover:underline"
        >
          Show {hidden} earlier {hidden === 1 ? "time" : "times"}
        </button>
      )}

      {isFamily &&
        (open ? (
          <div
            ref={formRef}
            className="rounded-xl border border-paper-line bg-paper-card p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-dark/80">
                We cooked this
              </p>
              <button
                aria-label="Cancel"
                onClick={() => setOpen(false)}
                className="p-1 text-ink-faint hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="block text-xs text-ink-soft" htmlFor="cooked-on">
              When
            </label>
            <Input
              id="cooked-on"
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              className="mb-2 h-11"
            />

            <label className="block text-xs text-ink-soft" htmlFor="cooked-by">
              Who made it <span className="text-ink-faint">(optional)</span>
            </label>
            <Input
              id="cooked-by"
              value={who}
              placeholder="Nancy, all of us, …"
              onChange={(e) => setWho(e.target.value)}
              className="h-11"
            />
            {/* Learned from what has already been typed here rather than from
                the 38 people on the family tree — the people who cook are a
                much shorter list, and this way it gets better with use. */}
            {suggestions.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {suggestions.map((name) => (
                  <button
                    key={name}
                    onClick={() => setWho(name)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs",
                      who === name
                        ? "border-accent bg-accent text-white"
                        : "border-paper-deep bg-paper text-ink-soft hover:border-accent/50"
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}

            <label className="mt-2 block text-xs text-ink-soft" htmlFor="cook-note">
              How did it go? <span className="text-ink-faint">(optional)</span>
            </label>
            <Input
              id="cook-note"
              value={note}
              placeholder="Halved the chilli, Jack ate it"
              onChange={(e) => setNote(e.target.value)}
              className="h-11"
            />

            {saveError && (
              <p className="mt-2 text-sm text-red-800">{saveError}</p>
            )}
            <Button
              className="mt-3 w-full"
              onClick={save}
              disabled={saving || !date}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            We cooked this
          </Button>
        ))}
    </section>
  );
}
