// Resolving the unit of set logs saved before units were recorded (PACSS accuracy).
//
// Older `ags:log:<exercise>` records hold the numbers as typed, with no unit. They are NEVER
// silently read in the currently selected unit. Instead:
//  1. "recorded": the log has a unit field (everything saved since units were added);
//  2. "matched":  the same session was finished, and the finished workout (`ags:workouts`, stored
//     in lb at the time) matches these numbers exactly as lb or exactly as kg→lb — trustworthy
//     metadata, so the unit is known;
//  3. "confirmed": the user said which unit it was (a snapshot of the original numbers is kept, so
//     the answer can be undone);
//  4. otherwise "ambiguous": shown with a "?", excluded from records, progression targets and
//     volume until the user answers. Logs with no weights at all don't need a unit.

import type { WorkoutRecord } from "@/lib/achievements/workoutRecords";
import { LB_PER_KG, type Unit } from "@/lib/units";

export type RowLike = { weight: string; reps: string; done?: boolean };
export type UnitSource = "recorded" | "matched" | "confirmed" | "no-weights" | "ambiguous";
export type Resolved = { unit: Unit | null; source: UnitSource };

const num = (s: string) => {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
// Only ticked sets are saved with a finished workout, so only they can be matched.
const lifts = (rows: RowLike[]) => rows.filter((r) => r.done !== false).map((r) => ({ w: num(r.weight), reps: num(r.reps) })).filter((r) => r.reps > 0);

/** Which unit makes `rows` equal to a finished workout's stored lb sets? null if neither or both. */
export function matchUnit(rows: RowLike[], stored: { weightLb: number; reps: number }[]): Unit | "no-weights" | null {
  const typed = lifts(rows);
  if (!typed.length) return "no-weights";
  if (typed.every((r) => r.w === 0)) return "no-weights";
  if (typed.length !== stored.length) return null;
  const fits = (factor: number) => {
    const pool = [...stored];
    return typed.every((r) => {
      const want = Math.round(r.w * factor * 100) / 100;
      const i = pool.findIndex((s) => s.reps === r.reps && Math.abs(s.weightLb - want) < 0.011);
      if (i === -1) return false;
      pool.splice(i, 1);
      return true;
    });
  };
  const lb = fits(1);
  const kg = fits(LB_PER_KG);
  return lb && !kg ? "lb" : kg && !lb ? "kg" : null;
}

/** The finished workout holding this exercise on `date` ("on"), or the latest one before it ("before"). */
export function workoutFor(workouts: WorkoutRecord[], exercise: string, date: string, mode: "on" | "before") {
  const hits = workouts.filter((w) => (mode === "on" ? w.date === date : w.date < date) && w.exercises.some((e) => e.name === exercise));
  hits.sort((a, b) => a.date.localeCompare(b.date) || a.savedAt - b.savedAt);
  const w = hits[hits.length - 1];
  return w?.exercises.find((e) => e.name === exercise)?.sets ?? null;
}

export function resolveUnit(rows: RowLike[], recorded: Unit | undefined, stored: { weightLb: number; reps: number }[] | null): Resolved {
  if (recorded) return { unit: recorded, source: "recorded" };
  const m = matchUnit(rows, stored ?? []);
  if (m === "no-weights") return { unit: null, source: "no-weights" };
  if (m && stored) return { unit: m, source: "matched" };
  return { unit: null, source: "ambiguous" };
}

/**
 * Units for a log record's two lists. `sets` belong to `rec.date`; `prevSets` to the session
 * before it. A user's earlier answer is stored in `rec.unit` / `rec.prevUnit` with `confirmed`.
 */
export function resolveLog(
  rec: { date: string; sets: RowLike[]; prevSets: RowLike[]; unit?: Unit; prevUnit?: Unit },
  exercise: string,
  workouts: WorkoutRecord[],
): { sets: Resolved; prevSets: Resolved } {
  return {
    sets: resolveUnit(rec.sets, rec.unit, workoutFor(workouts, exercise, rec.date, "on")),
    prevSets: resolveUnit(rec.prevSets, rec.prevUnit, workoutFor(workouts, exercise, rec.date, "before")),
  };
}
