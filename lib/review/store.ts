// Weekly reviews on this phone: gathers the app's existing records into ReviewInput, and keeps a
// versioned snapshot each time a review is saved — so you can see what was known at review time
// even if a weigh-in or workout is corrected later. Plan changes are only ever proposals; the
// user's approve/dismiss decisions are kept as a history.

import { loadEntries, loadGoal } from "@/lib/bodyLog";
import { loadHabitLogs, todayStr } from "@/lib/habits";
import { loadHistory } from "@/lib/wins";
import { rangeStatus } from "@/lib/missed";
import { loadEaten, loadPhase, loadTargets } from "@/lib/meals";
import { loadCronometer } from "@/lib/cronometer";
import { loadPhotos } from "@/lib/photos";
import { syncAchievements } from "@/lib/achievements/store";
import { loadUnit } from "@/components/SetLogger";
import type { CardioStats } from "@/lib/cardioStats";
import { REVIEW_RULE_VERSION } from "@/lib/review/config";
import { averageTrend, computeWeek, type ReviewInput, type WeekMetrics } from "@/lib/review/metrics";
import { coach, type CheckIn, type CoachResult, type Focus } from "@/lib/review/coach";
import { lastCompleted, previousPeriod, type Period } from "@/lib/review/period";

export type Snapshot = { version: number; savedAt: number; ruleVersion: number; metrics: WeekMetrics; coach: CoachResult };
export type Decision = { focus: Focus; decision: "approved" | "dismissed"; at: number };
export type ReviewRecord = {
  start: string;
  end: string;
  versions: Snapshot[]; // oldest first; the last one is current
  checkIn?: CheckIn;
  decision?: Decision;
  /** The user's answer to "did last week's focus help?" */
  feedback?: { focusId: string; answer: "helped" | "not" | "unsure"; at: number };
};

const REVIEWS_KEY = "ags:reviews";
const DAY_KEY = "ags:review:startDay";
const CARDIO_KEY = "ags:cardio:stats";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/** Review day, 0 = Sunday (the default, matching the app's Sunday–Saturday weeks). */
export const loadStartDay = () => {
  const d = read<number>(DAY_KEY, 0);
  return Number.isInteger(d) && d >= 0 && d <= 6 ? d : 0;
};
export const saveStartDay = (d: number) => write(DAY_KEY, d);

export function gatherInput(): ReviewInput {
  const today = todayStr();
  return {
    history: loadHistory(),
    achievements: syncAchievements().all,
    body: loadEntries(),
    goal: loadGoal(),
    habitLogs: loadHabitLogs(),
    meals: loadEaten(),
    intake: loadCronometer(),
    targets: loadTargets()[loadPhase()],
    scheduleFor: (p: Period) => {
      const items = rangeStatus(p.start, 7, today).flatMap((d) => d.items);
      return items.length ? items : null;
    },
    cardio: read<Record<string, CardioStats>>(CARDIO_KEY, {}),
    photos: loadPhotos(),
  };
}

export function loadReviews(): Record<string, ReviewRecord> {
  return read<Record<string, ReviewRecord>>(REVIEWS_KEY, {});
}
function saveReviews(r: Record<string, ReviewRecord>) {
  write(REVIEWS_KEY, r);
}

/** Live numbers and coaching for a period, worked out from today's data. */
export function liveReview(p: Period, checkIn: CheckIn | null, input = gatherInput()): { metrics: WeekMetrics; coach: CoachResult } {
  const metrics = computeWeek(input, p);
  const earlierRates: (number | null)[] = [];
  for (let q = previousPeriod(p), i = 0; i < 3; i++, q = previousPeriod(q)) earlierRates.push(computeWeek(input, q).workouts.rate);
  const result = coach({
    week: metrics,
    averages: averageTrend(input.body, p, 4),
    earlierRates,
    body: input.body,
    goal: input.goal,
    checkIn,
    unit: loadUnit(),
  });
  return { metrics, coach: result };
}

/** Numbers that matter for "has this changed since you saved the review?" */
export function fingerprint(m: WeekMetrics) {
  return JSON.stringify([
    m.workouts.completed,
    m.workouts.scheduled,
    m.workouts.volumeLb,
    m.strength.prs.map((a) => a.id),
    m.habits.done,
    m.body.weighIns,
    m.body.avgLb,
    m.body.waist?.change ?? null,
    m.body.bodyFat?.change ?? null,
    m.nutrition.intakeDays,
    m.photos.count,
  ]);
}

/** Save (or re-save after corrections) a review as a new version. Earlier versions are kept. */
export function saveReview(p: Period, live: { metrics: WeekMetrics; coach: CoachResult }, checkIn: CheckIn | null): ReviewRecord {
  const all = loadReviews();
  const old = all[p.start];
  const versions = old?.versions ?? [];
  const rec: ReviewRecord = {
    ...old,
    start: p.start,
    end: p.end,
    checkIn: checkIn ?? undefined,
    versions: [...versions, { version: versions.length + 1, savedAt: Date.now(), ruleVersion: REVIEW_RULE_VERSION, metrics: live.metrics, coach: live.coach }].slice(-5),
  };
  all[p.start] = rec;
  saveReviews(all);
  return rec;
}

export function decide(p: Period, focus: Focus, decision: Decision["decision"]) {
  const all = loadReviews();
  if (!all[p.start]) return;
  all[p.start] = { ...all[p.start], decision: { focus, decision, at: Date.now() } };
  saveReviews(all);
}

export function giveFeedback(p: Period, focusId: string, answer: "helped" | "not" | "unsure") {
  const all = loadReviews();
  if (!all[p.start]) return;
  all[p.start] = { ...all[p.start], feedback: { focusId, answer, at: Date.now() } };
  saveReviews(all);
}

/** Approved and dismissed suggestions, newest first. */
export function decisionHistory(): (Decision & { start: string; end: string; feedback?: ReviewRecord["feedback"] })[] {
  const all = Object.values(loadReviews());
  const feedbackFor = (start: string) => all.find((r) => r.feedback && previousPeriod({ start: r.start, end: r.end }).start === start)?.feedback;
  return all
    .filter((r) => r.decision)
    .map((r) => ({ ...r.decision!, start: r.start, end: r.end, feedback: feedbackFor(r.start) }))
    .sort((a, b) => b.start.localeCompare(a.start));
}

/** The latest finished period, if it hasn't been reviewed yet (for the home card). */
export function pendingReview(today = todayStr()): Period | null {
  const p = lastCompleted(today, loadStartDay());
  return loadReviews()[p.start] ? null : p;
}
