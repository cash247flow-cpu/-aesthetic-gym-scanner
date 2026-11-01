import { visionRoute } from "@/lib/gemini";
import { PANTRY_SYSTEM_PROMPT, normalizePantry } from "@/lib/nutrition/readings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Room for a slow Gemini call plus the fallback model (Vercel stops functions at this limit).
export const maxDuration = 60;

export async function POST(req: Request) {
  return visionRoute(req, {
    tag: "read-pantry",
    system: PANTRY_SYSTEM_PROMPT,
    prompt: "List the foods you can see in this photo.",
    normalize: normalizePantry,
  });
}
