import { supabase } from "./supabase";
import { slugify } from "./slug";
import { invalidateRecipes, refreshRecipes } from "@/hooks/useRecipes";
import type { RecipeDraft } from "./types";

async function uniqueSlug(title: string, excludeId?: string): Promise<string> {
  const base = slugify(title) || "recipe";
  let slug = base;
  for (let i = 2; i < 50; i++) {
    let query = supabase.from("recipes").select("id").eq("slug", slug);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query.limit(1);
    if (!data || data.length === 0) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

export async function uploadPhoto(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("recipe-photos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function createRecipe(
  draft: RecipeDraft,
  photoFile: File | null
): Promise<string> {
  const slug = await uniqueSlug(draft.title);
  const photo_path = photoFile ? await uploadPhoto(photoFile) : null;
  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase.from("recipes").insert({
    ...draft,
    slug,
    photo_path,
    created_by: userData.user?.id ?? null,
  });
  if (error) throw error;

  await refreshCache();
  return slug;
}

/**
 * Refresh the shared recipe cache after a write. Never throws: the row is
 * already saved at this point, and letting a failed follow-up read bubble up
 * would make the caller think the save failed and offer a retry, which would
 * insert the recipe a second time.
 */
async function refreshCache(): Promise<void> {
  invalidateRecipes();
  try {
    await refreshRecipes();
  } catch {
    // The next mount (or the Home "Try again" button) will refetch.
  }
}

export async function updateRecipe(
  id: string,
  draft: RecipeDraft,
  photoFile: File | null,
  existingPhotoPath: string | null
): Promise<string> {
  const slug = await uniqueSlug(draft.title, id);
  const photo_path = photoFile
    ? await uploadPhoto(photoFile)
    : existingPhotoPath;

  const { error } = await supabase
    .from("recipes")
    // Editing may change ingredients, so clear the cost estimate — the
    // background estimator will re-price it on the next visit.
    .update({ ...draft, slug, photo_path, cost_per_serving: null })
    .eq("id", id);
  if (error) throw error;

  await refreshCache();
  return slug;
}
