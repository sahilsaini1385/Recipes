import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

// The anon key is public by design; all data access is enforced by Row Level
// Security in Postgres. No privileged secret ever ships to the client.
export const supabase: SupabaseClient = createClient(
  url ?? "https://placeholder.supabase.co",
  anonKey ?? "placeholder"
);

/**
 * The real reason an edge function failed.
 *
 * supabase.functions.invoke() reports every non-2xx response as the same
 * generic "Edge Function returned a non-2xx status code", and hides the
 * function's own `{ error: "..." }` body on the error's `context` Response.
 * This digs that out so the family sees "This recipe is too long to read in
 * one pass" instead of a status code. Falls back to `fallback` if the body
 * isn't JSON or carries no message.
 */
export async function functionErrorMessage(
  error: unknown,
  fallback: string
): Promise<string> {
  const message = (error as { message?: string } | null)?.message;
  let detail = message || fallback;
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const payload = await ctx.json();
      if (payload?.error) detail = String(payload.error);
    } catch {
      // body wasn't JSON — keep the generic message
    }
  }
  return detail;
}

export function photoUrl(photoPath: string | null): string | null {
  if (!photoPath) return null;
  const { data } = supabase.storage
    .from("recipe-photos")
    .getPublicUrl(photoPath);
  return data.publicUrl;
}
