// Turns an achievement's stored values (always lb) into certificate text in the user's unit,
// and decides the four information columns for each award type.

import type { Achievement } from "@/lib/achievements/detect";

export type Unit = "lb" | "kg";
export const LB_PER_KG = 2.20462;

/** Weights to one decimal, trailing ".0" dropped: 65 lb, 29.5 kg. */
export function fmtWeight(lb: number, unit: Unit): string {
  const v = unit === "kg" ? lb / LB_PER_KG : lb;
  const r = Math.round(v * 10) / 10;
  return `${r.toLocaleString("en-US", { maximumFractionDigits: 1 })} ${unit}`;
}

const reps = (n: number) => `${n} rep${n === 1 ? "" : "s"}`;

export function fmtDate(date: string): string {
  return new Date(date + "T12:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function perf(a: Achievement, p: Achievement["current"], unit: Unit): string {
  if (p.weightLb !== undefined && p.reps !== undefined) return `${fmtWeight(p.weightLb, unit)} × ${reps(p.reps)}`;
  if (p.reps !== undefined) return `${reps(p.reps)}${a.type === "bodyweight-pr" || a.type === "first-pr" ? " · bodyweight" : ""}`;
  if (p.volumeLb !== undefined) return `${fmtWeight(p.volumeLb, unit)} total`;
  if (p.weightLb !== undefined) return fmtWeight(p.weightLb, unit);
  if (p.percent !== undefined) return `${p.percent}% body fat`;
  if (p.count !== undefined) return String(p.count);
  return "";
}

export function improvementText(a: Achievement, unit: Unit): string {
  const i = a.improvement;
  switch (i.kind) {
    case "weight":
      return a.family === "transformation"
        ? `${fmtWeight(i.lb, unit)} ${a.current.weightLb! < a.previous!.weightLb! ? "lost" : "gained"}`
        : `+${fmtWeight(i.lb, unit)} (+${i.percent}%)`;
    case "reps":
      return `+${reps(i.reps)}`;
    case "volume":
      return `+${fmtWeight(i.lb, unit)} (+${i.percent}%)`;
    case "points":
      return `−${i.points} pts body fat`;
    case "baseline":
      return "Baseline set";
    case "milestone":
      return "Milestone reached";
  }
}

export type Column = { label: string; value: string; private?: boolean };

/** The four certificate columns. Hidden fields read "Private" rather than leaving gaps. */
export function columns(a: Achievement, unit: Unit, show: { exercise: boolean; performance: boolean; measurements: boolean }): Column[] {
  const hide = (c: Column, visible: boolean): Column => (visible ? c : { ...c, value: "Private", private: true });
  const p = show.performance;
  switch (a.type) {
    case "weight-pr":
    case "rep-pr":
    case "volume-pr":
    case "bodyweight-pr":
      return [
        hide({ label: "Exercise", value: a.exerciseName ?? "" }, show.exercise),
        hide({ label: "New record", value: perf(a, a.current, unit) }, p),
        hide({ label: "Previous record", value: a.previous ? perf(a, a.previous, unit) : "" }, p),
        hide({ label: "Improvement", value: improvementText(a, unit) }, p),
      ];
    case "first-pr":
      return [
        hide({ label: "Exercise", value: a.exerciseName ?? "" }, show.exercise),
        hide({ label: "First record", value: perf(a, a.current, unit) }, p),
        { label: "Previous record", value: "None — first logged" },
        { label: "Improvement", value: "Baseline set" },
      ];
    case "volume-milestone":
      return [
        { label: "Milestone", value: `${fmtWeight(a.milestone!, unit)} lifted` },
        hide({ label: "Total lifted", value: fmtWeight(a.current.volumeLb!, unit) }, p),
        hide({ label: "Workouts", value: String(a.current.count ?? "") }, p),
        { label: "Recorded in", value: "Logged workouts" },
      ];
    case "workout-count": {
      const since = a.sourceId.split("since:")[1];
      return [
        { label: "Milestone", value: `${a.milestone} workouts` },
        hide({ label: "Workouts", value: String(a.current.count) }, p),
        hide({ label: "Training since", value: since ? fmtDate(since) : "" }, p),
        { label: "Recorded in", value: "Logged workouts" },
      ];
    }
    case "habit-streak": {
      const start = a.sourceId.match(/habits:([\d-]+)\.\./)?.[1];
      return [
        { label: "Streak", value: `${a.milestone} perfect days` },
        { label: "Daily habits", value: "All 5, every day" },
        hide({ label: "Streak began", value: start ? fmtDate(start) : "" }, p),
        { label: "Recorded in", value: "Daily habit log" },
      ];
    }
    case "weight-goal":
    case "weight-change":
      return [
        { label: "Milestone", value: a.type === "weight-goal" ? "Goal weight reached" : `${fmtWeight(a.milestone!, unit)} toward goal` },
        hide({ label: "Current", value: fmtWeight(a.current.weightLb!, unit) }, show.measurements),
        hide({ label: "Starting", value: fmtWeight(a.previous!.weightLb!, unit) }, show.measurements),
        hide({ label: "Change", value: improvementText(a, unit) }, show.measurements),
      ];
    case "bodyfat-drop":
      return [
        { label: "Milestone", value: `−${a.milestone} pts body fat` },
        hide({ label: "Current", value: `${a.current.percent}%` }, show.measurements),
        hide({ label: "Starting", value: `${a.previous!.percent}%` }, show.measurements),
        hide({ label: "Change", value: improvementText(a, unit) }, show.measurements),
      ];
  }
}

/** One-line summary for lists: "Incline Dumbbell Press · 65 lb × 8 reps". */
export function summaryLine(a: Achievement, unit: Unit): string {
  if (a.exerciseName) return `${a.exerciseName} · ${perf(a, a.current, unit)}`;
  return columns(a, unit, { exercise: true, performance: true, measurements: false })[0].value;
}

export const TYPE_LABEL: Record<Achievement["type"], string> = {
  "weight-pr": "Weight PR",
  "rep-pr": "Rep PR",
  "volume-pr": "Volume PR",
  "first-pr": "First record",
  "bodyweight-pr": "Bodyweight PR",
  "volume-milestone": "Volume milestone",
  "workout-count": "Workout milestone",
  "habit-streak": "Habit streak",
  "weight-goal": "Goal weight",
  "weight-change": "Weight milestone",
  "bodyfat-drop": "Body-fat milestone",
};
