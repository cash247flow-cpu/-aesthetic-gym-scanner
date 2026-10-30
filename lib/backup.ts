// Encrypted backups of everything AESTHETIQ keeps on the phone (pure logic — no storage access).
//
// File layout (".aqbk"):
//   "AQBK1\n" + header JSON + "\n" + AES-256-GCM ciphertext
// The header holds only what's needed to decrypt (KDF, salt, IV) and is bound to the ciphertext
// as GCM "additional data", so it can't be swapped. The key comes from the user's passphrase via
// PBKDF2-SHA-256; nothing about the user's data is readable without it. Built on WebCrypto only.
//
// The decrypted payload is validated strictly before anything can be restored: known format and
// version, `ags:` keys only, string values with size limits, allow-listed file types, and a
// SHA-256 check of every stored file.

export const BACKUP_FORMAT = "aesthetiq-backup";
export const BACKUP_VERSION = 1;
const MAGIC = "AQBK1\n";
export const DEFAULT_ITERATIONS = 600_000;
const MIN_ITERATIONS = 100_000;
const MAX_ITERATIONS = 5_000_000; // a hostile file can't make decryption hang forever
export const MIN_PASSPHRASE = 12;

export const LIMITS = {
  fileBytes: 200 * 1024 * 1024, // whole backup file
  headerBytes: 2048,
  records: 5000,
  recordChars: 8 * 1024 * 1024,
  files: 3000,
  fileSize: 20 * 1024 * 1024,
};
const FILE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf", ""]);

export type BackupFile = { id: string; type: string; size: number; sha256: string; data: string /* base64 */ };
export type BackupPayload = {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string; // ISO
  records: Record<string, string>; // localStorage key → raw stored string
  files: BackupFile[]; // IndexedDB blobs (photos, scale photos, reports)
};
type Header = { kdf: "PBKDF2-SHA256"; iterations: number; salt: string; cipher: "AES-256-GCM"; iv: string };

export class BackupError extends Error {
  constructor(
    public code: "not_backup" | "bad_header" | "wrong_passphrase_or_damaged" | "bad_payload" | "too_large" | "weak_passphrase",
    message: string,
  ) {
    super(message);
  }
}

// ─── encoding helpers ───────────────────────────────────────────────────
export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
  return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
}
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Basic passphrase rule: long enough to resist guessing if the file leaks. */
export function passphraseProblem(p: string): string | null {
  if (p.trim().length < MIN_PASSPHRASE) return `Use at least ${MIN_PASSPHRASE} characters — a short sentence works well.`;
  if (/^(.)\1+$/.test(p)) return "Don't use one repeated character.";
  return null;
}

// ─── encrypt / decrypt ──────────────────────────────────────────────────
export async function encryptBackup(payload: BackupPayload, passphrase: string, iterations = DEFAULT_ITERATIONS): Promise<Uint8Array> {
  const problem = passphraseProblem(passphrase);
  if (problem) throw new BackupError("weak_passphrase", problem);
  const salt = random(16);
  const iv = random(12);
  const header: Header = { kdf: "PBKDF2-SHA256", iterations, salt: toBase64(salt), cipher: "AES-256-GCM", iv: toBase64(iv) };
  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  const key = await deriveKey(passphrase, salt, iterations);
  const plain = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource, additionalData: headerBytes as BufferSource }, key, plain as BufferSource),
  );
  const magic = new TextEncoder().encode(MAGIC);
  const out = new Uint8Array(magic.length + headerBytes.length + 1 + cipher.length);
  out.set(magic, 0);
  out.set(headerBytes, magic.length);
  out[magic.length + headerBytes.length] = 0x0a;
  out.set(cipher, magic.length + headerBytes.length + 1);
  return out;
}

function readHeader(file: Uint8Array): { header: Header; headerBytes: Uint8Array; cipher: Uint8Array } {
  const magic = new TextEncoder().encode(MAGIC);
  if (file.length < magic.length + 2 || !magic.every((b, i) => file[i] === b)) throw new BackupError("not_backup", "This isn't an AESTHETIQ backup file.");
  const end = file.indexOf(0x0a, magic.length);
  if (end === -1 || end - magic.length > LIMITS.headerBytes) throw new BackupError("bad_header", "The backup file is damaged.");
  const headerBytes = file.subarray(magic.length, end);
  let h: Partial<Header>;
  try {
    h = JSON.parse(new TextDecoder().decode(headerBytes));
  } catch {
    throw new BackupError("bad_header", "The backup file is damaged.");
  }
  const okB64 = (s: unknown, len: number) => typeof s === "string" && /^[A-Za-z0-9+/=]+$/.test(s) && fromBase64(s).length === len;
  if (
    h?.kdf !== "PBKDF2-SHA256" ||
    h.cipher !== "AES-256-GCM" ||
    !Number.isInteger(h.iterations) ||
    h.iterations! < MIN_ITERATIONS ||
    h.iterations! > MAX_ITERATIONS ||
    !okB64(h.salt, 16) ||
    !okB64(h.iv, 12)
  ) {
    throw new BackupError("bad_header", "The backup file uses settings this app doesn't accept.");
  }
  return { header: h as Header, headerBytes, cipher: file.subarray(end + 1) };
}

export async function decryptBackup(file: Uint8Array, passphrase: string): Promise<BackupPayload> {
  if (file.length > LIMITS.fileBytes) throw new BackupError("too_large", "This backup file is larger than this app accepts.");
  const { header, headerBytes, cipher } = readHeader(file);
  const key = await deriveKey(passphrase, fromBase64(header.salt), header.iterations);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(header.iv) as BufferSource, additionalData: headerBytes as BufferSource },
      key,
      cipher as BufferSource,
    );
  } catch {
    throw new BackupError("wrong_passphrase_or_damaged", "Wrong passphrase, or the file was changed or damaged.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new BackupError("bad_payload", "The backup's contents can't be read.");
  }
  return validatePayloadDeep(parsed); // includes the per-file SHA-256 check
}

// ─── validation ─────────────────────────────────────────────────────────
const KEY_RE = /^ags:[^\u0000-\u001f\u007f]{1,200}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const bad = (msg: string) => new BackupError("bad_payload", `The backup isn't valid: ${msg}.`);

/** Throws unless the decrypted contents are exactly what this app writes. Returns a clean copy. */
export async function validatePayloadDeep(raw: unknown): Promise<BackupPayload> {
  const p = validatePayload(raw);
  for (const f of p.files) {
    const bytes = fromBase64(f.data);
    if (bytes.length !== f.size) throw bad(`file ${f.id} has the wrong size`);
    if ((await sha256Hex(bytes)) !== f.sha256) throw bad(`file ${f.id} failed its integrity check`);
  }
  return p;
}

export function validatePayload(raw: unknown): BackupPayload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw bad("not an object");
  const o = raw as Record<string, unknown>;
  if (o.format !== BACKUP_FORMAT) throw bad("unknown format");
  if (o.version !== BACKUP_VERSION) throw bad(`version ${String(o.version)} isn't supported by this app`);
  if (typeof o.createdAt !== "string" || Number.isNaN(Date.parse(o.createdAt))) throw bad("missing date");
  if (!o.records || typeof o.records !== "object" || Array.isArray(o.records)) throw bad("records missing");
  if (!Array.isArray(o.files)) throw bad("files missing");

  const recordEntries = Object.entries(o.records as Record<string, unknown>);
  if (recordEntries.length > LIMITS.records) throw bad("too many records");
  const records: Record<string, string> = Object.create(null);
  for (const [k, v] of recordEntries) {
    if (!KEY_RE.test(k)) throw bad("unexpected record name");
    if (typeof v !== "string" || v.length > LIMITS.recordChars) throw bad(`record ${k} has the wrong type or size`);
    records[k] = v;
  }

  if (o.files.length > LIMITS.files) throw bad("too many files");
  const seen = new Set<string>();
  const files: BackupFile[] = [];
  for (const f of o.files as unknown[]) {
    const x = (f ?? {}) as Record<string, unknown>;
    if (typeof x.id !== "string" || !ID_RE.test(x.id) || seen.has(x.id)) throw bad("bad file id");
    if (typeof x.type !== "string" || !FILE_TYPES.has(x.type)) throw bad(`file ${x.id} has an unsupported type`);
    if (!Number.isInteger(x.size) || (x.size as number) < 0 || (x.size as number) > LIMITS.fileSize) throw bad(`file ${x.id} has a bad size`);
    if (typeof x.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(x.sha256)) throw bad(`file ${x.id} has no checksum`);
    if (typeof x.data !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(x.data)) throw bad(`file ${x.id} data is malformed`);
    seen.add(x.id);
    files.push({ id: x.id, type: x.type, size: x.size as number, sha256: x.sha256, data: x.data });
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: o.createdAt, records: { ...records }, files };
}

// ─── preview ────────────────────────────────────────────────────────────
export type Summary = {
  workouts: number;
  historyEntries: number;
  bodyEntries: number;
  progressPhotos: number;
  reviews: number;
  habitDays: number;
  files: number;
  records: number;
};

function count(records: Record<string, string>, key: string, kind: "array" | "object"): number {
  const raw = records[key];
  if (!raw) return 0;
  try {
    const v = JSON.parse(raw);
    return kind === "array" ? (Array.isArray(v) ? v.length : 0) : v && typeof v === "object" ? Object.keys(v).length : 0;
  } catch {
    return 0;
  }
}

/** Plain-language counts for the restore preview ("212 workouts, 36 photos…"). */
export function summarize(records: Record<string, string>, fileCount: number): Summary {
  return {
    workouts: count(records, "ags:workouts", "array"),
    historyEntries: count(records, "ags:history", "array"),
    bodyEntries: count(records, "ags:body:entries", "array"),
    progressPhotos: count(records, "ags:photos", "array"),
    reviews: count(records, "ags:reviews", "object"),
    habitDays: count(records, "ags:habits", "object"),
    files: fileCount,
    records: Object.keys(records).length,
  };
}

// Bookkeeping the app writes on its own the first time it opens — not the user's data.
const HOUSEKEEPING = /^ags:(renames:|schedule:days$|missed:since$|achievements$|events$|profile:id$|prereminder|backup:last$)/;

/** True when a phone holds none of the user's own data (so a restore needs no safety backup). */
export const hasUserData = (records: Record<string, string>, fileCount: number) =>
  fileCount > 0 || Object.keys(records).some((k) => !HOUSEKEEPING.test(k));

export type RestoreMode = "replace" | "add-missing";

/** What a restore would write, given what's on the phone now. Nothing is written here. */
export function planRestore(
  current: { records: Record<string, string>; fileIds: string[] },
  backup: BackupPayload,
  mode: RestoreMode,
): { writeRecords: Record<string, string>; removeRecords: string[]; writeFiles: BackupFile[]; removeFiles: string[] } {
  if (mode === "replace") {
    return {
      writeRecords: backup.records,
      removeRecords: Object.keys(current.records).filter((k) => !(k in backup.records)),
      writeFiles: backup.files,
      removeFiles: current.fileIds.filter((id) => !backup.files.some((f) => f.id === id)),
    };
  }
  const have = new Set(current.fileIds);
  return {
    writeRecords: Object.fromEntries(Object.entries(backup.records).filter(([k]) => !(k in current.records))),
    removeRecords: [],
    writeFiles: backup.files.filter((f) => !have.has(f.id)),
    removeFiles: [],
  };
}

export const backupFileName = (d = new Date()) => `aesthetiq-backup-${d.toLocaleDateString("en-CA")}.aqbk`;
