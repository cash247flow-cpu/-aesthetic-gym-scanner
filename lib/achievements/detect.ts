// Achievement detection: pure functions from recorded data (finished workouts, workout history,
// habit logs, body log) to achievements. Running it again on the same data gives the same
// achievements with the same IDs, so re-processing never duplicates an award, and editing the
// source data recalculates (or withdraws) whatever depended on it. Rules: ./config.ts.

import {
  DECLARATION,
  FAMILIES,
  FIRST_PR_TIER,
  MILESTONES,
  PR_RULES,
  RULE_VERSION,
  TIER_RULES,
  WEIGHT_GOAL_TIER,
  type AchievementType,
  type Family,
  type Tier,
} from "@/lib/achievements/config";
import type { WorkoutRecord } from "@/lib/achievements/workoutRecords";

export type Perf = {
  weightLb?: number;
  reps?: number;
  volumeLb?: number;
  count?: number; // workouts, days
  percent?: number; // body fat %
};

export type Improvement =
  | { kind: "weight"; lb: number; percent: number }
  | { kind: "reps"; reps: number }
  | { kind: "volume"; lb: number; percent: number }
  | { kind: "baseline" }
  | { kind: "milestone" }
  | { kind: "points"; points: number }; // body-fat percentage points

export type Achievement = {
  id: string;
  family: Family;
  type: AchievementType;
  title: string;
  subtitle: string;
  declaration: string;
  exerciseId?: string;
  exerciseName?: string;
  date: string;
  current: Perf;
  previous: Perf | null;
  improvement: Improvement;
  milestone?: number; // the threshold reached, for milestone awards
  unit: "lb"; // stored values are lb; shown in the user's unit
  tier: Tier;
  ruleVersion: number;
  sourceId: string; // workout id, history entry or log date it came from
};

// Inputs, kept structural so tests can pass plain data.
export type HistoryLike = { date: string; session: string; volumeLb: number; sets: number; cardioMin: number };
export type HabitDays = Record<string, boolean>; // date → all daily habits done
export type BodyEntryLike = { id: string; date: string; weightLb: number; bodyFatPct?: number };
export type BodyGoalLike = { type: "lose" | "gain" | "maintain"; targetLb: number } | null;
export type EngineInput = {
  workouts: WorkoutRecord[];
  history: HistoryLike[];
  perfectDays: HabitDays;
  body: BodyEntryLike[];
  goal: BodyGoalLike;
};

export const exerciseId = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (now: number, before: number) => (before > 0 ? ((now - before) / before) * 100 : 0);
const weightKey = (w: number) => String(Math.round(w / PR_RULES.WEIGHT_MATCH_LB));
const conqueror = FAMILIES.conqueror;

function prTier(type: "weight-pr" | "rep-pr" | "bodyweight-pr" | "volume-pr", amount: number): Tier {
  const t = TIER_RULES[type];
  return amount >= t.platinum ? "platinum" : amount >= t.gold ? "gold" : "silver";
}

type ExerciseState = {
  bestWeight: { weightLb: number; reps: number } | null; // heaviest at ≥ WEIGHT_PR_MIN_REPS
  repsAtWeight: Map<string, number>;
  maxVolume: number;
  bwMaxReps: number | null;
};

/** Personal records, one per exercise per workout at most (first → weight → reps → volume). */
export function detectPRs(workouts: WorkoutRecord[]): Achievement[] {
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date) || a.savedAt - b.savedAt);
  const state = new Map<string, ExerciseState>();
  const out: Achievement[] = [];

  for (const w of sorted) {
    for (const ex of w.exercises) {
      const sets = ex.sets.filter((s) => s.reps > 0 && s.weightLb >= 0);
      if (!sets.length) continue;
      const weighted = sets.filter((s) => s.weightLb > 0);
      const bodyweight = sets.filter((s) => s.weightLb === 0);
      const volume = weighted.reduce((v, s) => v + s.weightLb * s.reps, 0);
      const st = state.get(ex.name);
      const base = {
        id: `pr|${exerciseId(ex.name)}|${w.id}`,
        family: "conqueror" as const,
        title: conqueror.title,
        subtitle: conqueror.subtitle,
        exerciseId: exerciseId(ex.name),
        exerciseName: ex.name,
        date: w.date,
        unit: "lb" as const,
        ruleVersion: RULE_VERSION,
        sourceId: w.id,
      };
      let award: Omit<Achievement, keyof typeof base | "declaration"> | null = null;

      if (!st) {
        const top = weighted.length
          ? weighted.reduce((a, b) => (b.weightLb > a.weightLb || (b.weightLb === a.weightLb && b.reps > a.reps) ? b : a))
          : bodyweight.reduce((a, b) => (b.reps > a.reps ? b : a));
        award = {
          type: "first-pr",
          current: top.weightLb > 0 ? { weightLb: top.weightLb, reps: top.reps } : { reps: top.reps },
          previous: null,
          improvement: { kind: "baseline" },
          tier: FIRST_PR_TIER,
        };
      } else {
        const heavy = weighted.filter((s) => s.reps >= PR_RULES.WEIGHT_PR_MIN_REPS);
        const top = heavy.length
          ? heavy.reduce((a, b) => (b.weightLb > a.weightLb || (b.weightLb === a.weightLb && b.reps > a.reps) ? b : a))
          : null;
        if (top && st.bestWeight && top.weightLb > st.bestWeight.weightLb + 1e-9) {
          const p = pct(top.weightLb, st.bestWeight.weightLb);
          award = {
            type: "weight-pr",
            current: { weightLb: top.weightLb, reps: top.reps },
            previous: { ...st.bestWeight },
            improvement: { kind: "weight", lb: round1(top.weightLb - st.bestWeight.weightLb), percent: round1(p) },
            tier: prTier("weight-pr", p),
          };
        }
        if (!award) {
          let best: { weightLb: number; reps: number; before: number } | null = null;
          for (const s of weighted) {
            const before = st.repsAtWeight.get(weightKey(s.weightLb));
            if (before === undefined || s.reps <= before) continue;
            if (!best || s.weightLb > best.weightLb || (s.weightLb === best.weightLb && s.reps > best.reps)) {
              best = { weightLb: s.weightLb, reps: s.reps, before };
            }
          }
          if (best) {
            const extra = best.reps - best.before;
            award = {
              type: "rep-pr",
              current: { weightLb: best.weightLb, reps: best.reps },
              previous: { weightLb: best.weightLb, reps: best.before },
              improvement: { kind: "reps", reps: extra },
              tier: prTier("rep-pr", extra),
            };
          }
        }
        if (!award && st.maxVolume > 0 && volume > st.maxVolume + 1e-9) {
          const p = pct(volume, st.maxVolume);
          award = {
            type: "volume-pr",
            current: { volumeLb: round1(volume) },
            previous: { volumeLb: round1(st.maxVolume) },
            improvement: { kind: "volume", lb: round1(volume - st.maxVolume), percent: round1(p) },
            tier: prTier("volume-pr", p),
          };
        }
        if (!award && bodyweight.length && st.bwMaxReps !== null) {
          const reps = Math.max(...bodyweight.map((s) => s.reps));
          if (reps > st.bwMaxReps) {
            const extra = reps - st.bwMaxReps;
            award = {
              type: "bodyweight-pr",
              current: { reps },
              previous: { reps: st.bwMaxReps },
              improvement: { kind: "reps", reps: extra },
              tier: prTier("bodyweight-pr", extra),
            };
          }
        }
      }

      if (award) out.push({ ...base, ...award, declaration: DECLARATION[award.type] });

      // Fold this workout into the exercise's history.
      const next: ExerciseState = st ?? { bestWeight: null, repsAtWeight: new Map(), maxVolume: 0, bwMaxReps: null };
      for (const s of weighted) {
        const k = weightKey(s.weightLb);
        next.repsAtWeight.set(k, Math.max(next.repsAtWeight.get(k) ?? 0, s.reps));
        if (
          s.reps >= PR_RULES.WEIGHT_PR_MIN_REPS &&
          (!next.bestWeight || s.weightLb > next.bestWeight.weightLb || (s.weightLb === next.bestWeight.weightLb && s.reps > next.bestWeight.reps))
        ) {
          next.bestWeight = { weightLb: s.weightLb, reps: s.reps };
        }
      }
      next.maxVolume = Math.max(next.maxVolume, volume);
      if (bodyweight.length) next.bwMaxReps = Math.max(next.bwMaxReps ?? 0, ...bodyweight.map((s) => s.reps));
      state.set(ex.name, next);
    }
  }
  return out;
}

/** Lifetime lifting volume and finished-workout milestones, from the workout history. */
export function detectWorkoutMilestones(history: HistoryLike[]): Achievement[] {
  const finished = history
    .filter((h) => h.sets > 0 || h.cardioMin > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const out: Achievement[] = [];
  let volume = 0;
  finished.forEach((h, i) => {
    const before = volume;
    volume += h.volumeLb;
    for (const m of MILESTONES["volume-milestone"]) {
      if (before < m.at && volume >= m.at) {
        out.push({
          id: `milestone|volume|${m.at}`,
          family: "conqueror",
          type: "volume-milestone",
          title: conqueror.title,
          subtitle: "Lifetime Volume Milestone",
          declaration: DECLARATION["volume-milestone"],
          date: h.date,
          current: { volumeLb: round1(volume), count: i + 1 },
          previous: null,
          improvement: { kind: "milestone" },
          milestone: m.at,
          unit: "lb",
          tier: m.tier,
          ruleVersion: RULE_VERSION,
          sourceId: `${h.date}|${h.session}`,
        });
      }
    }
    for (const m of MILESTONES["workout-count"]) {
      if (i + 1 === m.at) {
        out.push({
          id: `milestone|workouts|${m.at}`,
          family: "discipline",
          type: "workout-count",
          title: `${m.at} Workouts Completed`,
          subtitle: FAMILIES.discipline.subtitle,
          declaration: DECLARATION["workout-count"],
          date: h.date,
          current: { count: m.at },
          previous: { count: 0 },
          improvement: { kind: "milestone" },
          milestone: m.at,
          unit: "lb",
          tier: m.tier,
          ruleVersion: RULE_VERSION,
          sourceId: `${h.date}|${h.session}|since:${finished[0].date}`,
        });
      }
    }
  });
  return out;
}

const nextDay = (d: string) => {
  const x = new Date(d + "T12:00");
  x.setDate(x.getDate() + 1);
  return x.toLocaleDateString("en-CA");
};

/** Perfect-day habit streaks: every daily habit ticked, on consecutive calendar days. */
export function detectStreaks(perfectDays: HabitDays): Achievement[] {
  const days = Object.keys(perfectDays)
    .filter((d) => perfectDays[d])
    .sort();
  const out: Achievement[] = [];
  const reached = new Set<number>();
  let run = 0;
  let start = "";
  let prev: string | null = null;
  for (const d of days) {
    if (prev && nextDay(prev) === d) run++;
    else {
      run = 1;
      start = d;
    }
    prev = d;
    for (const m of MILESTONES["habit-streak"]) {
      if (run === m.at && !reached.has(m.at)) {
        reached.add(m.at);
        out.push({
          id: `streak|${m.at}`,
          family: "discipline",
          type: "habit-streak",
          title: `${m.at} Days Unbroken`,
          subtitle: FAMILIES.discipline.subtitle,
          declaration: DECLARATION["habit-streak"],
          date: d,
          current: { count: m.at },
          previous: null,
          improvement: { kind: "milestone" },
          milestone: m.at,
          unit: "lb",
          tier: m.tier,
          ruleVersion: RULE_VERSION,
          sourceId: `habits:${start}..${d}`,
        });
      }
    }
  }
  return out;
}

/** Weight-goal, weight-change and body-fat milestones from the body tracker's entries. */
export function detectBody(entries: BodyEntryLike[], goal: BodyGoalLike): Achievement[] {
  const sorted = [...entries].filter((e) => e.weightLb > 0).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const out: Achievement[] = [];
  const evo = FAMILIES.transformation;
  const base = { family: "transformation" as const, title: evo.title, unit: "lb" as const, ruleVersion: RULE_VERSION };

  if (sorted.length > 1 && goal && goal.type !== "maintain") {
    const start = sorted[0];
    const dir = goal.type === "lose" ? -1 : 1;
    const reached = new Set<number>();
    let goalDone = false;
    for (const e of sorted.slice(1)) {
      const toward = (e.weightLb - start.weightLb) * dir;
      for (const m of MILESTONES["weight-change"]) {
        if (toward >= m.at && !reached.has(m.at)) {
          reached.add(m.at);
          out.push({
            ...base,
            id: `body|weight-change|${goal.type}|${m.at}`,
            type: "weight-change",
            subtitle: evo.subtitle,
            declaration: DECLARATION["weight-change"],
            date: e.date,
            current: { weightLb: e.weightLb },
            previous: { weightLb: start.weightLb },
            improvement: { kind: "weight", lb: round1(Math.abs(e.weightLb - start.weightLb)), percent: round1(Math.abs(pct(e.weightLb, start.weightLb))) },
            milestone: m.at,
            tier: m.tier,
            sourceId: `body:${start.id}..${e.id}`,
          });
        }
      }
      const pastTarget = dir < 0 ? e.weightLb <= goal.targetLb : e.weightLb >= goal.targetLb;
      const startedShort = dir < 0 ? start.weightLb > goal.targetLb : start.weightLb < goal.targetLb;
      if (!goalDone && startedShort && pastTarget) {
        goalDone = true;
        out.push({
          ...base,
          id: `body|weight-goal|${goal.type}|${goal.targetLb}`,
          type: "weight-goal",
          subtitle: "Goal Weight Achieved",
          declaration: DECLARATION["weight-goal"],
          date: e.date,
          current: { weightLb: e.weightLb },
          previous: { weightLb: start.weightLb },
          improvement: { kind: "weight", lb: round1(Math.abs(e.weightLb - start.weightLb)), percent: round1(Math.abs(pct(e.weightLb, start.weightLb))) },
          milestone: goal.targetLb,
          tier: WEIGHT_GOAL_TIER,
          sourceId: `body:${start.id}..${e.id}`,
        });
      }
    }
  }

  const bf = sorted.filter((e) => typeof e.bodyFatPct === "number" && e.bodyFatPct > 0);
  if (bf.length > 1) {
    const start = bf[0];
    const reached = new Set<number>();
    for (const e of bf.slice(1)) {
      const drop = start.bodyFatPct! - e.bodyFatPct!;
      for (const m of MILESTONES["bodyfat-drop"]) {
        if (drop >= m.at && !reached.has(m.at)) {
          reached.add(m.at);
          out.push({
            ...base,
            id: `body|bodyfat-drop|${m.at}`,
            type: "bodyfat-drop",
            subtitle: evo.subtitle,
            declaration: DECLARATION["bodyfat-drop"],
            date: e.date,
            current: { percent: e.bodyFatPct },
            previous: { percent: start.bodyFatPct },
            improvement: { kind: "points", points: round1(drop) },
            milestone: m.at,
            tier: m.tier,
            sourceId: `body:${start.id}..${e.id}`,
          });
        }
      }
    }
  }
  return out;
}

/** Everything earned, newest first. */
export function detectAll(input: EngineInput): Achievement[] {
  return [
    ...detectPRs(input.workouts),
    ...detectWorkoutMilestones(input.history),
    ...detectStreaks(input.perfectDays),
    ...detectBody(input.body, input.goal),
  ].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

export type Locked = { id: string; family: Family; title: string; tier: Tier; progress: number; target: number; unit: string };

/** Milestones not reached yet, with progress — shown locked; they can't produce a certificate. */
export function lockedMilestones(input: EngineInput, earned: Set<string>): Locked[] {
  const finished = input.history.filter((h) => h.sets > 0 || h.cardioMin > 0);
  const volume = finished.reduce((v, h) => v + h.volumeLb, 0);
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of Object.keys(input.perfectDays).filter((x) => input.perfectDays[x]).sort()) {
    run = prev && nextDay(prev) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  const out: Locked[] = [];
  for (const m of MILESTONES["workout-count"]) {
    if (!earned.has(`milestone|workouts|${m.at}`))
      out.push({ id: `milestone|workouts|${m.at}`, family: "discipline", title: `${m.at} Workouts Completed`, tier: m.tier, progress: finished.length, target: m.at, unit: "workouts" });
  }
  for (const m of MILESTONES["habit-streak"]) {
    if (!earned.has(`streak|${m.at}`))
      out.push({ id: `streak|${m.at}`, family: "discipline", title: `${m.at} Days Unbroken`, tier: m.tier, progress: best, target: m.at, unit: "perfect days" });
  }
  for (const m of MILESTONES["volume-milestone"]) {
    if (!earned.has(`milestone|volume|${m.at}`))
      out.push({ id: `milestone|volume|${m.at}`, family: "conqueror", title: "Strength Conqueror · Volume", tier: m.tier, progress: Math.round(volume), target: m.at, unit: "lb lifted" });
  }
  return out;
}
