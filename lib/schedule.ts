import type { SessionKey } from "@/lib/plan";

// What each day of the week is for. "rest" opens Cardio Day.
export type DayChoice = SessionKey | "rest";
export type DayPlan = { choice: DayChoice; name: string };
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
  return week.map((d, i) => (i === day ? { choice, name } : d));
}

export const isDefaultWeek = (week: WeekPlan) =>
  week.every((d, i) => d.choice === DEFAULT_WEEK[i].choice && d.name === DEFAULT_WEEK[i].name);
