// Weekly review numbers, worked out only from what was actually recorded. Anything not recorded
// stays null ("not recorded"), never 0 — a missing weigh-in is not "no change".

import { HABITS, isDone, type DayLog } from "@/lib/habits";
import type { BodyEntry, BodyGoal } from "@/lib/bodyLog";
import type { HistoryEntry } from "@/lib/wins";
import type { DayItem } from "@/lib/missed";
import type { Macros, MealId } from "@/lib/meals";
import type { DayTotals } from "@/lib/cronometer";
import type { CardioStats } from "@/lib/cardioStats";
import type { PhotoMeta } from "@/lib/photos";
import type { Achievement } from "@/lib/achievements/detect";
import { COACH } from "@/lib/review/config";
import { inPeriod, previousPeriod, type Period } from "@/lib/review/period";

export type ReviewInput = {
  history: HistoryEntry[];
  achievements: Achievement[];
  body: BodyEntry[];
  goal: BodyGoal | null;
  habitLogs: Record<string, DayLog>;
  meals: Record<string, Partial<Record<MealId, boolean>>>;
  intake: DayTotals[]; // imported from Cronometer
  targets: Macros;
  /** Planned items for a run of days, or null when the plan for those days isn't known. */
  scheduleFor: (p: Period) => DayItem[] | null;
  cardio: Record<string, CardioStats>; // "date|machine"
  photos: PhotoMeta[];
};

type Change = { first: number; last: number; change: number; firstDate: string; lastDate: string };
export type AwardRef = Pick<Achievement, "id" | "type" | "family" | "title" | "tier" | "exerciseName" | "date"> & { summary?: string };

export type WeekMetrics = {
  period: Period;
  workouts: {
    scheduled: number | null; // planned workout + cardio items (null = plan unknown)
    completed: number | null; // done on the day or made up later
    missed: number | null;
    rate: number | null; // completed / scheduled, 0–1
    sessions: number; // workouts with logged sets
    sets: number;
    volumeLb: number;
    exercises: string[];
    trainingMin: number | null;
  };
  cardio: { sessions: number; minutes: number; steps: number; floors: number };
  strength: { prs: AwardRef[]; prevVolumeLb: number | null; volumeChangePct: number | null };
  awards: AwardRef[];
  habits: { tracked: boolean; done: number; eligible: number; rate: number | null; perfectDays: number; sleepRoutineNights: number; loggedDays: number };
  nutrition: {
    mealsChecked: number | null; // plan meals ticked as eaten — NOT a record of calories eaten
    mealDays: number;
    intakeDays: number; // days with imported intake (Cronometer)
    avgKcal: number | null;
    avgProtein: number | null;
    targetKcal: number;
    targetProtein: number;
    kcalOnTargetDays: number | null;
    proteinHitDays: number | null;
  };
  sleep: { durationRecorded: false; routineNights: number };
  body: {
    weighIns: number;
    avgLb: number | null; // null unless ≥ MIN_WEIGHINS weigh-ins
    weight: Change | null; // first vs last weigh-in in the week
    prevAvgLb: number | null;
    avgChangeLb: number | null; // vs last week's average (both need enough weigh-ins)
    bodyFat: Change | null;
    muscle: Change | null;
    waist: Change | null; // in inches
  };
  photos: { count: number; views: string[] };
};

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export const awardRef = (a: Achievement): AwardRef => ({
  id: a.id,
  type: a.type,
  family: a.family,
  title: a.title,
  tier: a.tier,
  exerciseName: a.exerciseName,
  date: a.date,
});

const PR_TYPES = new Set(["weight-pr", "rep-pr", "volume-pr", "bodyweight-pr"]);

function change(entries: BodyEntry[], get: (e: BodyEntry) => number | undefined): Change | null {
  const has = entries.filter((e) => get(e) != null);
  if (has.length < 2) return null;
  const a = has[0];
  const b = has[has.length - 1];
  if (a.date === b.date) return null;
  return { first: get(a)!, last: get(b)!, change: round(get(b)! - get(a)!), firstDate: a.date, lastDate: b.date };
}

/** One value per day (the last one logged that day), so two weigh-ins on one day don't double-count. */
function perDay(entries: BodyEntry[]) {
  const map = new Map<string, BodyEntry>();
  for (const e of entries) map.set(e.date, e);
  return [...map.values()];
}

export function weeklyAverage(body: BodyEntry[], p: Period): number | null {
  const week = perDay(body.filter((e) => inPeriod(e.date, p)));
  return week.length >= COACH.MIN_WEIGHINS ? round(sum(week.map((e) => e.weightLb)) / week.length) : null;
}

function datesOf(p: Period) {
  const out: string[] = [];
  for (let d = new Date(p.start + "T12:00"); ; d.setDate(d.getDate() + 1)) {
    const s = d.toLocaleDateString("en-CA");
    out.push(s);
    if (s >= p.end) break;
  }
  return out;
}

export function computeWeek(input: ReviewInput, p: Period): WeekMetrics {
  const dates = datesOf(p);
  const hist = input.history.filter((h) => inPeriod(h.date, p));
  const lifts = hist.filter((h) => h.sets > 0);

  // Plan completion (workouts and planned cardio), from the app's own missed/made-up tracking.
  const items = input.scheduleFor(p);
  const scheduled = items ? items.length : null;
  const completed = items ? items.filter((i) => i.status === "done" || i.status === "madeUp").length : null;
  const missed = items ? items.filter((i) => i.status === "missed" || i.status === "skipped").length : null;
  const timed = lifts.filter((h) => h.durationMin != null);

  const prevHist = input.history.filter((h) => inPeriod(h.date, previousPeriod(p)) && h.sets > 0);
  const volumeLb = Math.round(sum(lifts.map((h) => h.volumeLb)));
  const prevVolumeLb = prevHist.length ? Math.round(sum(prevHist.map((h) => h.volumeLb))) : null;

  const inWeek = input.achievements.filter((a) => inPeriod(a.date, p));

  // Habits: eligible = 5 habits × days in the period since habit logging began.
  const firstLog = Object.keys(input.habitLogs).sort()[0] ?? null;
  const habitDates = firstLog ? dates.filter((d) => d >= firstLog) : [];
  const logs = habitDates.map((d) => input.habitLogs[d]);
  const done = sum(logs.map((l) => HABITS.filter((h) => isDone(l, h)).length));
  const sleepHabit = HABITS.find((h) => h.id === "sleep")!;
  const routineNights = logs.filter((l) => isDone(l, sleepHabit)).length;

  // Nutrition: meal ticks are reported as ticks; intake numbers only from imported days.
  const mealDays = dates.filter((d) => input.meals[d] && Object.values(input.meals[d]).some(Boolean));
  const mealsChecked = mealDays.length ? sum(mealDays.map((d) => Object.values(input.meals[d]).filter(Boolean).length)) : null;
  const intake = input.intake.filter((d) => inPeriod(d.date, p) && d.completed !== false && d.kcal != null);
  const targetKcal = input.targets.carbs * 4 + input.targets.protein * 4 + input.targets.fat * 9;
  const withProtein = intake.filter((d) => d.protein != null);

  // Body
  const body = input.body.filter((e) => inPeriod(e.date, p));
  const avgLb = weeklyAverage(input.body, p);
  const prevAvgLb = weeklyAverage(input.body, previousPeriod(p));

  // Cardio
  const cardioEntries = Object.entries(input.cardio).filter(([k]) => inPeriod(k.split("|")[0], p));

  const photos = input.photos.filter((ph) => inPeriod(ph.date, p));

  return {
    period: p,
    workouts: {
      scheduled,
      completed,
      missed,
      rate: scheduled ? round(completed! / scheduled, 3) : null,
      sessions: lifts.length,
      sets: sum(lifts.map((h) => h.sets)),
      volumeLb,
      exercises: [...new Set(lifts.flatMap((h) => h.exercises ?? []))],
      trainingMin: timed.length ? sum(timed.map((h) => h.durationMin!)) : null,
    },
    cardio: {
      sessions: hist.filter((h) => h.cardioMin > 0).length,
      minutes: sum(hist.map((h) => h.cardioMin)),
      steps: sum(cardioEntries.map(([, s]) => s.steps)),
      floors: sum(cardioEntries.map(([, s]) => s.floors)),
    },
    strength: {
      prs: inWeek.filter((a) => PR_TYPES.has(a.type)).map(awardRef),
      prevVolumeLb,
      volumeChangePct: prevVolumeLb && volumeLb ? round(((volumeLb - prevVolumeLb) / prevVolumeLb) * 100) : null,
    },
    awards: inWeek.map(awardRef),
    habits: {
      tracked: habitDates.length > 0,
      done,
      eligible: habitDates.length * HABITS.length,
      rate: habitDates.length ? round(done / (habitDates.length * HABITS.length), 3) : null,
      perfectDays: logs.filter((l) => HABITS.every((h) => isDone(l, h))).length,
      sleepRoutineNights: routineNights,
      loggedDays: logs.filter((l) => l && Object.keys(l).length).length,
    },
    nutrition: {
      mealsChecked,
      mealDays: mealDays.length,
      intakeDays: intake.length,
      avgKcal: intake.length ? Math.round(sum(intake.map((d) => d.kcal!)) / intake.length) : null,
      avgProtein: withProtein.length ? Math.round(sum(withProtein.map((d) => d.protein!)) / withProtein.length) : null,
      targetKcal,
      targetProtein: input.targets.protein,
      kcalOnTargetDays: intake.length ? intake.filter((d) => Math.abs(d.kcal! - targetKcal) <= targetKcal * COACH.KCAL_TOLERANCE).length : null,
      proteinHitDays: withProtein.length ? withProtein.filter((d) => d.protein! >= input.targets.protein * 0.95).length : null,
    },
    sleep: { durationRecorded: false, routineNights },
    body: {
      weighIns: perDay(body).length,
      avgLb,
      weight: change(body, (e) => e.weightLb),
      prevAvgLb,
      avgChangeLb: avgLb != null && prevAvgLb != null ? round(avgLb - prevAvgLb) : null,
      bodyFat: change(body, (e) => e.bodyFatPct),
      muscle: change(body, (e) => e.muscleLb),
      waist: change(body, (e) => e.waistIn),
    },
    photos: { count: photos.length, views: [...new Set(photos.map((ph) => ph.view))] },
  };
}

/** Weekly averages for this and earlier periods, newest first (null where weigh-ins were too few). */
export function averageTrend(body: BodyEntry[], p: Period, weeks: number): (number | null)[] {
  const out: (number | null)[] = [];
  let cur = p;
  for (let i = 0; i < weeks; i++) {
    out.push(weeklyAverage(body, cur));
    cur = previousPeriod(cur);
  }
  return out;
}
