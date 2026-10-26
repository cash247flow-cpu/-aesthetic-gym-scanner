import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { normalizeEquipment } from "@/lib/equipment";

// Server-only: this file never ships to the browser, so GEMINI_API_KEY stays private.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT =
  'You are a gym equipment identifier. Look at the photo and return ONLY valid JSON: {"equipment": ["..."]}. Use short canonical names from this list: cable machine, lat pulldown, dumbbells, barbell, bench, incline bench, decline bench, squat rack, ez bar, rope attachment, neutral grip attachment, ankle strap, smith machine, hack squat machine, leg press, leg extension machine, seated leg curl machine, lying leg curl machine, calf raise machine, chest press machine, reverse pec deck, lateral raise machine, preacher curl machine, crunch machine, abductor machine, pull-up bar, captains chair. List only equipment clearly visible. If a bench is adjustable (a backrest on a hinge with an adjustment ladder, row of holes or pop-pin), list BOTH "bench" and "incline bench", whatever angle it is currently set to. A fixed flat bench is only "bench". No prose, no markdown fences.';

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not set. Add it to .env.local and restart the dev server." },
      { status: 500 },
    );
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const value = form.get("image");
    if (value instanceof File) file = value;
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data with an 'image' field." }, { status: 400 });
  }

  if (!file) return NextResponse.json({ error: "No image uploaded." }, { status: 400 });
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image is larger than 10 MB." }, { status: 413 });
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  const genAI = new GoogleGenerativeAI(apiKey);
  const primary = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const models = Array.from(new Set([primary, FALLBACK_MODEL]));
  let lastStatus: number | undefined;

  // Gemini returns 503 (or just stalls) during demand spikes: cap each call, then fall back.
  for (const name of models) {
    try {
      const model = genAI.getGenerativeModel(
        {
          model: name,
          systemInstruction: SYSTEM_PROMPT,
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        },
        { timeout: CALL_TIMEOUT_MS },
      );
      const result = await model.generateContent([
        { inlineData: { mimeType: file.type, data: base64 } },
        { text: "Identify the gym equipment in this photo." },
      ]);
      const equipment = parseEquipment(result.response.text());
      return NextResponse.json({ equipment });
    } catch (err) {
      lastStatus = (err as { status?: number }).status;
      console.error(`[identify] ${name} failed:`, lastStatus ?? "timeout/network", (err as Error).message);
      if (lastStatus && !RETRYABLE.has(lastStatus)) break;
    }
  }

  const message =
    lastStatus === 429
      ? "Gemini quota reached for this API key. Wait a minute (or until tomorrow on the free tier) and try again."
      : lastStatus === 503
        ? "Gemini is overloaded right now. Try again in a minute."
        : "Couldn't read the photo. Try again.";
  return NextResponse.json({ error: message }, { status: 502 });
}

const FALLBACK_MODEL = "gemini-flash-lite-latest";
const CALL_TIMEOUT_MS = 20_000;
const RETRYABLE = new Set([429, 500, 503]);

/** Tolerates stray markdown fences or prose around the JSON, then whitelists names. */
function parseEquipment(text: string): string[] {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return [];
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return normalizeEquipment(parsed?.equipment);
  } catch {
    console.warn("[identify] Could not parse Gemini output:", text);
    return [];
  }
}
