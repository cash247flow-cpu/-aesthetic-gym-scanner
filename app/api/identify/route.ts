import { NextResponse } from "next/server";
import { askGeminiJson, readImageUpload } from "@/lib/gemini";
import { normalizeEquipment } from "@/lib/equipment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Room for a slow Gemini call plus the fallback model (Vercel stops functions at this limit).
export const maxDuration = 60;

const SYSTEM_PROMPT =
  'You are a gym equipment identifier. Look at the photo and return ONLY valid JSON: {"equipment": ["..."]}. Use short canonical names from this list: cable machine, lat pulldown, dumbbells, barbell, bench, incline bench, decline bench, squat rack, ez bar, rope attachment, neutral grip attachment, ankle strap, smith machine, hack squat machine, leg press, leg extension machine, seated leg curl machine, lying leg curl machine, calf raise machine, chest press machine, reverse pec deck, lateral raise machine, preacher curl machine, crunch machine, abductor machine, pull-up bar, captains chair, t-bar row machine. List only equipment clearly visible. If a bench is adjustable (a backrest on a hinge with an adjustment ladder, row of holes or pop-pin), list BOTH "bench" and "incline bench", whatever angle it is currently set to. A fixed flat bench is only "bench". No prose, no markdown fences.';

export async function POST(req: Request) {
  const image = await readImageUpload(req);
  if (image instanceof NextResponse) return image;

  const result = await askGeminiJson({
    tag: "identify",
    system: SYSTEM_PROMPT,
    prompt: "Identify the gym equipment in this photo.",
    image,
  });
  if (result instanceof NextResponse) return result;

  // Whitelist names so the planner only ever sees canonical equipment.
  return NextResponse.json({ equipment: normalizeEquipment(result.data.equipment) });
}
