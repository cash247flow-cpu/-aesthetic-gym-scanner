// The training plan's five daily habits, ticked per day, with streaks.

export type HabitId = "morning" | "pfc" | "squat" | "cortisol" | "sleep";
export type DayLog = Partial<{
  morning: boolean;
  pfc: number; // meals eaten in protein → fiber → carbs order (0–3)
  squat: number; // post-meal squat sets (0–3)
  cortisol: boolean;
  sleep: boolean[]; // the three Sleep Lock rules
}>;
type Logs = Record<string, DayLog>; // keyed by YYYY-MM-DD

export type Habit = {
  id: HabitId;
  emoji: string;
  title: string;
  what: string;
} & ({ kind: "check"; action: string } | { kind: "count"; target: number; unitLabel: string } | { kind: "steps"; steps: string[] });

export const HABITS: Habit[] = [
  {
    id: "morning",
    emoji: "🌅",
    title: "Morning Ignition",
    what: "Lemon ginger tea, cayenne, apple cider vinegar. Then a 10–15 min walk at conversation pace before breaking your fast — barefoot on grass.",
    kind: "check",
    action: "Done this morning",
  },
  {
    id: "pfc",
    emoji: "🥩",
    title: "PFC Lock",
    what: "Every meal in order: protein first, fiber second, carbs last.",
    kind: "count",
    target: 3,
    unitLabel: "Meal",
  },
  {
    id: "squat",
    emoji: "🦵",
    title: "Squat Reset",
    what: "Right after each meal: 10 air squats — feet shoulder-width, thighs to parallel (about 60 seconds).",
    kind: "count",
    target: 3,
    unitLabel: "Meal",
  },
  {
    id: "cortisol",
    emoji: "🌙",
    title: "Cortisol Cut",
    what: "A 10–15 min walk outside after dinner — barefoot on grass.",
    kind: "check",
    action: "Walked after dinner",
  },
  {
    id: "sleep",
    emoji: "😴",
    title: "Sleep Lock",
    what: "Three things every night.",
    kind: "steps",
    steps: ["Stopped eating 2–3 h before bed", "No screens 1 h before bed", "Same sleep & wake time"],
  },
];

const KEY = "ags:habits";

export const todayStr = () => new Date().toLocaleDateString("en-CA");

export function addDays(date: string, n: number): string {
  const d = new Date(date + "T12:00");
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA");
}

export function loadHabitLogs(): Logs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Logs) : {};
  } catch {
    return {};
  }
}

export function saveHabitLogs(logs: Logs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(logs));
  } catch {
    /* ignore */
  }
}

export function isDone(log: DayLog | undefined, habit: Habit): boolean {
  if (!log) return false;
  if (habit.kind === "check") return !!log[habit.id];
  if (habit.kind === "count") return ((log[habit.id] as number | undefined) ?? 0) >= habit.target;
  const steps = (log[habit.id] as boolean[] | undefined) ?? [];
  return habit.steps.every((_, i) => steps[i]);
}

export const doneCount = (log: DayLog | undefined) => HABITS.filter((h) => isDone(log, h)).length;
const dayComplete = (log: DayLog | undefined, habit: Habit | "all") =>
  habit === "all" ? doneCount(log) === HABITS.length : isDone(log, habit);

/**
 * Consecutive days the habit (or all five, for "all") was done, counting back from `today`.
 * An unfinished today doesn't break the streak yet — it counts back from yesterday.
 */
export function streak(logs: Logs, habit: Habit | "all", today = todayStr()): number {
  let day = dayComplete(logs[today], habit) ? today : addDays(today, -1);
  let n = 0;
  while (dayComplete(logs[day], habit)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** Longest run of perfect days ever logged (for badges). */
export function bestPerfectStreak(logs: Logs): number {
  const days = Object.keys(logs)
    .filter((d) => dayComplete(logs[d], "all"))
    .sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}
