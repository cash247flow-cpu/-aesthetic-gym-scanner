import { visionRoute } from "@/lib/gemini";
import { LABEL_SYSTEM_PROMPT, normalizeLabel } from "@/lib/nutrition/readings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Room for a slow Gemini call plus the fallback model (Vercel stops functions at this limit).
export const maxDuration = 60;

export async function POST(req: Request) {
  return visionRoute(req, {
    tag: "read-food-label",
    system: LABEL_SYSTEM_PROMPT,
    prompt: "Read the nutrition panel in this photo.",
    normalize: normalizeLabel,
  });
}
