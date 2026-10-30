import { visionRoute } from "@/lib/gemini";
import { normalizeCardioReading } from "@/lib/cardioStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Room for a slow Gemini call plus the fallback model (Vercel stops functions at this limit).
export const maxDuration = 60;

const SYSTEM_PROMPT =
  'You read cardio workout summaries: a StairMaster or treadmill console display, a smart watch screen, or a phone health app screenshot (e.g. Samsung Health). Return ONLY valid JSON: {"steps": number | null, "floors": number | null, "minutes": number | null, "calories": number | null}. Use only numbers clearly shown for this workout; null for anything not shown or unreadable — never estimate or convert. "floors" is floors or flights climbed. "minutes" is the workout duration in whole minutes (convert mm:ss or h:mm:ss to minutes, rounding down). No prose, no markdown fences.';

export async function POST(req: Request) {
  return visionRoute(req, {
    tag: "read-cardio",
    system: SYSTEM_PROMPT,
    prompt: "Read the cardio numbers in this image.",
    normalize: normalizeCardioReading,
  });
}
