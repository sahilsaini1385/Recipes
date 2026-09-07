// Supabase Edge Function: estimate-costs
//
// Fills in rough USD cost-per-serving estimates for recipes that don't have
// one yet, a small batch per call. The site calls this quietly in the
// background when a family member visits, until every recipe is priced.
// Uses the same ANTHROPIC_API_KEY secret as parse-recipe.

import Anthropic from "npm:@anthropic-ai/sdk@0.124.0";
import { createClient } from "npm:@supabase/supabase-js@2";

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

const BATCH_SIZE = 8;

const ESTIMATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["estimates"],
  properties: {
    estimates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "total_cost_usd"],
        properties: {
          id: { type: "string" },
          total_cost_usd: { type: "number" },
        },
      },
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // Family members only — their JWT also scopes the recipe updates via RLS.
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
  if (userError || !userData.user) return json({ error: "Sign in required" }, 401);
  const { data: isFamily } = await supabase.rpc("is_family");
  if (!isFamily) {
    return json({ error: "Your email is not on the family list" }, 403);
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return json({ error: "ANTHROPIC_API_KEY secret is not set" }, 500);
  }

  const { data: recipes, error: readError } = await supabase
    .from("recipes")
    .select("id, title, base_servings, ingredients")
    .is("cost_per_serving", null)
    .limit(BATCH_SIZE);
  if (readError) return json({ error: readError.message }, 500);
  if (!recipes || recipes.length === 0) {
    return json({ updated: 0, remaining: 0 });
  }

  const recipeBlocks = recipes
    .map((r) => {
      const lines = (r.ingredients as Array<{ raw: string }>)
        .map((i) => `- ${i.raw}`)
        .join("\n");
      const servings = Math.max(1, r.base_servings ?? 4);
      return `id: ${r.id}\ntitle: ${r.title}\nservings: ${servings}\ningredients:\n${lines}`;
    })
    .join("\n\n---\n\n");

  const anthropic = new Anthropic({ apiKey });
  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      system:
        "You estimate grocery costs. For each recipe, estimate the total cost " +
        "in USD of making it ONCE at the stated serving count, using typical " +
        "US supermarket prices. Rules:\n" +
        "- Count only the portion actually used: 1 tbsp from a $4 spice jar " +
        "costs cents, not $4. Never charge the full price of a jar, bottle, " +
        "bag of flour, or stick of butter unless the recipe uses it all.\n" +
        "- Ingredients with no stated amount are almost always small " +
        "(dredging flour, a spoonful of capers, seasoning): price them at " +
        "well under a dollar.\n" +
        "- If amounts say 'per person' or 'per serving', multiply by the " +
        "stated serving count to get the recipe total.\n" +
        "- Pantry staples like salt, pepper, and water are near zero.\n" +
        "Rough estimates are expected — don't agonize.",
      messages: [
        {
          role: "user",
          content: `Estimate the total ingredient cost for each recipe:\n\n${recipeBlocks}`,
        },
      ],
      output_config: {
        format: { type: "json_schema", schema: ESTIMATE_SCHEMA },
      },
      // deno-lint-ignore no-explicit-any
    } as any);

    if (response.stop_reason === "refusal") {
      return json({ error: "Estimation was declined" }, 422);
    }
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return json({ error: "No output produced" }, 502);
    }
    const { estimates } = JSON.parse(textBlock.text) as {
      estimates: Array<{ id: string; total_cost_usd: number }>;
    };

    let updated = 0;
    for (const est of estimates) {
      const recipe = recipes.find((r) => r.id === est.id);
      if (!recipe || !isFinite(est.total_cost_usd)) continue;
      const servings = Math.max(1, recipe.base_servings ?? 4);
      const perServing =
        Math.round((est.total_cost_usd / servings) * 100) / 100;
      const { error: updateError } = await supabase
        .from("recipes")
        .update({ cost_per_serving: Math.max(0.01, perServing) })
        .eq("id", est.id);
      if (!updateError) updated++;
    }

    const { count } = await supabase
      .from("recipes")
      .select("id", { count: "exact", head: true })
      .is("cost_per_serving", null);

    return json({ updated, remaining: count ?? 0 });
  } catch (e) {
    console.error("estimate-costs failed:", e);
    return json({ error: (e as Error).message }, 502);
  }
});
