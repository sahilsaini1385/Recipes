import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileText, Import } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  RecipeForm,
  draftToForm,
  formToDraft,
  type RecipeFormValue,
} from "@/components/RecipeForm";
import { useAuth } from "@/hooks/useAuth";
import { useRecipes } from "@/hooks/useRecipes";
import { supabase } from "@/lib/supabase";
import { createRecipe } from "@/lib/saveRecipe";
import { extractFromFile, type ExtractedEntry } from "@/lib/extractDocs";
import { dedupeDrafts, normalizeTitle } from "@/lib/dedupe";
import { cn } from "@/lib/utils";
import type { RecipeDraft } from "@/lib/types";

type Mode = "form" | "import";

interface QueueItem {
  sourceName: string;
  draft: RecipeDraft;
}

export default function AddRecipe() {
  const { session, isFamily, loading } = useAuth();
  const { recipes } = useRecipes();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("form");
  const [form, setForm] = useState<RecipeFormValue>(() =>
    draftToForm({
      ingredients: [
        { raw: "", quantity: null, unit: null, item: "", note: "", scalable: false },
      ],
    })
  );

  // Review queue: single-recipe imports are a queue of one; zip imports can
  // hold dozens. Each is reviewed and saved (or skipped) one at a time.
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const reviewing = queue.length > 0;

  const [pasteText, setPasteText] = useState("");
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (loading) return null;
  if (!session) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-ink-soft">
          Sign in to add recipes.{" "}
          <Link to="/signin" className="text-accent underline">
            Sign in
          </Link>
        </p>
      </main>
    );
  }
  if (!isFamily) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-ink-soft">
          Your email is not on the family list yet. Ask the site owner to add
          it.
        </p>
      </main>
    );
  }

  const parseEntry = async (
    entry: ExtractedEntry
  ): Promise<RecipeDraft | null> => {
    const body = entry.file ? { file: entry.file } : { text: entry.text };
    const { data, error } = await supabase.functions.invoke("parse-recipe", {
      body,
    });
    if (error) {
      // Surface the real reason from the function's JSON body when present.
      let detail = error.message || "Import failed";
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const payload = await ctx.json();
          if (payload?.error) detail = payload.error;
        } catch {
          // body wasn't JSON — keep the generic message
        }
      }
      throw new Error(detail);
    }
    const draft = data as RecipeDraft;
    // The parser returns an empty title when the input isn't a recipe.
    if (!draft.title && !draft.ingredients?.length) return null;
    return draft;
  };

  const runImport = async () => {
    setImporting(true);
    setImportError(null);
    setImportWarnings([]);
    try {
      let entries: ExtractedEntry[] = [];
      const warnings: string[] = [];

      if (importFiles.length > 0) {
        const unreadable: string[] = [];
        for (const file of importFiles) {
          setProgress(`Reading ${file.name}…`);
          const extracted = await extractFromFile(file);
          entries.push(...extracted.entries);
          unreadable.push(...extracted.skipped);
        }
        if (unreadable.length) {
          warnings.push(`Could not read: ${unreadable.join(", ")}`);
        }
        if (entries.length === 0) {
          throw new Error(
            "No readable recipes found in those files. Supported: photos, PDF, .docx, .doc, .txt, or a .zip of those."
          );
        }
      } else if (pasteText.trim()) {
        entries = [{ name: "pasted text", text: pasteText.trim() }];
      } else {
        throw new Error("Paste recipe text or choose a file first.");
      }

      const items: QueueItem[] = [];
      const failed: string[] = [];
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        setProgress(
          entries.length > 1
            ? `Parsing ${entry.name} (${i + 1} of ${entries.length})…`
            : "Reading recipe…"
        );
        try {
          const draft = await parseEntry(entry);
          if (draft) items.push({ sourceName: entry.name, draft });
          else failed.push(`${entry.name} (not a recipe)`);
        } catch (e) {
          failed.push(`${entry.name} (${(e as Error).message})`);
        }
      }
      if (failed.length) warnings.push(`Skipped: ${failed.join("; ")}`);

      const deduped = dedupeDrafts(items);
      if (deduped.length < items.length) {
        warnings.push(
          `${items.length - deduped.length} duplicate${
            items.length - deduped.length === 1 ? "" : "s"
          } collapsed (kept the most complete version).`
        );
      }
      // Show the per-file outcomes even when nothing succeeded, so the real
      // failure reason is visible instead of a generic message.
      setImportWarnings(warnings);
      if (deduped.length === 0) {
        const firstFailure = failed[0] ?? "";
        if (/Failed to send a request|Failed to fetch|not found/i.test(firstFailure)) {
          throw new Error(
            "The recipe parser isn't reachable. The 'parse-recipe' Edge Function may not be deployed in Supabase yet — see the README setup step, then try again."
          );
        }
        throw new Error(
          firstFailure
            ? `Nothing could be imported. First problem: ${firstFailure}`
            : "Nothing importable was found."
        );
      }
      setQueue(deduped);
      setQueueIndex(0);
      setSavedCount(0);
      setForm(draftToForm(deduped[0].draft));
      window.scrollTo({ top: 0 });
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      setImporting(false);
      setProgress("");
    }
  };

  const advanceQueue = () => {
    const next = queueIndex + 1;
    if (next < queue.length) {
      setQueueIndex(next);
      setForm(draftToForm(queue[next].draft));
      window.scrollTo({ top: 0 });
    } else {
      setQueue([]);
      navigate("/");
    }
  };

  const save = async (photoFile: File | null) => {
    setSaving(true);
    setSaveError(null);
    try {
      const draft = formToDraft(form);
      if (!draft.title) throw new Error("A title is required.");
      const slug = await createRecipe(draft, photoFile);
      if (reviewing && queue.length > 1) {
        setSavedCount((n) => n + 1);
        advanceQueue();
      } else {
        setQueue([]);
        navigate(`/recipe/${slug}`);
      }
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const current = reviewing ? queue[queueIndex] : null;
  const alreadyExists =
    current &&
    recipes?.some(
      (r) => normalizeTitle(r.title) === normalizeTitle(current.draft.title)
    );

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-4">
      <h1 className="mb-4 text-2xl">
        {reviewing
          ? queue.length > 1
            ? `Review recipe ${queueIndex + 1} of ${queue.length}`
            : "Review imported recipe"
          : "Add recipe"}
      </h1>

      {reviewing && (
        <div className="mb-4 space-y-2">
          <p className="rounded-lg bg-accent-soft p-3 text-sm text-accent-dark">
            {queue.length > 1 ? (
              <>
                From <strong>{current?.sourceName}</strong>. Check the parsed
                result, fix anything wrong, then save — or skip this one.
                {savedCount > 0 && ` Saved so far: ${savedCount}.`}
              </>
            ) : (
              "Check the parsed ingredients and steps below, fix anything that looks wrong, then save."
            )}
          </p>
          {alreadyExists && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              A recipe with this title already exists — saving will create a
              second copy. Skip if it's the same one.
            </p>
          )}
          {importWarnings.map((w, i) => (
            <p key={i} className="rounded-lg bg-paper-warm p-3 text-xs text-ink-soft">
              {w}
            </p>
          ))}
          {queue.length > 1 && (
            <Button variant="outline" size="sm" onClick={advanceQueue}>
              Skip this recipe
            </Button>
          )}
        </div>
      )}

      {!reviewing && (
        <div className="mb-5 grid grid-cols-2 gap-2">
          <TabButton
            active={mode === "form"}
            onClick={() => setMode("form")}
            icon={<FileText className="h-4 w-4" />}
            label="Form"
          />
          <TabButton
            active={mode === "import"}
            onClick={() => setMode("import")}
            icon={<Import className="h-4 w-4" />}
            label="Import"
          />
        </div>
      )}

      {!reviewing && mode === "import" ? (
        <div className="space-y-4">
          <div>
            <Label htmlFor="paste">Paste recipe text</Label>
            <Textarea
              id="paste"
              rows={10}
              placeholder="Paste the whole recipe here — title, ingredients, steps."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
          </div>
          <div className="text-center text-sm text-ink-faint">or</div>
          <div>
            <Label htmlFor="import-file">
              Upload photos, PDFs, Word files, or a whole .zip of recipes
            </Label>
            <input
              id="import-file"
              type="file"
              multiple
              accept="image/*,application/pdf,.pdf,.doc,.docx,.txt,.rtf,.md,.zip"
              onChange={(e) => setImportFiles(Array.from(e.target.files ?? []))}
              className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-paper-deep file:px-3 file:py-2 file:text-ink"
            />
            {importFiles.length > 1 && (
              <p className="mt-1 text-xs text-ink-soft">
                {importFiles.length} files selected
              </p>
            )}
            <p className="mt-1 text-xs text-ink-faint">
              Select as many files as you like. Zips are unpacked
              automatically, every recipe is parsed, duplicates are collapsed,
              and you review each one before it is saved.
            </p>
          </div>
          {importError && <p className="text-sm text-red-700">{importError}</p>}
          {importWarnings.map((w, i) => (
            <p key={i} className="rounded-lg bg-paper-warm p-3 text-xs text-ink-soft">
              {w}
            </p>
          ))}
          <Button
            size="lg"
            className="w-full"
            onClick={runImport}
            disabled={importing}
          >
            {importing ? progress || "Reading recipe…" : "Import"}
          </Button>
          <p className="text-center text-xs text-ink-faint">
            Recipes are parsed automatically. You review and edit each result
            before anything is saved.
          </p>
        </div>
      ) : (
        <RecipeForm
          value={form}
          onChange={setForm}
          onSubmit={save}
          submitLabel={
            reviewing && queue.length > 1
              ? queueIndex + 1 < queue.length
                ? "Save and review next"
                : "Save last recipe"
              : "Save recipe"
          }
          saving={saving}
          error={saveError}
        />
      )}
    </main>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-11 items-center justify-center gap-2 rounded-lg border font-medium",
        active
          ? "border-accent bg-accent-soft text-accent-dark"
          : "border-paper-deep bg-white text-ink-soft"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
