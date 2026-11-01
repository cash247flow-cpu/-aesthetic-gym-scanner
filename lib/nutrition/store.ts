// Storage helpers for the nutrition coach. Everything lives on this phone under `ags:nutrition:*`
// (so the existing backup, restore and erase cover it). Reads never throw: anything malformed
// falls back to the empty default, and existing records are never rewritten by a read.

export type KV = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const local = (): KV | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

export function readJson<T>(key: string, parse: (raw: unknown) => T, kv: KV | null = local()): T {
  try {
    const raw = kv?.getItem(key);
    return parse(raw == null ? undefined : JSON.parse(raw));
  } catch {
    return parse(undefined);
  }
}

export function writeJson(key: string, value: unknown, kv: KV | null = local()) {
  try {
    if (value == null) kv?.removeItem(key);
    else kv?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — the UI keeps working in memory */
  }
}

export const KEYS = {
  prefs: "ags:nutrition:prefs",
  targetsOk: "ags:nutrition:targets-ok",
  inventory: "ags:nutrition:inventory",
  log: "ags:nutrition:log",
  grocery: "ags:nutrition:grocery",
  reminders: "ags:nutrition:reminders",
  dismissed: "ags:nutrition:reminders:dismissed",
  stopTime: "ags:nutrition:stop",
} as const;

/** Plain text only: no control characters or angle brackets, collapsed spaces, capped. */
export const cleanText = (v: unknown, max: number): string =>
  typeof v === "string" || typeof v === "number"
    ? String(v).replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
    : "";

export const num = (v: unknown, min: number, max: number): number | null => {
  const x = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(x) && x >= min && x <= max ? Math.round(x * 10) / 10 : null;
};

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Local calendar date "YYYY-MM-DD" (the app's existing convention: the phone's own clock). */
export const localDate = (d = new Date()) => d.toLocaleDateString("en-CA");
