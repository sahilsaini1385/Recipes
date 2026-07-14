import { useEffect, useRef, useState } from "react";
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
import {
  listNewDriveFiles,
  fetchDriveEntry,
  markDriveFile,
} from "@/lib/driveSync";
import { completeness, normalizeTitle } from "@/lib/dedupe";
import { cn } from "@/lib/utils";
import type { RecipeDraft } from "@/lib/types";

type Mode = "form" | "import";

interface QueueItem {
  sourceName: string;
  draft: RecipeDraft;
  /** Set when this item came from Google Drive, to log the outcome. */
  driveFileId?: string;
}

type ImportEntry = ExtractedEntry & { driveFileId?: string };

// Parsed-but-unreviewed recipes are kept on the device so an interrupted
// import can be resumed instead of re-parsed from scratch.
const PENDING_KEY = "pending-import-queue";

function loadPending(): QueueItem[] | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const items = JSON.parse(raw) as QueueItem[];
    return Array.isArray(items) && items.length > 0 ? items : null;
  } catch {
    return null;
  }
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

  // Review queue. It GROWS while parsing runs in the background: review of
  // recipe 1 starts as soon as it's parsed, while files 2..N keep parsing.
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [parsing, setParsing] = useState(false);
  const queueIndexRef = useRef(0);
  queueIndexRef.current = queueIndex;
  const formIndexRef = useRef(-1);

  const [pendingResume, setPendingResume] = useState<QueueItem[] | null>(
    loadPending
  );

  const [pasteText, setPasteText] = useState("");
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const reviewing = queue.length > 0;
  // Reviewer caught up with the parser — waiting for the next recipe.
  const waitingForNext = reviewing && queueIndex >= queue.length && parsing;

  // Load the current queue item into the form exactly once per index.
  useEffect(() => {
    if (
      queue.length > 0 &&
      queueIndex < queue.length &&
      formIndexRef.current !== queueIndex
    ) {
      formIndexRef.current = queueIndex;
      setForm(draftToForm(queue[queueIndex].draft));
      window.scrollTo({ top: 0 });
    }
  }, [queue, queueIndex]);

  // Persist the unreviewed remainder so an interrupted session can resume.
  useEffect(() => {
    if (queue.length > 0 && queueIndex < queue.length) {
      try {
        localStorage.setItem(
          PENDING_KEY,
          JSON.stringify(queue.slice(queueIndex))
        );
      } catch {
        // storage full — resume just won't be available
      }
    }
  }, [queue, queueIndex]);

  // Queue finished (reviewed past the end, parser done) — wrap up.
  useEffect(() => {
    if (queue.length > 0 && queueIndex >= queue.length && !parsing) {
      localStorage.removeItem(PENDING_KEY);
      setQueue([]);
      setQueueIndex(0);
      formIndexRef.current = -1;
      navigate("/");
    }
  }, [queue.length, queueIndex, parsing, navigate]);

  if (loading) return null;
  // Never tear down an import or review in progress over an auth blip —
  // individual saves/parses will surface real permission errors if any.
  const busy = importing || queue.length > 0;
  if (!session && !busy) {
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
  if (session && !isFamily && !busy) {
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
    let { data, error } = await supabase.functions.invoke("parse-recipe", {
      body,
    });
    // One retry for transient network failures — long batch runs hit the
    // occasional dropped request or timeout.
    if (
      error &&
      /Failed to send a request|Failed to fetch|timeout/i.test(
        error.message ?? ""
      )
    ) {
      await new Promise((r) => setTimeout(r, 2000));
      ({ data, error } = await supabase.functions.invoke("parse-recipe", {
        body,
      }));
    }
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

  /**
   * Parse entries one by one, appending each parsed recipe to the review
   * queue immediately — review and saving start with the first recipe while
   * the rest keep parsing. Duplicates within the batch collapse on the fly.
   */
  const parseIntoQueue = async (entries: ImportEntry[], warnings: string[]) => {
    setParsing(true);
    setQueue([]);
    setQueueIndex(0);
    setSavedCount(0);
    formIndexRef.current = -1;
    setImportWarnings(warnings);
    setPendingResume(null);
    localStorage.removeItem(PENDING_KEY);

    // Snapshot of existing recipe titles: file names that normalize to one
    // of these are skipped without spending an API call.
    const existingTitles = new Set(
      (recipes ?? []).map((r) => normalizeTitle(r.title))
    );

    const appended: QueueItem[] = [];
    const failed: string[] = [];
    let duplicates = 0;
    let alreadyOnSite = 0;
    let alreadyOnSiteParsed = 0;

    const publishWarnings = () => {
      const w = [...warnings];
      if (failed.length) w.push(`Skipped: ${failed.join("; ")}`);
      if (alreadyOnSite > 0) {
        w.push(
          `${alreadyOnSite} file${alreadyOnSite === 1 ? "" : "s"} skipped without parsing — a recipe with the same name is already on the site.`
        );
      }
      if (alreadyOnSiteParsed > 0) {
        w.push(
          `${alreadyOnSiteParsed} recipe${alreadyOnSiteParsed === 1 ? "" : "s"} auto-skipped after parsing — already on the site.`
        );
      }
      if (duplicates > 0) {
        w.push(
          `${duplicates} duplicate${duplicates === 1 ? "" : "s"} collapsed (kept the most complete version).`
        );
      }
      setImportWarnings(w);
    };

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // Name pre-check: "Copy of Chili (1).docx" normalizes to "chili" —
      // if that title already exists (on the site or in this batch), skip
      // the file before it costs anything.
      const nameNorm = normalizeTitle(entry.name);
      if (
        nameNorm &&
        (existingTitles.has(nameNorm) ||
          appended.some((q) => normalizeTitle(q.draft.title) === nameNorm))
      ) {
        alreadyOnSite++;
        if (entry.driveFileId) {
          await markDriveFile(entry.driveFileId, entry.name, "skipped");
        }
        publishWarnings();
        continue;
      }

      setProgress(
        entries.length > 1
          ? `Parsing ${entry.name} (${i + 1} of ${entries.length})…`
          : "Reading recipe…"
      );
      try {
        const draft = await parseEntry(entry);
        if (!draft) {
          failed.push(`${entry.name} (not a recipe)`);
          publishWarnings();
          continue;
        }
        // The parsed title may match an existing recipe even when the file
        // name didn't — auto-skip instead of asking the reviewer to.
        const parsedNorm = normalizeTitle(draft.title);
        if (parsedNorm && existingTitles.has(parsedNorm)) {
          alreadyOnSiteParsed++;
          if (entry.driveFileId) {
            await markDriveFile(entry.driveFileId, entry.name, "skipped");
          }
          publishWarnings();
          continue;
        }
        const item: QueueItem = {
          sourceName: entry.name,
          draft,
          driveFileId: entry.driveFileId,
        };
        const norm = normalizeTitle(draft.title);
        const dupIdx = appended.findIndex(
          (q) => normalizeTitle(q.draft.title) === norm
        );
        if (dupIdx >= 0) {
          duplicates++;
          const existing = appended[dupIdx];
          // Replace only if the earlier copy hasn't been reviewed yet.
          if (
            dupIdx >= queueIndexRef.current &&
            completeness(draft) > completeness(existing.draft)
          ) {
            appended[dupIdx] = item;
            setQueue((q) => q.map((x, idx) => (idx === dupIdx ? item : x)));
            if (existing.driveFileId) {
              await markDriveFile(
                existing.driveFileId,
                existing.sourceName,
                "skipped"
              );
            }
          } else if (item.driveFileId) {
            await markDriveFile(item.driveFileId, item.sourceName, "skipped");
          }
          publishWarnings();
          continue;
        }
        appended.push(item);
        setQueue((q) => [...q, item]);
      } catch (e) {
        failed.push(`${entry.name} (${(e as Error).message})`);
        publishWarnings();
      }
    }

    setParsing(false);
    setProgress("");
    publishWarnings();

    if (appended.length === 0) {
      const skippedAsExisting = alreadyOnSite + alreadyOnSiteParsed;
      if (skippedAsExisting > 0 && failed.length === 0) {
        // Not an error — everything was already on the site.
        setImportWarnings([
          ...warnings,
          `Nothing new to import — all ${skippedAsExisting} recipe${skippedAsExisting === 1 ? " is" : "s are"} already on the site.`,
        ]);
        return;
      }
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
  };

  const runImport = async () => {
    setImporting(true);
    setImportError(null);
    setImportWarnings([]);
    try {
      let entries: ImportEntry[] = [];
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

      await parseIntoQueue(entries, warnings);
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      setImporting(false);
      setParsing(false);
      setProgress("");
    }
  };

  /** Check the shared Google Drive folder for files not yet imported. */
  const runDriveSync = async () => {
    setImporting(true);
    setImportError(null);
    setImportWarnings([]);
    try {
      setProgress("Checking Google Drive…");
      const allNewFiles = await listNewDriveFiles();
      if (allNewFiles.length === 0) {
        setImportWarnings(["No new files in the Drive folder."]);
        return;
      }
      const warnings: string[] = [];

      // Skip Drive files whose names match existing recipes before even
      // downloading them — no bandwidth, no API tokens.
      const existingTitles = new Set(
        (recipes ?? []).map((r) => normalizeTitle(r.title))
      );
      const newFiles: typeof allNewFiles = [];
      let alreadyOnSite = 0;
      for (const f of allNewFiles) {
        const nameNorm = normalizeTitle(f.name);
        if (nameNorm && existingTitles.has(nameNorm)) {
          alreadyOnSite++;
          await markDriveFile(f.id, f.name, "skipped");
        } else {
          newFiles.push(f);
        }
      }
      if (alreadyOnSite > 0) {
        warnings.push(
          `${alreadyOnSite} Drive file${alreadyOnSite === 1 ? "" : "s"} skipped without parsing — a recipe with the same name is already on the site.`
        );
      }
      if (newFiles.length === 0) {
        setImportWarnings([
          ...warnings,
          "Nothing new to import — everything in the folder matches an existing recipe.",
        ]);
        return;
      }

      const entries: ImportEntry[] = [];
      const unreadable: string[] = [];
      for (let i = 0; i < newFiles.length; i++) {
        const f = newFiles[i];
        setProgress(`Downloading ${f.name} (${i + 1} of ${newFiles.length})…`);
        try {
          const entry = await fetchDriveEntry(f);
          if (entry) entries.push({ ...entry, driveFileId: f.id });
          else unreadable.push(f.name);
        } catch (e) {
          unreadable.push(`${f.name} (${(e as Error).message})`);
        }
      }
      if (unreadable.length) {
        warnings.push(`Could not read: ${unreadable.join("; ")}`);
      }
      if (entries.length === 0) {
        setImportWarnings(warnings);
        throw new Error(
          "Found new files in Drive, but none could be read as recipes."
        );
      }
      await parseIntoQueue(entries, warnings);
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      setImporting(false);
      setParsing(false);
      setProgress("");
    }
  };

  const resumePending = () => {
    if (!pendingResume) return;
    setImportError(null);
    setImportWarnings([]);
    setSavedCount(0);
    formIndexRef.current = -1;
    setQueue(pendingResume);
    setQueueIndex(0);
    setPendingResume(null);
  };

  const discardPending = () => {
    localStorage.removeItem(PENDING_KEY);
    setPendingResume(null);
  };

  const advanceQueue = () => {
    setQueueIndex((i) => i + 1);
  };

  const skipCurrent = async () => {
    const item = queue[queueIndex];
    if (item?.driveFileId) {
      await markDriveFile(item.driveFileId, item.sourceName, "skipped");
    }
    advanceQueue();
  };

  const save = async (photoFile: File | null) => {
    setSaving(true);
    setSaveError(null);
    try {
      const draft = formToDraft(form);
      if (!draft.title) throw new Error("A title is required.");
      const slug = await createRecipe(draft, photoFile);
      const item = queue[queueIndex];
      if (item?.driveFileId) {
        await markDriveFile(item.driveFileId, item.sourceName, "imported");
      }
      if (reviewing && queue.length === 1 && queueIndex === 0 && !parsing) {
        // Single-recipe import: jump straight to the saved recipe.
        localStorage.removeItem(PENDING_KEY);
        setQueue([]);
        formIndexRef.current = -1;
        navigate(`/recipe/${slug}`);
      } else if (reviewing) {
        setSavedCount((n) => n + 1);
        advanceQueue();
      } else {
        navigate(`/recipe/${slug}`);
      }
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const current =
    reviewing && queueIndex < queue.length ? queue[queueIndex] : null;
  const alreadyExists =
    current &&
    recipes?.some(
      (r) => normalizeTitle(r.title) === normalizeTitle(current.draft.title)
    );
  const batch = queue.length > 1 || parsing;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-4">
      <h1 className="mb-4 text-2xl">
        {reviewing
          ? batch
            ? `Review recipe ${Math.min(queueIndex + 1, queue.length)} of ${queue.length}${parsing ? "+" : ""}`
            : "Review imported recipe"
          : "Add recipe"}
      </h1>

      {reviewing && (
        <div className="mb-4 space-y-2">
          {parsing && (
            <p className="rounded-lg bg-paper-warm p-3 text-sm text-ink-soft">
              {progress || "Parsing continues in the background…"} Each recipe
              you save is stored immediately.
            </p>
          )}
          {current && (
            <p className="rounded-lg bg-accent-soft p-3 text-sm text-accent-dark">
              {batch ? (
                <>
                  From <strong>{current.sourceName}</strong>. Check the parsed
                  result, fix anything wrong, then save — or skip this one.
                  {savedCount > 0 && ` Saved so far: ${savedCount}.`}
                </>
              ) : (
                "Check the parsed ingredients and steps below, fix anything that looks wrong, then save."
              )}
            </p>
          )}
          {alreadyExists && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              A recipe with this title already exists — saving will create a
              second copy. Skip if it's the same one.
            </p>
          )}
          {importError && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {importError}
            </p>
          )}
          {importWarnings.map((w, i) => (
            <p
              key={i}
              className="rounded-lg bg-paper-warm p-3 text-xs text-ink-soft"
            >
              {w}
            </p>
          ))}
          {current && batch && (
            <Button variant="outline" size="sm" onClick={skipCurrent}>
              Skip this recipe
            </Button>
          )}
        </div>
      )}

      {waitingForNext && (
        <div className="rounded-xl bg-paper-warm p-8 text-center text-ink-soft">
          <p className="font-medium">All caught up!</p>
          <p className="mt-1 text-sm">
            Waiting for the next recipe to finish parsing…
          </p>
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

      {!reviewing && pendingResume && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p>
            An earlier import was interrupted —{" "}
            <strong>{pendingResume.length}</strong> parsed recipe
            {pendingResume.length === 1 ? "" : "s"} still waiting for review.
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={resumePending}>
              Resume review
            </Button>
            <Button size="sm" variant="outline" onClick={discardPending}>
              Discard
            </Button>
          </div>
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
              automatically, review starts with the first recipe while the
              rest keep parsing, and every save is stored immediately.
            </p>
          </div>
          {importError && <p className="text-sm text-red-700">{importError}</p>}
          {importWarnings.map((w, i) => (
            <p
              key={i}
              className="rounded-lg bg-paper-warm p-3 text-xs text-ink-soft"
            >
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
          <div className="text-center text-sm text-ink-faint">or</div>
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={runDriveSync}
            disabled={importing}
          >
            {importing
              ? progress || "Checking Google Drive…"
              : "Check Google Drive for new recipes"}
          </Button>
          <p className="text-center text-xs text-ink-faint">
            Looks in the family's shared Drive folder and imports anything
            added since the last check.
          </p>
        </div>
      ) : !waitingForNext ? (
        <RecipeForm
          value={form}
          onChange={setForm}
          onSubmit={save}
          submitLabel={
            reviewing && batch ? "Save and review next" : "Save recipe"
          }
          saving={saving}
          error={saveError}
        />
      ) : null}
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
