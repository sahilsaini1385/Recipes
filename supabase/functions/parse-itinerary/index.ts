// Supabase Edge Function: parse-itinerary
//
// Accepts a travel-article URL (fetched server-side, so the browser never
// hits CORS or bot walls) or pasted article text, and returns a structured
// day-by-day itinerary with coordinates for every stop. The Anthropic API
// key lives only here as a Supabase secret
// (`supabase secrets set ANTHROPIC_API_KEY=...`) — it never reaches the
// client.
//
// Deploy: supabase functions deploy parse-itinerary

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const STOP_KINDS = [
  "sight",
  "museum",
  "restaurant",
  "cafe",
  "bakery",
  "bar",
  "hotel",
  "shop",
  "activity",
  "neighborhood",
  "viewpoint",
  "other",
];

const TIMES_OF_DAY = ["morning", "afternoon", "evening", "flexible"];

const STOP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "name",
    "kind",
    "description",
    "area",
    "address",
    "lat",
    "lng",
    "approx",
    "time_of_day",
    "tip",
  ],
  properties: {
    name: { type: "string" },
    kind: { type: "string", enum: STOP_KINDS },
    description: { type: "string" },
    area: { type: "string" },
    address: { type: "string" },
    lat: { type: "number" },
    lng: { type: "number" },
    approx: { type: "boolean" },
    time_of_day: { type: "string", enum: TIMES_OF_DAY },
    tip: { type: ["string", "null"] },
  },
};

const ITINERARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "destination", "summary", "days", "tips"],
  properties: {
    title: { type: "string" },
    destination: { type: "string" },
    summary: { type: "string" },
    days: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["day", "title", "stops"],
        properties: {
          day: { type: "integer" },
          title: { type: "string" },
          stops: { type: "array", items: STOP_SCHEMA },
        },
      },
    },
    tips: { type: "array", items: { type: "string" } },
  },
};

const SYSTEM_PROMPT = `You turn travel articles into structured, mappable itineraries.

Rules:
- Include every place the article genuinely recommends visiting, eating at, or staying at — and nothing it doesn't. Never invent stops or pad days.
- If the article is organized by days ("Day 1", "morning/afternoon/evening"), keep that structure exactly. Otherwise group the places into 1–4 sensible days by geography, ordering each day morning → evening and to minimize backtracking on foot.
- "day" numbers start at 1; "title" is a short label for the day's theme or area.
- lat/lng: the venue's real coordinates, from your knowledge of the place. Be precise for well-known venues. If you only know the neighborhood, use the neighborhood's center and set "approx" to true; otherwise "approx" is false. Never place a stop at 0,0 or guess a different city.
- "address": the street address if you know it confidently, else "".
- "area": the neighborhood or district, else "".
- "description": one or two sentences conveying what the article says about the place, paraphrased in your own words. Do not copy sentences verbatim from the article.
- "tip": the article's specific, practical advice for that stop (timing, what to order, how to book), paraphrased; null if there is none.
- "tips": article-level advice not tied to one stop (getting around, seasons, reservations, money).
- "destination" is "City, Country". "title" is a short itinerary name that includes the destination. "summary" is one or two sentences on the trip's flavor.
- If the text is not a travel article about visitable places, return an empty "days" array and an empty "title".`;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

class FetchFailed extends Error {}

const MAX_ARTICLE_CHARS = 80_000;

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&#8217;/g, "'")
    .replace(/&ldquo;|&#8220;|&rdquo;|&#8221;/g, '"')
    .replace(/&mdash;|&#8212;/g, "—")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

/** Longest articleBody found in the page's JSON-LD blocks, if any. */
function jsonLdArticleBody(html: string): string {
  let best = "";
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const walk = (node: unknown) => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) {
          node.forEach(walk);
          return;
        }
        const obj = node as Record<string, unknown>;
        if (typeof obj.articleBody === "string" && obj.articleBody.length > best.length) {
          best = obj.articleBody;
        }
        Object.values(obj).forEach(walk);
      };
      walk(JSON.parse(m[1]));
    } catch {
      // malformed JSON-LD block — skip it
    }
  }
  return best;
}

function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|template|svg|iframe|head)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/section|\/article)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

async function fetchArticle(rawUrl: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new FetchFailed("That doesn't look like a valid link.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new FetchFailed("Only http(s) links are supported.");
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^(\d{1,3}\.){3}\d{1,3}$/.test(host) ||
    host.includes(":") // IPv6 literal
  ) {
    throw new FetchFailed("That address can't be fetched.");
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
  } catch {
    throw new FetchFailed("The article couldn't be fetched.");
  }
  if (!res.ok) {
    throw new FetchFailed(`The site answered with ${res.status}.`);
  }
  const html = await res.text();

  const titleMatch =
    html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)/i) ??
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : "";

  // Publishers often embed the full article body in JSON-LD even when the
  // rendered page is paywalled or JS-heavy — prefer it when substantial.
  const ldBody = jsonLdArticleBody(html);
  const body = ldBody.length > 800 ? ldBody : stripHtml(html);

  const text = `${title}\n\n${body}`.slice(0, MAX_ARTICLE_CHARS);
  if (body.length < 500) {
    throw new FetchFailed(
      "We couldn't read enough text from that page (it may be paywalled or rendered with JavaScript)."
    );
  }
  return text;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // Require a signed-in, allowlisted user so the LLM endpoint can't be abused.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: {
        headers: { Authorization: req.headers.get("Authorization") ?? "" },
      },
    }
  );
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: "Sign in required" }, 401);
  }
  const { data: allowed } = await supabase.rpc("is_family");
  if (!allowed) {
    return json({ error: "Your email is not on the allowlist" }, 403);
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return json({ error: "ANTHROPIC_API_KEY secret is not set" }, 500);
  }

  let payload: { url?: string; text?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  let article: string;
  let sourceNote: string;
  if (payload.url?.trim()) {
    try {
      article = await fetchArticle(payload.url.trim());
      sourceNote = `Source URL: ${payload.url.trim()}`;
    } catch (e) {
      if (e instanceof FetchFailed) {
        return json({ error: e.message, code: "FETCH_FAILED" }, 422);
      }
      throw e;
    }
  } else if (payload.text?.trim()) {
    article = payload.text.trim().slice(0, MAX_ARTICLE_CHARS);
    sourceNote = "Source: pasted text";
  } else {
    return json({ error: "Provide `url` or `text`" }, 400);
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `${sourceNote}\n\nTurn this travel article into an itinerary in the JSON schema:\n\n${article}`,
        },
      ],
      // Structured outputs guarantee the reply is valid JSON for our schema.
      output_config: {
        format: { type: "json_schema", schema: ITINERARY_SCHEMA },
      },
      // deno-lint-ignore no-explicit-any
    } as any);

    if (response.stop_reason === "refusal") {
      return json({ error: "The model declined to process this input" }, 422);
    }
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return json({ error: "No output produced" }, 502);
    }
    const itinerary = JSON.parse(textBlock.text);
    if (!itinerary.days?.length) {
      return json(
        {
          error:
            "That didn't look like a travel article with visitable places — try a destination guide.",
        },
        422
      );
    }
    return json(itinerary);
  } catch (e) {
    console.error("parse-itinerary failed:", e);
    return json({ error: (e as Error).message ?? "Parse failed" }, 502);
  }
});
