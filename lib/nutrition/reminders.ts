// Opt-in, editable reminders shown INSIDE the app when it's opened. AESTHETIQ has no push
// service, so nothing is delivered while the app is closed — the UI says so, and the browser's
// notification permission is never requested. Times are in the user's own time zone; quiet hours
// hold reminders back; each reminder can be dismissed for the day, edited or turned off.

import { KEYS, readJson, writeJson, type KV } from "./store";

export type ReminderKind = "grocery" | "evening";
export type Reminders = {
  grocery: { on: boolean; day: number | "daily"; time: string }; // day: 0 = Sunday
  evening: { on: boolean; time: string };
  quiet: { on: boolean; start: string; end: string };
  timeZone: string; // IANA zone the times are in, e.g. "America/New_York"
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const deviceTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};
export const validZone = (tz: unknown): tz is string => {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const defaultReminders = (tz = deviceTimeZone()): Reminders => ({
  grocery: { on: false, day: 6, time: "10:00" },
  evening: { on: false, time: "20:30" },
  quiet: { on: true, start: "22:30", end: "07:00" },
  timeZone: tz,
});

export function parseReminders(raw: unknown, tz = deviceTimeZone()): Reminders {
  const d = defaultReminders(tz);
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Record<string, Record<string, unknown>>;
  const time = (v: unknown, fb: string) => (typeof v === "string" && HHMM.test(v) ? v : fb);
  const g = r.grocery ?? {};
  const e = r.evening ?? {};
  const q = r.quiet ?? {};
  const day = g.day === "daily" ? "daily" : typeof g.day === "number" && Number.isInteger(g.day) && g.day >= 0 && g.day <= 6 ? g.day : d.grocery.day;
  return {
    grocery: { on: g.on === true, day, time: time(g.time, d.grocery.time) },
    evening: { on: e.on === true, time: time(e.time, d.evening.time) },
    quiet: { on: q.on !== false, start: time(q.start, d.quiet.start), end: time(q.end, d.quiet.end) },
    timeZone: validZone((raw as Record<string, unknown>).timeZone) ? ((raw as Record<string, unknown>).timeZone as string) : tz,
  };
}

export const loadReminders = (kv?: KV | null) => readJson(KEYS.reminders, (raw) => parseReminders(raw), kv);
export const saveReminders = (r: Reminders, kv?: KV | null) => writeJson(KEYS.reminders, r, kv);

type Dismissed = Partial<Record<ReminderKind, string>>; // kind → local date dismissed
const parseDismissed = (raw: unknown): Dismissed => {
  const out: Dismissed = {};
  if (raw && typeof raw === "object")
    for (const k of ["grocery", "evening"] as ReminderKind[]) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) out[k] = v;
    }
  return out;
};
export const loadDismissed = (kv?: KV | null) => readJson(KEYS.dismissed, parseDismissed, kv);
export const dismissReminder = (kind: ReminderKind, now: Date, tz: string, kv?: KV | null) => {
  const next = { ...loadDismissed(kv), [kind]: zoned(now, tz).date };
  writeJson(KEYS.dismissed, next, kv);
  return next;
};

/** The wall-clock date, weekday and minute-of-day of `now` in time zone `tz`. */
export function zoned(now: Date, tz: string): { date: string; weekday: number; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Quiet hours may cross midnight (22:30 → 07:00). */
export function inQuiet(minutes: number, quiet: Reminders["quiet"]): boolean {
  if (!quiet.on) return false;
  const s = toMin(quiet.start);
  const e = toMin(quiet.end);
  return s === e ? false : s < e ? minutes >= s && minutes < e : minutes >= s || minutes < e;
}

export type DueReminder = { kind: ReminderKind; text: string };

/** Reminders to show right now: enabled, time reached today, not dismissed today, not in quiet hours. */
export function dueReminders(r: Reminders, dismissed: Dismissed, now: Date): DueReminder[] {
  const z = zoned(now, r.timeZone);
  if (inQuiet(z.minutes, r.quiet)) return [];
  const out: DueReminder[] = [];
  if (r.grocery.on && (r.grocery.day === "daily" || r.grocery.day === z.weekday) && z.minutes >= toMin(r.grocery.time) && dismissed.grocery !== z.date)
    out.push({ kind: "grocery", text: "Grocery check: want to look over your list before you shop?" });
  if (r.evening.on && z.minutes >= toMin(r.evening.time) && dismissed.evening !== z.date)
    out.push({ kind: "evening", text: "Evening check-in: working late? Let's choose something easy before hunger makes the decision harder." });
  return out;
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
