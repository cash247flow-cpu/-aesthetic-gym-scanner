// Stage 2 — encrypted backup format. Synthetic data only. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupError,
  decryptBackup,
  encryptBackup,
  hasUserData,
  planRestore,
  sha256Hex,
  summarize,
  toBase64,
  validatePayload,
  type BackupPayload,
} from "@/lib/backup";

const PASS = "correct horse battery staple";
const IT = 100_000; // the minimum the reader accepts; keeps tests quick

async function samplePayload(): Promise<BackupPayload> {
  const photo = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 250, 251, 252]);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: "2026-10-30T08:00:00.000Z",
    records: {
      "ags:workouts": JSON.stringify([{ id: "2026-10-01|Push Day|", date: "2026-10-01", exercises: [] }, { id: "b", date: "2026-10-02", exercises: [] }]),
      "ags:history": JSON.stringify([{ date: "2026-10-01" }]),
      "ags:body:entries": JSON.stringify([{ id: "x", date: "2026-10-01", weightLb: 199.4, source: "manual" }]),
      "ags:photos": JSON.stringify([{ id: "p1", fileId: "f1abc", date: "2026-10-01", view: "front" }]),
      "ags:reviews": JSON.stringify({ "2026-10-18": {} }),
      "ags:log:Incline Dumbbell Press (Neutral Grip)": JSON.stringify({ sets: [] }),
      "ags:unit": "lb",
    },
    files: [{ id: "f1abc", type: "image/jpeg", size: photo.length, sha256: await sha256Hex(photo), data: toBase64(photo) }],
  };
}

const rejects = async (p: Promise<unknown>, code: BackupError["code"]) =>
  assert.rejects(p, (e: unknown) => e instanceof BackupError && e.code === code);

test("round trip: encrypt → decrypt returns identical records and files", async () => {
  const payload = await samplePayload();
  const file = await encryptBackup(payload, PASS, IT);
  const back = await decryptBackup(file, PASS);
  assert.deepEqual(back, payload);
});

test("ciphertext reveals nothing readable; header has only crypto parameters", async () => {
  const file = await encryptBackup(await samplePayload(), PASS, IT);
  const text = new TextDecoder("latin1").decode(file);
  for (const s of ["workouts", "199.4", "Incline", "ags:", "front", "Push Day"]) assert.ok(!text.includes(s), s);
  const header = JSON.parse(text.split("\n")[1]);
  assert.deepEqual(Object.keys(header).sort(), ["cipher", "iterations", "iv", "kdf", "salt"]);
  // Two backups of the same data differ (random salt and IV).
  const again = await encryptBackup(await samplePayload(), PASS, IT);
  assert.notDeepEqual(Buffer.from(file).toString("hex"), Buffer.from(again).toString("hex"));
});

test("wrong passphrase, tampering, truncation and header swaps are refused", async () => {
  const file = await encryptBackup(await samplePayload(), PASS, IT);
  await rejects(decryptBackup(file, "correct horse battery stapler"), "wrong_passphrase_or_damaged");
  const flipped = file.slice();
  flipped[flipped.length - 5] ^= 0x01;
  await rejects(decryptBackup(flipped, PASS), "wrong_passphrase_or_damaged");
  await rejects(decryptBackup(file.slice(0, file.length - 20), PASS), "wrong_passphrase_or_damaged");
  // Changing a header byte (e.g. the iterations) breaks the GCM binding.
  const text = new TextDecoder("latin1").decode(file);
  const swapped = new Uint8Array([...text].map((c) => c.charCodeAt(0)));
  const at = text.indexOf('"iterations":100000');
  swapped.set(new TextEncoder().encode('"iterations":100001'), at);
  await rejects(decryptBackup(swapped, PASS), "wrong_passphrase_or_damaged");
});

test("not a backup / bad headers / absurd iteration counts are refused before any work", async () => {
  await rejects(decryptBackup(new TextEncoder().encode("hello"), PASS), "not_backup");
  await rejects(decryptBackup(new TextEncoder().encode('AQBK1\n{"kdf":"PBKDF2-SHA256"\n'), PASS), "bad_header");
  const hostile = new TextEncoder().encode(
    `AQBK1\n${JSON.stringify({ kdf: "PBKDF2-SHA256", iterations: 999_999_999, salt: toBase64(new Uint8Array(16)), cipher: "AES-256-GCM", iv: toBase64(new Uint8Array(12)) })}\nxx`,
  );
  await rejects(decryptBackup(hostile, PASS), "bad_header");
});

test("weak passphrases are refused when creating a backup", async () => {
  await rejects(encryptBackup(await samplePayload(), "short", IT), "weak_passphrase");
  await rejects(encryptBackup(await samplePayload(), "aaaaaaaaaaaaaaaa", IT), "weak_passphrase");
});

test("payload validation: only what this app writes is accepted", async () => {
  const good = await samplePayload();
  assert.doesNotThrow(() => validatePayload(good));
  const cases: [string, unknown][] = [
    ["wrong format", { ...good, format: "other" }],
    ["future version", { ...good, version: 2 }],
    ["non-ags key", { ...good, records: { evil: "x" } }],
    ["proto key", { ...good, records: JSON.parse('{"__proto__": "x"}') }],
    ["non-string value", { ...good, records: { "ags:unit": 5 } }],
    ["control char in key", { ...good, records: { "ags:a\u0000b": "x" } }],
    ["bad file type", { ...good, files: [{ ...good.files[0], type: "text/html" }] }],
    ["bad file id", { ...good, files: [{ ...good.files[0], id: "../x" }] }],
    ["duplicate file id", { ...good, files: [good.files[0], good.files[0]] }],
    ["huge size", { ...good, files: [{ ...good.files[0], size: 999_999_999 }] }],
    ["bad checksum format", { ...good, files: [{ ...good.files[0], sha256: "abc" }] }],
    ["array payload", [good]],
  ];
  for (const [name, raw] of cases) assert.throws(() => validatePayload(raw), (e: unknown) => e instanceof BackupError && e.code === "bad_payload", name);
});

test("file integrity: a photo whose bytes don't match its checksum is refused", async () => {
  const p = await samplePayload();
  p.files[0] = { ...p.files[0], data: toBase64(new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0])) };
  await rejects(decryptBackup(await encryptBackup(p, PASS, IT), PASS), "bad_payload");
});

test("preview counts and restore plans (replace vs add-missing)", async () => {
  const b = await samplePayload();
  assert.deepEqual(summarize(b.records, b.files.length), { workouts: 2, historyEntries: 1, bodyEntries: 1, progressPhotos: 1, reviews: 1, habitDays: 0, files: 1, records: 7 });
  const current = { records: { "ags:unit": "kg", "ags:extra": "1" }, fileIds: ["old1", "f1abc"] };
  const replace = planRestore(current, b, "replace");
  assert.deepEqual(replace.removeRecords, ["ags:extra"]);
  assert.equal(replace.writeRecords["ags:unit"], "lb");
  assert.deepEqual(replace.removeFiles, ["old1"]);
  const add = planRestore(current, b, "add-missing");
  assert.ok(!("ags:unit" in add.writeRecords)); // existing values are kept
  assert.deepEqual(add.removeRecords, []);
  assert.deepEqual(add.writeFiles.map((f) => f.id), []); // f1abc already on the phone
});

test("a freshly opened phone with only app bookkeeping counts as empty", () => {
  const fresh = { "ags:renames:v1": "1", "ags:schedule:days": "{}", "ags:missed:since": '"2026-10-30"', "ags:achievements": "{}", "ags:events": "{}" };
  assert.equal(hasUserData(fresh, 0), false);
  assert.equal(hasUserData({ ...fresh, "ags:workouts": "[]" }, 0), true);
  assert.equal(hasUserData(fresh, 1), true);
});
