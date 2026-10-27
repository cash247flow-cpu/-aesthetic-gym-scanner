import type { SessionKey } from "@/lib/plan";

// What each day of the week is for. "rest" opens Cardio Day.
export type DayChoice = SessionKey | "rest";
// abs: "+Abs" on a non-Legs day (Legs days always include abs).
export type DayPlan = { choice: DayChoice; name: string; abs?: boolean };
export type WeekPlan = DayPlan[]; // index 0 = Sunday, matching Date.getDay()

const KEY = "ags:schedule";

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// Editor and list order: Monday first.
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const CHOICES: { key: DayChoice; short: string; name: string }[] = [
  { key: "push", short: "Push", name: "Push" },
  { key: "pull", short: "Pull", name: "Pull" },
  { key: "legs", short: "Legs", name: "Legs" },
  { key: "pump", short: "Pump", name: "Chest + Rear Delt Pump w/ Biceps" },
  { key: "rest", short: "Rest", name: "Rest" },
];

// The training plan's split, mapped onto the app's sessions.
export const DEFAULT_WEEK: WeekPlan = [
  { choice: "rest", name: "Rest" },
  { choice: "push", name: "Chest" },
  { choice: "pull", name: "Back w/ Bicep Pump" },
  { choice: "legs", name: "Legs" },
  { choice: "push", name: "Shoulders & Triceps" },
  { choice: "pump", name: "Chest + Rear Delt Pump w/ Biceps" },
  { choice: "rest", name: "Rest" },
];

const VALID = new Set<string>(CHOICES.map((c) => c.key));

export function loadWeek(): WeekPlan {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as WeekPlan) : null;
    if (Array.isArray(parsed) && parsed.length === 7 && parsed.every((d) => d && VALID.has(d.choice))) return parsed;
  } catch {
    /* fall through to the default */
  }
  return DEFAULT_WEEK;
}

export function saveWeek(week: WeekPlan | null) {
  try {
    if (week) localStorage.setItem(KEY, JSON.stringify(week));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Picking a new session for a day resets its name, unless it's going back to the plan's own choice. */
export function withChoice(week: WeekPlan, day: number, choice: DayChoice): WeekPlan {
  const original = DEFAULT_WEEK[day];
  const name = choice === original.choice ? original.name : CHOICES.find((c) => c.key === choice)!.name;
  // A day switched to Legs gets abs built in, so drop its separate "+Abs" flag.
  return week.map((d, i) => (i === day ? { choice, name, abs: choice === "legs" ? undefined : d.abs } : d));
}

export const isDefaultWeek = (week: WeekPlan) =>
  week.every((d, i) => d.choice === DEFAULT_WEEK[i].choice && d.name === DEFAULT_WEEK[i].name && !d.abs);

// ─── Abs: up to 3 days a week, never two days in a row ─────────────────
export const MAX_AB_DAYS = 3;
export const hasAbs = (d: DayPlan) => d.choice === "legs" || !!d.abs;
export const abDayCount = (week: WeekPlan) => week.filter(hasAbs).length;
// The week repeats, so Saturday and Sunday neighbour each other, as do Sunday and Monday.
const neighbours = (day: number) => [(day + 6) % 7, (day + 1) % 7];

/** Whether "+Abs" can be switched on for a day, and why not if it can't. */
export function canAddAbs(week: WeekPlan, day: number): { ok: true } | { ok: false; reason: string } {
  if (abDayCount(week) >= MAX_AB_DAYS) return { ok: false, reason: `Already ${MAX_AB_DAYS} ab days this week` };
  const clash = neighbours(day).find((n) => hasAbs(week[n]));
  if (clash !== undefined) return { ok: false, reason: `Abs on ${DAY_NAMES[clash]} — keep a day between` };
  return { ok: true };
}

export function withAbs(week: WeekPlan, day: number, on: boolean): WeekPlan {
  return week.map((d, i) => (i === day ? { ...d, abs: on || undefined } : d));
}

/** Problems a week can still have after day changes (e.g. two Legs days in a row). */
export function abWarnings(week: WeekPlan): string[] {
  const out: string[] = [];
  const count = abDayCount(week);
  if (count > MAX_AB_DAYS) out.push(`${count} ab days this week — the plan is up to ${MAX_AB_DAYS}.`);
  for (const day of WEEK_ORDER) {
    const next = (day + 1) % 7;
    if (hasAbs(week[day]) && hasAbs(week[next])) out.push(`Abs on ${DAY_NAMES[day]} and ${DAY_NAMES[next]} back to back.`);
  }
  return out;
}
