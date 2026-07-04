import type { RecipeDraft } from "./types";

/** "Copy of Chili (1).docx" -> "chili" — same rule as the seed script. */
export function normalizeTitle(title: string): string {
  return String(title || "")
    .toLowerCase()
    .replace(/\.(docx?|pdf|txt|rtf)$/i, "")
    .replace(/^copy of\s+/i, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Higher = more complete; used to pick the best duplicate. */
export function completeness(r: RecipeDraft): number {
  return (
    r.ingredients.length * 2 +
    r.steps.length * 2 +
    (r.notes ? 1 : 0) +
    (r.credit ? 1 : 0) +
    (r.source_url ? 1 : 0)
  );
}

/**
 * Collapse duplicates within a batch by normalized title, keeping the most
 * complete version of each (handles "Copy of X", "X (1)", .doc vs .docx).
 */
export function dedupeDrafts<T extends { draft: RecipeDraft }>(
  items: T[]
): T[] {
  const byTitle = new Map<string, T>();
  for (const item of items) {
    const key = normalizeTitle(item.draft.title);
    if (!key) continue;
    const existing = byTitle.get(key);
    if (!existing || completeness(item.draft) > completeness(existing.draft)) {
      byTitle.set(key, item);
    }
  }
  return [...byTitle.values()];
}
