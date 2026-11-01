import "server-only";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { CONSENT_HEADER, isFailure, newRequestId, readImageUpload, runVision, safeLog, type Generate } from "@/lib/aiSafety";
import { SESSION_COOKIE, nowSeconds, verifySession } from "@/lib/session";
import { sessionSecret } from "@/lib/passcode";
import { kvFromEnv } from "@/lib/kv";
import { takeAiCall } from "@/lib/guard";

/** This request's session id (for the per-session daily cap), or "anon" in local open dev. */
async function sessionId(req: Request) {
  const secret = sessionSecret();
  const raw = req.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  const v = secret ? await verifySession(raw, secret, nowSeconds()) : null;
  return v?.ok ? v.session.sid : "anon";
}

// Shared by the photo-reading routes. Server-only, so GEMINI_API_KEY never reaches the browser.
// See lib/aiSafety.ts for upload checks and what is (and isn't) logged.

const FALLBACK_MODEL = "gemini-flash-lite-latest";
const CALL_TIMEOUT_MS = 20_000;

const geminiGenerate =
  (apiKey: string): Generate =>
  async (model, { system, prompt, upload }) => {
    const m = new GoogleGenerativeAI(apiKey).getGenerativeModel(
      { model, systemInstruction: system, generationConfig: { responseMimeType: "application/json", temperature: 0 } },
      { timeout: CALL_TIMEOUT_MS },
    );
    const result = await m.generateContent([{ inlineData: { mimeType: upload.mimeType, data: upload.base64 } }, { text: prompt }]);
    return result.response.text();
  };

function reply(requestId: string, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "x-request-id": requestId, "cache-control": "no-store" } });
}

/**
 * One photo in → the model's JSON object, normalized by the caller → JSON out.
 * The browser must say the user confirmed sending the photo (CONSENT_HEADER); the image is
 * forwarded to Gemini and not kept.
 */
export async function visionRoute(
  req: Request,
  opts: { tag: string; system: string; prompt: string; allowPdf?: boolean; normalize: (raw: Record<string, unknown>) => unknown },
) {
  const requestId = newRequestId();
  if (req.headers.get(CONSENT_HEADER) !== "granted") {
    safeLog("warn", { tag: opts.tag, requestId, category: "no_consent" });
    return reply(requestId, { error: "Confirm sending this photo to the AI reader first.", requestId }, 428);
  }
  const upload = await readImageUpload(req, { allowPdf: opts.allowPdf });
  if (isFailure(upload)) {
    safeLog("warn", { tag: opts.tag, requestId, category: upload.category, status: upload.status });
    return reply(requestId, { error: upload.message, requestId }, upload.status);
  }

  const cap = await takeAiCall(kvFromEnv(), await sessionId(req));
  if (!cap.ok) {
    safeLog("warn", { tag: opts.tag, requestId, category: cap.reason === "session" ? "daily_cap_session" : "daily_cap_total" });
    return reply(requestId, { error: "Today's photo-reading limit is used up. It resets at midnight UTC — type the numbers in instead.", requestId }, 429);
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    safeLog("error", { tag: opts.tag, requestId, category: "not_configured" });
    return reply(requestId, { error: "Photo reading isn't set up on the server yet. Type the numbers in instead.", requestId }, 503);
  }
  const primary = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const result = await runVision({
    tag: opts.tag,
    requestId,
    system: opts.system,
    prompt: opts.prompt,
    upload,
    models: Array.from(new Set([primary, FALLBACK_MODEL])),
    generate: geminiGenerate(apiKey),
  });
  if (isFailure(result)) return reply(requestId, { error: result.message, requestId }, result.status);
  return reply(requestId, opts.normalize(result.data));
}
