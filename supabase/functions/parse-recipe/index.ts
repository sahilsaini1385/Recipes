// Supabase Edge Function: parse-recipe
//
// Accepts pasted recipe text OR a base64 photo/PDF and returns the recipe in
// the app's strict ingredient/step JSON schema. The Anthropic API key lives
// only here as a Supabase secret (`supabase secrets set ANTHROPIC_API_KEY=...`)
// — it is never exposed to the client.
//
// Deploy: supabase functions deploy parse-recipe

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const CATEGORIES = [
  "Appetizers & Party Food",
  "Baby & Toddler",
  "Bread",
  "Breakfast",
  "Dessert",
  "Drinks",
  "Entrees",
  "Salads",
  "Dressings & Sauces",
  "Sides",
  "Soup",
];

const RECIPE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "category",
    "credit",
    "source_url",
    "base_servings",
    "servings_estimated",
    "ingredients",
    "steps",
    "tags",
    "notes",
  ],
  properties: {
    title: { type: "string" },
    category: { type: "string", enum: CATEGORIES },
    credit: { type: "string" },
    source_url: { type: ["string", "null"] },
    base_servings: { type: "integer" },
    servings_estimated: { type: "boolean" },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "raw",
          "quantity",
          "quantity_max",
          "unit",
          "item",
          "note",
          "scalable",
        ],
        properties: {
          raw: { type: "string" },
          quantity: { type: ["number", "null"] },
          quantity_max: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          item: { type: "string" },
          note: { type: "string" },
          scalable: { type: "boolean" },
        },
      },
    },
    steps: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
    notes: { type: ["string", "null"] },
  },
};

const SYSTEM_PROMPT = `You convert family recipes into structured JSON.

Rules:
- "raw" is the original ingredient line, kept verbatim.
- Parse a leading amount into "quantity" as a number ("1/2" -> 0.5, "One" -> 1).
  If the line has no parseable leading number ("Large can chili beans in
  sauce", "Salt and pepper, to taste"), set quantity to null. Never invent a
  number.
- For ranges like "2 to 3 cloves" or "36-40", set quantity to the low end and
  quantity_max to the high end; otherwise quantity_max is null.
- "unit" is the measurement word if present ("cup", "tsp", "stick", "can"),
  else null. "item" is the ingredient name. "note" holds trailing qualifiers
  like "to taste", "divided", "optional" (empty string if none).
- "scalable" is true only when quantity is a real number.
- steps: the instructions as an ordered array of plain strings, one action per
  step, no step numbers in the text.
- If the source states a yield or servings, use it for base_servings and set
  servings_estimated to false. If not, estimate a reasonable number (default 4,
  or infer from quantities, e.g. "yields 36 cookies" -> 36) and set
  servings_estimated to true.
- category must be one of the allowed values; pick the best fit.
- credit: the person or source the recipe is attributed to, if stated, else "".
- tags: a few lowercase tags like "vegetarian", "slow-cooker", "make-ahead".
- notes: any tips or extra commentary from the source, else null.
- If the input is not a recipe at all, still return the schema with an empty
  title and empty ingredients/steps.`;

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // Require a signed-in family member so the LLM endpoint can't be abused.
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
  const { data: isFamily } = await supabase.rpc("is_family");
  if (!isFamily) {
    return json({ error: "Your email is not on the family list" }, 403);
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return json({ error: "ANTHROPIC_API_KEY secret is not set" }, 500);
  }

  let payload: {
    text?: string;
    file?: { data: string; media_type: string };
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const content: Array<Record<string, unknown>> = [];
  if (payload.file?.data) {
    const mediaType = payload.file.media_type || "image/jpeg";
    if (mediaType === "application/pdf") {
      content.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: payload.file.data,
        },
      });
    } else {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType as
            | "image/jpeg"
            | "image/png"
            | "image/gif"
            | "image/webp",
          data: payload.file.data,
        },
      });
    }
    content.push({
      type: "text",
      text: "Extract the recipe from this document into the JSON schema.",
    });
  } else if (payload.text?.trim()) {
    content.push({
      type: "text",
      text: `Extract this recipe into the JSON schema:\n\n${payload.text.trim()}`,
    });
  } else {
    return json({ error: "Provide `text` or `file`" }, 400);
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
      // Structured outputs guarantee the reply is valid JSON for our schema.
      output_config: {
        format: { type: "json_schema", schema: RECIPE_SCHEMA },
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
    return json(JSON.parse(textBlock.text));
  } catch (e) {
    console.error("parse-recipe failed:", e);
    return json({ error: (e as Error).message ?? "Parse failed" }, 502);
  }
});
