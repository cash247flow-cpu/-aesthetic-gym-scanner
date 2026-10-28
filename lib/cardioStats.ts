// Steps and floors from cardio, entered by hand (machine screen or smart watch) or read from a
// photo of the console / a Samsung Health screenshot. Kept per day and machine so weekly
// totals and the celebration screen can add them up.

import { addDays, todayStr } from "@/lib/habits";

export type StatsSource = "machine" | "watch" | "photo";
export type CardioStats = { steps: number; floors: number; source: StatsSource };
type Store = Record<string, CardioStats>; // "YYYY-MM-DD|machine" → stats

const KEY = "ags:cardio:stats";

function load(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

export function saveCardioStats(date: string, machine: string, stats: CardioStats | null) {
  const store = load();
  const key = `${date}|${machine}`;
  if (stats && (stats.steps > 0 || stats.floors > 0)) store[key] = stats;
  else delete store[key];
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export const loadCardioStats = (date: string, machine: string): CardioStats | null => load()[`${date}|${machine}`] ?? null;

/** Steps and floors added up over [from, to] (inclusive dates). */
export function statsTotal(from: string, to = todayStr()) {
  let steps = 0;
  let floors = 0;
  for (const [key, s] of Object.entries(load())) {
    const date = key.split("|")[0];
    if (date >= from && date <= to) {
      steps += s.steps;
      floors += s.floors;
    }
  }
  return { steps, floors };
}

export const weekStartOf = (date: string) => addDays(date, -new Date(date + "T12:00").getDay());

/** Numbers from the photo reader; anything unreadable is null. */
export type CardioReading = { steps: number | null; floors: number | null; minutes: number | null; calories: number | null };

const clean = (v: unknown, max: number): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[,\s]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n) : null;
};

/** Range-checks what Gemini returned so a misread can't land as a silly number. */
export function normalizeCardioReading(raw: Record<string, unknown>): CardioReading {
  return {
    steps: clean(raw.steps, 100_000),
    floors: clean(raw.floors, 2_000),
    minutes: clean(raw.minutes, 600),
    calories: clean(raw.calories, 10_000),
  };
}
