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

  invalidateRecipes();
  await refreshRecipes();
  return slug;
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
    .update({ ...draft, slug, photo_path })
    .eq("id", id);
  if (error) throw error;

  invalidateRecipes();
  await refreshRecipes();
  return slug;
}
