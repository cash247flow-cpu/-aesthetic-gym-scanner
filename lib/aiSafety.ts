// Safety layer for the photo-reading routes (gym, scale/report, cardio):
//  • uploads: request-size cap, one file only, real format check from the file's bytes (the
//    browser's MIME type and file name are ignored), risky PDFs refused. Nothing is stored or
//    decoded on the server — the bytes go straight to the AI service and are then dropped.
//  • logs: one allow-listed JSON line per event — tag, request id, category, status, sizes.
//    Never model output, image bytes, file names or user values.
//  • the AI call itself (runVision), with the model call injected so it can be tested offline.

export const MAX_FILE_BYTES = 4 * 1024 * 1024; // phones send ≤ ~1.5 MB after downscaling
export const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 64 * 1024; // file + multipart overhead
export const CONSENT_HEADER = "x-ai-consent";

export type Sniffed = { mime: "image/jpeg" | "image/png" | "image/webp" | "image/heic" | "image/heif" | "application/pdf" };
export type Upload = { mimeType: Sniffed["mime"]; base64: string; bytes: number };
export type Failure = { status: number; category: string; message: string };

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

/** The file's real format from its first bytes, or null if it isn't one we accept. */
export function sniff(b: Uint8Array): Sniffed | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg" };
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return { mime: "image/png" };
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return { mime: "image/webp" };
  if (b.length >= 12 && ascii(b, 4, 8) === "ftyp") {
    const brand = ascii(b, 8, 12);
    if (["heic", "heix", "heim", "heis", "hevc", "hevx"].includes(brand)) return { mime: "image/heic" };
    if (["mif1", "msf1", "heif"].includes(brand)) return { mime: "image/heif" };
  }
  if (b.length >= 5 && ascii(b, 0, 5) === "%PDF-") return { mime: "application/pdf" };
  return null;
}

/** PDFs that can run script, launch apps or carry attachments are refused. */
export function pdfLooksUnsafe(b: Uint8Array): boolean {
  let text = "";
  for (let i = 0; i < b.length; i += 65536) text += String.fromCharCode(...b.subarray(i, Math.min(b.length, i + 65536)));
  return /\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia|XFA)\b/.test(text);
}

/** Read at most `limit` bytes of a request body; null if it's bigger. */
export async function readCapped(req: Request, limit: number): Promise<Uint8Array | null> {
  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

const fail = (status: number, category: string, message: string): Failure => ({ status, category, message });

/** Validates the multipart upload ("image" field, exactly one file). */
export async function readImageUpload(req: Request, opts: { allowPdf?: boolean } = {}): Promise<Upload | Failure> {
  const body = await readCapped(req, MAX_REQUEST_BYTES);
  if (!body) return fail(413, "too_large", "That file is too big — the limit is 4 MB.");
  let form: FormData;
  try {
    form = await new Request("http://local/", { method: "POST", headers: { "content-type": req.headers.get("content-type") ?? "" }, body: body as BodyInit }).formData();
  } catch {
    return fail(400, "bad_form", "Expected one photo in the upload.");
  }
  const entries = [...form.entries()];
  const files = entries.filter(([, v]) => typeof v !== "string");
  if (entries.length !== 1 || files.length !== 1 || files[0][0] !== "image") return fail(400, "bad_form", "Expected exactly one photo.");
  const file = files[0][1] as File;
  if (file.size === 0) return fail(400, "empty", "The file is empty.");
  if (file.size > MAX_FILE_BYTES) return fail(413, "too_large", "That file is too big — the limit is 4 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind || (kind.mime === "application/pdf" && !opts.allowPdf)) {
    return fail(415, "unsupported_type", opts.allowPdf ? "Use a JPEG, PNG, WebP or HEIC photo, or a PDF." : "Use a JPEG, PNG, WebP or HEIC photo.");
  }
  if (kind.mime === "application/pdf" && pdfLooksUnsafe(bytes)) {
    return fail(415, "unsafe_pdf", "This PDF has scripts or attachments, so it can't be read. Take a photo or screenshot of the report instead.");
  }
  return { mimeType: kind.mime, base64: Buffer.from(bytes).toString("base64"), bytes: bytes.byteLength };
}

export const isFailure = (x: unknown): x is Failure => !!x && typeof x === "object" && "category" in x && "status" in x;

// ─── Logging ────────────────────────────────────────────────────────────

type LogEvent = {
  tag: string;
  requestId: string;
  category: string;
  status?: number;
  model?: string;
  bytes?: number;
  chars?: number;
  ms?: number;
};
const LOG_KEYS: (keyof LogEvent)[] = ["tag", "requestId", "category", "status", "model", "bytes", "chars", "ms"];

/** One JSON line with allow-listed, non-sensitive fields only (anything else is dropped). */
export function safeLog(level: "info" | "warn" | "error", event: LogEvent) {
  const clean: Record<string, string | number> = {};
  for (const k of LOG_KEYS) {
    const v = event[k];
    if (typeof v === "number" && Number.isFinite(v)) clean[k] = v;
    else if (typeof v === "string") clean[k] = v.replace(/[^\w.:-]/g, "").slice(0, 64);
  }
  (level === "error" ? console.error : level === "warn" ? console.warn : console.info)(JSON.stringify(clean));
}

export const newRequestId = () => crypto.randomUUID();

// ─── Model output ───────────────────────────────────────────────────────

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

export type Generate = (model: string, args: { system: string; prompt: string; upload: Upload }) => Promise<string>;
const RETRYABLE = new Set([429, 500, 503]);

/**
 * Asks the vision model for a JSON object. Unparseable output counts as "nothing read" (an empty
 * object) — the user then types the numbers — and only its length is logged.
 */
export async function runVision(opts: {
  tag: string;
  requestId: string;
  system: string;
  prompt: string;
  upload: Upload;
  models: string[];
  generate: Generate;
}): Promise<{ data: Record<string, unknown> } | Failure> {
  let lastStatus: number | undefined;
  let lastAuth = false;
  for (const model of opts.models) {
    const started = Date.now();
    try {
      const text = await opts.generate(model, { system: opts.system, prompt: opts.prompt, upload: opts.upload });
      const data = parseJsonObject(text);
      safeLog(data ? "info" : "warn", {
        tag: opts.tag,
        requestId: opts.requestId,
        category: data ? "ok" : "parse_failed",
        model,
        bytes: opts.upload.bytes,
        chars: text.length,
        ms: Date.now() - started,
      });
      return { data: data ?? {} };
    } catch (err) {
      lastStatus = (err as { status?: number }).status;
      lastAuth = /api key|api_key|permission|unauthori[sz]ed/i.test((err as Error)?.message ?? "");
      safeLog("error", {
        tag: opts.tag,
        requestId: opts.requestId,
        category: lastStatus === undefined ? "upstream_timeout" : "upstream_error",
        status: lastStatus,
        model,
        ms: Date.now() - started,
      });
      if (lastStatus && !RETRYABLE.has(lastStatus)) break;
    }
  }
  if (lastStatus === 429) return fail(502, "upstream_quota", "The AI reader's quota is used up for now. Try again later, or type the numbers in.");
  if (lastStatus === 503) return fail(502, "upstream_overloaded", "The AI reader is busy right now. Try again in a minute.");
  if (lastAuth || lastStatus === 401 || lastStatus === 403) return fail(502, "upstream_auth", "The AI reader isn't set up correctly on the server. The owner needs to check the hosting settings.");
  if (lastStatus === 404) return fail(502, "upstream_not_found", "The AI reader isn't set up correctly on the server. The owner needs to check the hosting settings.");
  if (lastStatus === undefined) return fail(502, "upstream_timeout", "The AI reader didn't answer in time. Try again in a minute.");
  return fail(502, "upstream_error", "Couldn't read the photo. Try again, or type the numbers in.");
}
