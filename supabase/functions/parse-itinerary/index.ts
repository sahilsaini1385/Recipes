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
        if (
          typeof obj.articleBody === "string" &&
          obj.articleBody.length > best.length
        ) {
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

// Keys whose values are article content even when short (venue names, day
// headings). Recall matters here — a dropped name is a dropped pin.
const CONTENT_KEYS = new Set([
  "hed",
  "dek",
  "dangerousdek",
  "dangeroushed",
  "name",
  "title",
  "heading",
  "subhed",
  "description",
  "shortdescription",
  "longdescription",
  "caption",
  "text",
  "body",
  "content",
  "articlebody",
  "excerpt",
  "summary",
]);
// Subtrees that are never the article: site chrome, styling, recirculation.
const SKIP_KEYS = new Set([
  "recirc",
  "recircs",
  "related",
  "relatedvideo",
  "relatedaudio",
  "recommendations",
  "newsletter",
  "footer",
  "nav",
  "navigation",
  "header",
  "headerprops",
  "promo",
  "ads",
  "advertisement",
  "seo",
  "meta",
  "design",
  "stylesheet",
  "styles",
  "theme",
  "sctheme",
  "assets",
  "fonts",
  "typography",
  "config",
  "featureflags",
  "env",
  "locale",
  "tracking",
  "analytics",
  "socialmedia",
  "breadcrumb",
  "componentconfig",
  "renditions",
]);
const CSS_HINTS = [
  "minmax(",
  "1fr",
  "max-content",
  "repeat(",
  "@font-face",
  "grid-template",
  "var(--",
];

function isJunk(s: string): boolean {
  if (CSS_HINTS.some((h) => s.includes(h))) return true;
  if ((s.match(/"/g) ?? []).length >= 2) return true; // css grid-area lists
  if (s.startsWith("Image may contain")) return true;
  if (
    /^\s*[<{@]|^https?:\/\/|^data:|^[\w./-]+\.(js|css|png|jpe?g|svg|woff2?)\b/.test(
      s,
    )
  ) {
    return true;
  }
  if ((s.match(/[{;]/g) ?? []).length > 2) return true;
  if (s.length < 20 && /^[a-z][a-z0-9-]*$/.test(s)) return true;
  const letters = (s.match(/\p{L}/gu) ?? []).length;
  return letters / Math.max(s.length, 1) < 0.5;
}

/**
 * Publishers on Next.js/Nuxt (Condé Nast among them) render the article
 * client-side: the served HTML is mostly navigation and the real text lives
 * in a JSON state blob. Harvest content-bearing strings out of that tree.
 */
function harvestJson(
  node: unknown,
  key = "",
  out: string[] = [],
  seen = new Set<string>(),
): string[] {
  if (Array.isArray(node)) {
    for (const v of node) harvestJson(v, key, out, seen);
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (!SKIP_KEYS.has(k.toLowerCase())) harvestJson(v, k, out, seen);
    }
  } else if (typeof node === "string") {
    const txt = decodeEntities(node.replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    if (!txt || isJunk(txt)) return out;
    const keyed =
      CONTENT_KEYS.has(key.toLowerCase()) &&
      txt.length >= 2 &&
      txt.length <= 6000;
    const prose = txt.length >= 25 && (txt.match(/ /g) ?? []).length >= 3;
    if (keyed || prose) {
      const norm = txt.toLowerCase();
      if (!seen.has(norm)) {
        seen.add(norm);
        out.push(txt);
      }
    }
  }
  return out;
}

function jsonStateText(html: string): string {
  const patterns = [
    /window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/i,
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
    /window\.__NUXT__\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/i,
  ];
  const parts: string[] = [];
  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (!m) continue;
    try {
      parts.push(...harvestJson(JSON.parse(m[1])));
    } catch {
      // not valid JSON on its own — skip this blob
    }
  }
  return parts.join("\n");
}

/** Chars living in sentence-like lines; navigation and menus score ~0. */
function proseScore(text: string): number {
  let total = 0;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if ((line.match(/ /g) ?? []).length >= 7 && /[.!?]["')\]]?$/.test(line)) {
      total += line.length;
    }
  }
  return total;
}

function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(
        /<(script|style|noscript|template|svg|iframe|head)[\s\S]*?<\/\1>/gi,
        " ",
      )
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(
        /<(br|\/p|\/div|\/li|\/h[1-6]|\/section|\/article)[^>]*>/gi,
        "\n",
      )
      .replace(/<[^>]+>/g, " "),
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
    html.match(
      /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)/i,
    ) ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : "";

  // Try every extraction strategy and keep whichever yields the most real
  // prose. Length alone is a trap: a page of navigation is long and useless.
  const candidates = [
    jsonLdArticleBody(html),
    jsonStateText(html),
    stripHtml(html),
  ];
  let body = "";
  let best = -1;
  for (const candidate of candidates) {
    const score = proseScore(candidate);
    if (score > best) {
      best = score;
      body = candidate;
    }
  }

  if (best < 800) {
    throw new FetchFailed(
      "We couldn't read the article from that page (it may be paywalled or " +
        "rendered with JavaScript). Paste the article text instead.",
    );
  }
  return `${title}\n\n${body}`.slice(0, MAX_ARTICLE_CHARS);
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
    },
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
        422,
      );
    }
    return json(itinerary);
  } catch (e) {
    console.error("parse-itinerary failed:", e);
    return json({ error: (e as Error).message ?? "Parse failed" }, 502);
  }
});
