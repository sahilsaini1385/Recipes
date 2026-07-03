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
import { supabase } from "@/lib/supabase";
import { createRecipe } from "@/lib/saveRecipe";
import { cn } from "@/lib/utils";
import type { RecipeDraft } from "@/lib/types";

type Mode = "form" | "import";

export default function AddRecipe() {
  const { session, isFamily, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("form");
  const [form, setForm] = useState<RecipeFormValue>(() =>
    draftToForm({
      ingredients: [
        { raw: "", quantity: null, unit: null, item: "", note: "", scalable: false },
      ],
    })
  );
  const [reviewing, setReviewing] = useState(false);

  // Smart import state
  const [pasteText, setPasteText] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

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

  const runImport = async () => {
    setImporting(true);
    setImportError(null);
    try {
      let body: Record<string, unknown>;
      if (importFile) {
        const data = await fileToBase64(importFile);
        body = { file: { data, media_type: importFile.type } };
      } else if (pasteText.trim()) {
        body = { text: pasteText.trim() };
      } else {
        setImportError("Paste recipe text or choose a photo or PDF first.");
        setImporting(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("parse-recipe", {
        body,
      });
      if (error) throw new Error(error.message || "Import failed");
      const draft = data as Partial<RecipeDraft>;
      setForm(draftToForm(draft));
      setReviewing(true);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const save = async (photoFile: File | null) => {
    setSaving(true);
    setSaveError(null);
    try {
      const draft = formToDraft(form);
      if (!draft.title) throw new Error("A title is required.");
      const slug = await createRecipe(draft, photoFile);
      navigate(`/recipe/${slug}`);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-4">
      <h1 className="mb-4 text-2xl">
        {reviewing ? "Review imported recipe" : "Add recipe"}
      </h1>

      {reviewing && (
        <p className="mb-4 rounded-lg bg-accent-soft p-3 text-sm text-accent-dark">
          Check the parsed ingredients and steps below, fix anything that looks
          wrong, then save.
        </p>
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
            <Label htmlFor="import-file">Upload a photo or PDF</Label>
            <input
              id="import-file"
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-paper-deep file:px-3 file:py-2 file:text-ink"
            />
          </div>
          {importError && <p className="text-sm text-red-700">{importError}</p>}
          <Button
            size="lg"
            className="w-full"
            onClick={runImport}
            disabled={importing}
          >
            {importing ? "Reading recipe…" : "Import"}
          </Button>
          <p className="text-center text-xs text-ink-faint">
            The recipe is parsed automatically. You review and edit the result
            before anything is saved.
          </p>
        </div>
      ) : (
        <RecipeForm
          value={form}
          onChange={setForm}
          onSubmit={save}
          submitLabel="Save recipe"
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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
