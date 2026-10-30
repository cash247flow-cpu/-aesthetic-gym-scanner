// Security Stage 1 — uploads, AI output handling and logging. Synthetic data only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_FILE_BYTES, isFailure, pdfLooksUnsafe, readImageUpload, runVision, safeLog, sniff, type Upload } from "@/lib/aiSafety";
import { POST as plan } from "@/app/api/plan/route";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const WEBP = new TextEncoder().encode("RIFF\x10\0\0\0WEBPVP8 ");
const HEIC = new Uint8Array([0, 0, 0, 24, ...new TextEncoder().encode("ftypheic"), 0, 0, 0, 0]);
const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF");
const PDF_JS = new TextEncoder().encode("%PDF-1.7\n1 0 obj << /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >> endobj");

function upload(parts: [string, Uint8Array | string, string?, string?][], extraHeaders: Record<string, string> = {}) {
  const form = new FormData();
  for (const [name, value, filename, type] of parts) {
    if (typeof value === "string") form.append(name, value);
    else form.append(name, new Blob([value as BlobPart], { type: type ?? "image/jpeg" }), filename ?? "photo.jpg");
  }
  return new Request("https://app.example/api/read-scale", { method: "POST", body: form, headers: extraHeaders });
}

function captureLogs<T>(run: () => Promise<T>): Promise<{ result: T; lines: string[] }> {
  const lines: string[] = [];
  const orig = { info: console.info, warn: console.warn, error: console.error, log: console.log };
  for (const k of ["info", "warn", "error", "log"] as const) console[k] = (...a: unknown[]) => lines.push(a.map(String).join(" "));
  return run()
    .then((result) => ({ result, lines }))
    .finally(() => Object.assign(console, orig));
}

test("sniff: real format from the bytes; names and MIME types are ignored", () => {
  assert.equal(sniff(JPEG)?.mime, "image/jpeg");
  assert.equal(sniff(PNG)?.mime, "image/png");
  assert.equal(sniff(WEBP)?.mime, "image/webp");
  assert.equal(sniff(HEIC)?.mime, "image/heic");
  assert.equal(sniff(PDF)?.mime, "application/pdf");
  assert.equal(sniff(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>")), null);
  assert.equal(sniff(new TextEncoder().encode("GIF89a")), null);
  assert.equal(sniff(new Uint8Array()), null);
  assert.equal(pdfLooksUnsafe(PDF), false);
  assert.equal(pdfLooksUnsafe(PDF_JS), true);
});

test("uploads: valid image accepted with its real type, even if the browser claimed another", async () => {
  const ok = await readImageUpload(upload([["image", PNG, "x.jpg", "image/jpeg"]]));
  assert.ok(!isFailure(ok));
  assert.equal((ok as Upload).mimeType, "image/png");
});

test("uploads: spoofed, unsupported, risky, empty, multiple and oversized files are rejected", async () => {
  const cases: [Request, number, string, { allowPdf?: boolean }?][] = [
    [upload([["image", new TextEncoder().encode("hello, not a photo"), "photo.jpg", "image/jpeg"]]), 415, "unsupported_type"],
    [upload([["image", new TextEncoder().encode("<svg/>"), "a.svg", "image/svg+xml"]]), 415, "unsupported_type"],
    [upload([["image", PDF, "r.pdf", "application/pdf"]]), 415, "unsupported_type"], // PDF only where allowed
    [upload([["image", PDF_JS, "r.pdf", "application/pdf"]]), 415, "unsafe_pdf", { allowPdf: true }],
    [upload([["image", new Uint8Array()]]), 400, "empty"],
    [upload([["image", JPEG], ["image", JPEG]]), 400, "bad_form"],
    [upload([["image", JPEG], ["note", "extra"]]), 400, "bad_form"],
    [upload([["photo", JPEG]]), 400, "bad_form"],
    [upload([["image", new Uint8Array(MAX_FILE_BYTES + 1).fill(0xff)]]), 413, "too_large"],
    [new Request("https://app.example/x", { method: "POST", body: "x", headers: { "content-length": String(50 * 1024 * 1024), "content-type": "multipart/form-data; boundary=a" } }), 413, "too_large"],
  ];
  for (const [req, status, category, opts] of cases) {
    const r = await readImageUpload(req, opts);
    assert.ok(isFailure(r), category);
    assert.equal(r.status, status, category);
    assert.equal(r.category, category);
  }
  const pdfOk = await readImageUpload(upload([["image", PDF, "r.pdf", "application/pdf"]]), { allowPdf: true });
  assert.equal((pdfOk as Upload).mimeType, "application/pdf");
});

const SENSITIVE = "Name: Jane Synthetic, DOB 1990-01-01, Weight 187.4 lb, Body fat 24.1%";
const up: Upload = { mimeType: "image/jpeg", base64: "AAAA", bytes: 3 };

test("AI output: malformed responses never reach the logs; result is 'nothing read'", async () => {
  for (const text of [SENSITIVE, `Sure! ${SENSITIVE}`, `{"weight": 187.4, "name": "Jane Synthetic"`, "```json\nnot json\n```", ""]) {
    const { result, lines } = await captureLogs(() =>
      runVision({ tag: "read-scale", requestId: "req-1", system: "s", prompt: "p", upload: up, models: ["m"], generate: async () => text }),
    );
    assert.deepEqual(result, { data: {} });
    assert.equal(lines.length, 1);
    const log = JSON.parse(lines[0]);
    assert.equal(log.category, "parse_failed");
    assert.equal(log.requestId, "req-1");
    assert.ok(!/Jane|1990|187|24\.1|weight|name/i.test(lines[0]), lines[0]);
  }
});

test("AI output: a successful read logs only sizes, not values", async () => {
  const { result, lines } = await captureLogs(() =>
    runVision({ tag: "read-scale", requestId: "req-2", system: "s", prompt: "p", upload: up, models: ["m"], generate: async () => '{"weight": 187.4, "unit": "lb"}' }),
  );
  assert.deepEqual(result, { data: { weight: 187.4, unit: "lb" } });
  assert.ok(!/187|weight/.test(lines.join("\n")));
  assert.equal(JSON.parse(lines[0]).category, "ok");
});

test("AI errors: upstream messages (which may echo input) are never logged or returned", async () => {
  const boom = Object.assign(new Error(`Bad request: ${SENSITIVE}`), { status: 400 });
  const { result, lines } = await captureLogs(() =>
    runVision({ tag: "read-scale", requestId: "req-3", system: "s", prompt: "p", upload: up, models: ["a", "b"], generate: async () => Promise.reject(boom) }),
  );
  assert.ok(isFailure(result));
  assert.equal(result.category, "upstream_error");
  assert.ok(!/Jane|187/.test(result.message));
  assert.equal(lines.length, 1); // 400 isn't retried with the fallback model
  assert.ok(!/Jane|187|Bad request/.test(lines[0]));
  // Quota → retried on the fallback, then a friendly message.
  const quota = Object.assign(new Error("quota"), { status: 429 });
  const q = await captureLogs(() => runVision({ tag: "t", requestId: "r", system: "s", prompt: "p", upload: up, models: ["a", "b"], generate: async () => Promise.reject(quota) }));
  assert.equal(q.lines.length, 2);
  assert.equal((q.result as { category: string }).category, "upstream_quota");
});

test("safeLog drops anything outside the allow-list", async () => {
  const { lines } = await captureLogs(async () =>
    safeLog("info", { tag: "t", requestId: "r", category: "ok", ...({ text: SENSITIVE, image: "base64…" } as object) } as Parameters<typeof safeLog>[1]),
  );
  assert.deepEqual(Object.keys(JSON.parse(lines[0])).sort(), ["category", "requestId", "tag"]);
});

test("/api/plan: bounded input, canonical names only", async () => {
  const call = (body: string) => plan(new Request("https://app.example/api/plan", { method: "POST", body }));
  assert.equal((await call(JSON.stringify({ session: "push", equipment: Array(41).fill("bench") }))).status, 400);
  assert.equal((await call(JSON.stringify({ session: "push", equipment: ["x".repeat(61)] }))).status, 400);
  assert.equal((await call(JSON.stringify({ session: "push", equipment: [1, 2] }))).status, 400);
  assert.equal((await call(JSON.stringify({ session: "push", equipment: [], withAbs: "yes" }))).status, 400);
  assert.equal((await call("x".repeat(9000))).status, 413);
  assert.equal((await call("{not json")).status, 400);
  const ok = await call(JSON.stringify({ session: "push", equipment: ["Dumbbells", "bench", "<script>"] }));
  assert.equal(ok.status, 200);
});
