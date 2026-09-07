import { useState } from "react";
import { Trash2, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CATEGORIES } from "@/lib/categories";
import { parseIngredientLine } from "@/lib/parseIngredient";
import type { Ingredient, RecipeDraft } from "@/lib/types";

interface IngredientRow {
  quantity: string;
  unit: string;
  item: string;
  note: string;
  /**
   * The line exactly as it was written in the source recipe, kept so that
   * detail the form fields can't hold ("1 (14.5 oz) can diced tomatoes")
   * survives a round-trip. Dropped as soon as the cook edits the row.
   */
  originalRaw?: string;
  /** The parts `originalRaw` was parsed into, to detect edits. */
  originalParts?: { quantity: string; unit: string; item: string; note: string };
}

export interface RecipeFormValue {
  title: string;
  category: string;
  credit: string;
  source_url: string;
  base_servings: string;
  servings_estimated: boolean;
  ingredients: IngredientRow[];
  steps: string[];
  tags: string;
  notes: string;
}

export function draftToForm(draft: Partial<RecipeDraft>): RecipeFormValue {
  return {
    title: draft.title ?? "",
    category: draft.category ?? "Entrees",
    credit: draft.credit ?? "",
    source_url: draft.source_url ?? "",
    base_servings: String(draft.base_servings ?? 4),
    servings_estimated: draft.servings_estimated ?? false,
    ingredients: (draft.ingredients ?? []).map((ing) => {
      const parts = {
        quantity: formatQtyForInput(ing),
        unit: ing.unit ?? "",
        item: ing.item,
        note: ing.note ?? "",
      };
      return { ...parts, originalRaw: ing.raw, originalParts: parts };
    }),
    steps: draft.steps?.length ? [...draft.steps] : [""],
    tags: (draft.tags ?? []).join(", "),
    notes: draft.notes ?? "",
  };
}

function formatQtyForInput(ing: Ingredient): string {
  if (ing.quantity == null) return "";
  const fmt = (n: number) =>
    Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000);
  return ing.quantity_max != null
    ? `${fmt(ing.quantity)}-${fmt(ing.quantity_max)}`
    : fmt(ing.quantity);
}

export function formToDraft(form: RecipeFormValue): RecipeDraft {
  const ingredients: Ingredient[] = form.ingredients
    .filter((row) => row.item.trim() || row.quantity.trim())
    .map((row) => {
      // Re-parse from the row parts so quantity strings like "1/2" or "2-3"
      // become real numbers. The raw line is only rebuilt when the cook
      // actually changed something -- otherwise the source wording stands.
      const rebuilt =
        [row.quantity, row.unit, row.item].filter(Boolean).join(" ").trim() +
        (row.note ? `, ${row.note}` : "");
      const o = row.originalParts;
      const untouched =
        !!row.originalRaw &&
        !!o &&
        o.quantity === row.quantity &&
        o.unit === row.unit &&
        o.item === row.item &&
        o.note === row.note;
      const parsed = parseIngredientLine(untouched ? row.originalRaw! : rebuilt);
      return {
        raw: untouched ? row.originalRaw! : rebuilt,
        quantity: parsed.quantity,
        quantity_max: parsed.quantity_max ?? null,
        unit: row.unit.trim() || parsed.unit,
        item: row.item.trim() || parsed.item,
        note: row.note.trim() || parsed.note,
        scalable: parsed.quantity != null,
      };
    });

  return {
    title: form.title.trim(),
    category: form.category,
    credit: form.credit.trim(),
    source_url: form.source_url.trim() || null,
    base_servings: Math.max(1, parseInt(form.base_servings, 10) || 4),
    servings_estimated: form.servings_estimated,
    ingredients,
    steps: form.steps.map((s) => s.trim()).filter(Boolean),
    tags: form.tags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
    notes: form.notes.trim() || null,
    photo_path: null,
  };
}

interface Props {
  value: RecipeFormValue;
  onChange: (value: RecipeFormValue) => void;
  onSubmit: (photoFile: File | null) => Promise<void>;
  submitLabel: string;
  saving: boolean;
  error: string | null;
}

export function RecipeForm({
  value,
  onChange,
  onSubmit,
  submitLabel,
  saving,
  error,
}: Props) {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const set = (patch: Partial<RecipeFormValue>) =>
    onChange({ ...value, ...patch });

  const setIngredient = (i: number, patch: Partial<IngredientRow>) => {
    const rows = value.ingredients.map((row, idx) =>
      idx === i ? { ...row, ...patch } : row
    );
    set({ ingredients: rows });
  };

  const moveIngredient = (i: number, dir: -1 | 1) => {
    const rows = [...value.ingredients];
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    set({ ingredients: rows });
  };

  const setStep = (i: number, text: string) => {
    const steps = value.steps.map((s, idx) => (idx === i ? text : s));
    set({ steps });
  };

  const moveStep = (i: number, dir: -1 | 1) => {
    const steps = [...value.steps];
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    [steps[i], steps[j]] = [steps[j], steps[i]];
    set({ steps });
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(photoFile);
      }}
    >
      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          required
          value={value.title}
          onChange={(e) => set({ title: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="category">Category</Label>
          <Select
            id="category"
            value={value.category}
            onChange={(e) => set({ category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="servings">Base servings</Label>
          <Input
            id="servings"
            type="number"
            inputMode="numeric"
            min={1}
            value={value.base_servings}
            onChange={(e) => set({ base_servings: e.target.value })}
          />
          <label className="mt-1 flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={value.servings_estimated}
              onChange={(e) => set({ servings_estimated: e.target.checked })}
              className="h-4 w-4 accent-[#b4552d]"
            />
            Servings estimated
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="credit">Credit</Label>
          <Input
            id="credit"
            placeholder="e.g. Dawn Johnson"
            value={value.credit}
            onChange={(e) => set({ credit: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="source">Source URL (optional)</Label>
          <Input
            id="source"
            type="url"
            placeholder="https://"
            value={value.source_url}
            onChange={(e) => set({ source_url: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label>Ingredients</Label>
        <div className="space-y-2">
          {value.ingredients.map((row, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <Input
                aria-label="Quantity"
                placeholder="1/2"
                value={row.quantity}
                onChange={(e) => setIngredient(i, { quantity: e.target.value })}
                className="w-16 px-2"
              />
              <Input
                aria-label="Unit"
                placeholder="cup"
                value={row.unit}
                onChange={(e) => setIngredient(i, { unit: e.target.value })}
                className="w-20 px-2"
              />
              <div className="flex-1 space-y-1">
                <Input
                  aria-label="Ingredient"
                  placeholder="ingredient"
                  value={row.item}
                  onChange={(e) => setIngredient(i, { item: e.target.value })}
                />
                {/* Always rendered: gating on row.note made notes
                    impossible to add, and unmounted the field the moment
                    one was cleared. */}
                <Input
                  aria-label="Note"
                  placeholder="note (e.g. to taste)"
                  value={row.note}
                  onChange={(e) => setIngredient(i, { note: e.target.value })}
                  className="h-9 text-sm text-ink-soft"
                />
              </div>
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label="Move up"
                  onClick={() => moveIngredient(i, -1)}
                  className="p-1 text-ink-faint hover:text-ink"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  onClick={() => moveIngredient(i, 1)}
                  className="p-1 text-ink-faint hover:text-ink"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                aria-label="Remove ingredient"
                onClick={() =>
                  set({
                    ingredients: value.ingredients.filter(
                      (_, idx) => idx !== i
                    ),
                  })
                }
                className="mt-2.5 p-1 text-ink-faint hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-2"
          onClick={() =>
            set({
              ingredients: [
                ...value.ingredients,
                { quantity: "", unit: "", item: "", note: "" },
              ],
            })
          }
        >
          <Plus className="h-4 w-4" /> Add ingredient
        </Button>
      </div>

      <div>
        <Label>Steps</Label>
        <div className="space-y-2">
          {value.steps.map((step, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="mt-3 w-6 shrink-0 text-center font-serif text-sm font-semibold text-accent-dark">
                {i + 1}
              </span>
              <Textarea
                aria-label={`Step ${i + 1}`}
                value={step}
                onChange={(e) => setStep(i, e.target.value)}
                className="min-h-[56px]"
              />
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label="Move step up"
                  onClick={() => moveStep(i, -1)}
                  className="p-1 text-ink-faint hover:text-ink"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Move step down"
                  onClick={() => moveStep(i, 1)}
                  className="p-1 text-ink-faint hover:text-ink"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                aria-label="Remove step"
                onClick={() =>
                  set({ steps: value.steps.filter((_, idx) => idx !== i) })
                }
                className="mt-2.5 p-1 text-ink-faint hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-2"
          onClick={() => set({ steps: [...value.steps, ""] })}
        >
          <Plus className="h-4 w-4" /> Add step
        </Button>
      </div>

      <div>
        <Label htmlFor="tags">Tags (comma separated)</Label>
        <Input
          id="tags"
          placeholder="vegetarian, slow-cooker, make-ahead"
          value={value.tags}
          onChange={(e) => set({ tags: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="photo">Photo (optional)</Label>
        <input
          id="photo"
          type="file"
          accept="image/*"
          onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-paper-deep file:px-3 file:py-2 file:text-ink"
        />
        {photoFile && (
          <img
            src={URL.createObjectURL(photoFile)}
            alt="Preview"
            className="mt-2 h-32 rounded-lg object-cover"
          />
        )}
      </div>

      <div>
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          value={value.notes}
          onChange={(e) => set({ notes: e.target.value })}
        />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={saving}>
        {saving ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
