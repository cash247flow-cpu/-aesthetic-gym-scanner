import "server-only";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Shared by the image routes. Server-only, so GEMINI_API_KEY never reaches the browser.

const MAX_BYTES = 10 * 1024 * 1024;
const FALLBACK_MODEL = "gemini-flash-lite-latest";
const CALL_TIMEOUT_MS = 20_000;
const RETRYABLE = new Set([429, 500, 503]);

type Upload = { mimeType: string; base64: string };

/** Pulls the "image" field out of a multipart request, or returns the error response to send. */
export async function readImageUpload(req: Request, opts: { allowPdf?: boolean } = {}): Promise<Upload | NextResponse> {
  let file: File | null = null;
  try {
    const form = await req.formData();
    const value = form.get("image");
    if (value instanceof File) file = value;
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data with an 'image' field." }, { status: 400 });
  }

  if (!file) return NextResponse.json({ error: "No image uploaded." }, { status: 400 });
  const isPdf = file.type === "application/pdf";
  if (!file.type.startsWith("image/") && !(opts.allowPdf && isPdf)) {
    return NextResponse.json({ error: opts.allowPdf ? "File must be an image or PDF." : "File must be an image." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image is larger than 10 MB." }, { status: 413 });
  }
  return { mimeType: file.type, base64: Buffer.from(await file.arrayBuffer()).toString("base64") };
}

/**
 * Sends one image + instruction to Gemini and returns the parsed JSON object, or the error
 * response to send. Gemini returns 503 (or just stalls) during demand spikes: each call is
 * capped, then the fallback model is tried.
 */
export async function askGeminiJson(opts: {
  tag: string;
  system: string;
  prompt: string;
  image: Upload;
}): Promise<{ data: Record<string, unknown> } | NextResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not set. Add it to .env.local and restart the dev server." },
      { status: 500 },
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const primary = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const models = Array.from(new Set([primary, FALLBACK_MODEL]));
  let lastStatus: number | undefined;
  let lastMessage = "";

  for (const name of models) {
    try {
      const model = genAI.getGenerativeModel(
        {
          model: name,
          systemInstruction: opts.system,
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        },
        { timeout: CALL_TIMEOUT_MS },
      );
      const result = await model.generateContent([
        { inlineData: { mimeType: opts.image.mimeType, data: opts.image.base64 } },
        { text: opts.prompt },
      ]);
      const text = result.response.text();
      const data = parseJsonObject(text);
      if (!data) console.warn(`[${opts.tag}] Could not parse Gemini output:`, text);
      return { data: data ?? {} };
    } catch (err) {
      lastStatus = (err as { status?: number }).status;
      lastMessage = (err as Error).message ?? "";
      console.error(`[${opts.tag}] ${name} failed:`, lastStatus ?? "timeout/network", (err as Error).message);
      if (lastStatus && !RETRYABLE.has(lastStatus)) break;
    }
  }

  const badKey = /api key|api_key|permission|unauthori[sz]ed/i.test(lastMessage);
  const message =
    lastStatus === 429
      ? "Gemini quota reached for this API key. Wait a minute (or until tomorrow on the free tier) and try again."
      : lastStatus === 503
        ? "Gemini is overloaded right now. Try again in a minute."
        : badKey || lastStatus === 401 || lastStatus === 403
          ? "Gemini rejected the API key. Check GEMINI_API_KEY in your hosting settings (no spaces, current key), then redeploy."
          : lastStatus === 404
            ? `Gemini model "${primary}" wasn't found. Check GEMINI_MODEL, or remove it to use the default.`
            : lastStatus === undefined
              ? "Gemini didn't answer in time (or couldn't be reached). Try again in a minute."
              : `Couldn't read the photo (Gemini error ${lastStatus}). Try again.`;
  return NextResponse.json({ error: message }, { status: 502 });
}

/** Tolerates stray markdown fences or prose around the JSON object. */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
