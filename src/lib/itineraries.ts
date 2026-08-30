import { supabase, isSupabaseConfigured } from "./supabase";
import { slugify } from "./slug";
import type { ItineraryData, ItineraryRecord } from "./types";
import { sampleItinerary, SAMPLE_SLUG } from "./sampleParis";

export interface ItinerarySummary {
  id: string;
  slug: string;
  title: string;
  destination: string;
  created_at: string;
}

export async function listItineraries(): Promise<ItinerarySummary[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("itineraries")
    .select("id, slug, title, destination, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function getItinerary(
  slug: string
): Promise<ItineraryRecord | null> {
  if (slug === SAMPLE_SLUG) return sampleItinerary;
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("itineraries")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as ItineraryRecord) ?? null;
}

export async function saveItinerary(
  itinerary: ItineraryData,
  sourceUrl: string | null
): Promise<string> {
  const slug = `${slugify(itinerary.title).slice(0, 60) || "itinerary"}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  const { error } = await supabase.from("itineraries").insert({
    slug,
    title: itinerary.title,
    destination: itinerary.destination,
    source_url: sourceUrl,
    data: itinerary,
  });
  if (error) throw error;
  return slug;
}

export async function deleteItinerary(id: string): Promise<void> {
  const { error } = await supabase.from("itineraries").delete().eq("id", id);
  if (error) throw error;
}

export class ArticleFetchError extends Error {}

/**
 * Sends the article (by URL or pasted text) to the parse-itinerary edge
 * function, which fetches it server-side and asks Claude for the structured
 * itinerary. Throws ArticleFetchError when the site blocked our fetch so the
 * UI can suggest pasting the text instead.
 */
export async function parseArticle(input: {
  url?: string;
  text?: string;
}): Promise<ItineraryData> {
  const { data, error } = await supabase.functions.invoke("parse-itinerary", {
    body: input,
  });
  if (error) {
    // supabase-js wraps non-2xx responses; the function's JSON error body is
    // on error.context (a Response) when available.
    let message = error.message ?? "Parsing failed";
    let code = "";
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const body = await ctx.json();
        if (body?.error) message = body.error;
        if (body?.code) code = body.code;
      } catch {
        // keep the generic message
      }
    }
    if (code === "FETCH_FAILED") throw new ArticleFetchError(message);
    throw new Error(message);
  }
  return data as ItineraryData;
}
