import { NextResponse } from "next/server";
import { askGeminiJson, readImageUpload } from "@/lib/gemini";
import { normalizeScaleReading } from "@/lib/scaleReading";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT =
  'You read bathroom scale displays and body-composition scale reports. Return ONLY valid JSON: {"kind": "scale" | "report" | "unknown", "date": "YYYY-MM-DD" | null, "weight": number | null, "unit": "lb" | "kg" | null, "bodyFatPercent": number | null, "muscleMass": number | null, "bmi": number | null, "visceralFat": number | null, "bmr": number | null}. "scale" = a photo of a scale\'s display; "report" = a printed or app body-composition report. Use only numbers clearly shown; use null for anything not shown or unreadable — never estimate. "weight" is total body weight. "bodyFatPercent" is body fat percentage (also called fat ratio). "muscleMass" is skeletal muscle mass if shown, otherwise muscle mass, in the same unit as weight. "date" is the measurement date printed on a report, else null. No prose, no markdown fences.';

export async function POST(req: Request) {
  const image = await readImageUpload(req, { allowPdf: true });
  if (image instanceof NextResponse) return image;

  const result = await askGeminiJson({
    tag: "read-scale",
    system: SYSTEM_PROMPT,
    prompt: "Read the measurements in this image.",
    image,
  });
  if (result instanceof NextResponse) return result;

  return NextResponse.json(normalizeScaleReading(result.data));
}
