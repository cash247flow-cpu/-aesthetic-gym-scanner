import { visionRoute } from "@/lib/gemini";
import { normalizeIngredients } from "@/lib/ingredientsReading";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Room for a slow Gemini call plus the fallback model (Vercel stops functions at this limit).
export const maxDuration = 60;

const SYSTEM_PROMPT =
  'You read the ingredient list of a meal or recipe from a screenshot (for example a Cronometer recipe, a recipe app or a written list). Return ONLY valid JSON: {"ingredients": [{"name": string, "amount": string | null, "type": "protein" | "fiber" | "carbs" | "fat" | "supplement" | null}]}. One entry per ingredient line, in the order shown. "name" is the food as written; "amount" is the quantity with its unit exactly as shown (e.g. "180 g", "1 cup"), or null if none is shown — never estimate. "type" is the food\'s main role: protein foods, fiber (vegetables, leafy greens), carbs (grains, legumes, fruit, starches), fat (oils, avocado, nuts), supplement (e.g. psyllium), or null if unsure. Ignore anything that is not an ingredient (titles, totals, nutrient tables, names of people). At most 15 entries. No prose, no markdown fences.';

export async function POST(req: Request) {
  return visionRoute(req, {
    tag: "read-ingredients",
    system: SYSTEM_PROMPT,
    prompt: "List the ingredients in this image.",
    normalize: normalizeIngredients,
  });
}
