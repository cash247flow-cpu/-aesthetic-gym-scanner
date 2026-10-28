// Weekly review, coaching and photo helpers — run with `npm test`. In-memory example data only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lastCompleted, periodFor, previousPeriod } from "@/lib/review/period";
import { averageTrend, computeWeek, type ReviewInput } from "@/lib/review/metrics";
import { coach, type CoachInput } from "@/lib/review/coach";
import type { BodyEntry } from "@/lib/bodyLog";
import type { DayItem } from "@/lib/missed";
import type { Achievement } from "@/lib/achievements/detect";
import { closestEntry, offsetLabel, pickComparison, sessions, weekNumber, type PhotoMeta } from "@/lib/photos";

const W = periodFor("2026-10-20", 0); // Sun Oct 18 – Sat Oct 24, 2026
const full = { morning: true, pfc: 3, squat: 3, cortisol: true, sleep: [true, true, true] };
const body = (date: string, weightLb: number, extra: Partial<BodyEntry> = {}): BodyEntry => ({ id: date + weightLb, date, weightLb, source: "manual", ...extra });
const item = (date: string, status: DayItem["status"]): DayItem => ({ key: date, date, kind: "lift", label: "Push Day", status });

function input(over: Partial<ReviewInput> = {}): ReviewInput {
  return {
    history: [],
    achievements: [],
    body: [],
    goal: null,
    habitLogs: {},
    meals: {},
    intake: [],
    targets: { protein: 155, carbs: 70, fat: 60 },
    scheduleFor: () => null,
    cardio: {},
    photos: [],
    ...over,
  };
}

test("period boundaries follow the chosen review day", () => {
  assert.deepEqual(periodFor("2026-10-20", 0), { start: "2026-10-18", end: "2026-10-24" }); // Tue → Sun–Sat
  assert.deepEqual(periodFor("2026-10-20", 1), { start: "2026-10-19", end: "2026-10-25" }); // Mon–Sun
  assert.deepEqual(periodFor("2026-10-18", 0), { start: "2026-10-18", end: "2026-10-24" }); // start day itself
  assert.deepEqual(lastCompleted("2026-10-25", 0), { start: "2026-10-18", end: "2026-10-24" });
  assert.deepEqual(previousPeriod(W), { start: "2026-10-11", end: "2026-10-17" });
});

test("completion percentages: workouts and habits", () => {
  const m = computeWeek(
    input({
      scheduleFor: () => [item("2026-10-18", "done"), item("2026-10-19", "madeUp"), item("2026-10-20", "missed"), item("2026-10-21", "done")],
      habitLogs: { "2026-10-18": full, "2026-10-19": { morning: true } },
    }),
    W,
  );
  assert.equal(m.workouts.scheduled, 4);
  assert.equal(m.workouts.completed, 3);
  assert.equal(m.workouts.rate, 0.75);
  // Habit logging began Oct 18, so all 7 days × 5 habits are eligible; 6 done.
  assert.equal(m.habits.eligible, 35);
  assert.equal(m.habits.done, 6);
  assert.equal(m.habits.rate, Math.round((6 / 35) * 1000) / 1000);
  assert.equal(m.habits.perfectDays, 1);
  assert.equal(m.habits.sleepRoutineNights, 1);
});

test("missing data stays missing (null), never zero", () => {
  const m = computeWeek(input(), W);
  assert.equal(m.workouts.rate, null);
  assert.equal(m.workouts.scheduled, null);
  assert.equal(m.habits.rate, null);
  assert.equal(m.body.avgLb, null);
  assert.equal(m.body.avgChangeLb, null);
  assert.equal(m.body.waist, null);
  assert.equal(m.nutrition.mealsChecked, null);
  assert.equal(m.nutrition.avgKcal, null);
  assert.equal(m.sleep.durationRecorded, false);
});

test("meal ticks are counted as ticks, not as calories eaten; intake only from imported days", () => {
  const m = computeWeek(
    input({
      meals: { "2026-10-18": { breakfast: true, lunch: true }, "2026-10-19": { dinner: true } },
      intake: [
        { date: "2026-10-18", kcal: 1500, protein: 160, carbs: 70, netCarbs: 60, fat: 60 },
        { date: "2026-10-19", kcal: 2000, protein: 120, carbs: 150, netCarbs: 140, fat: 80, completed: false }, // still being logged
      ],
    }),
    W,
  );
  assert.equal(m.nutrition.mealsChecked, 3);
  assert.equal(m.nutrition.intakeDays, 1);
  assert.equal(m.nutrition.avgKcal, 1500);
  assert.equal(m.nutrition.kcalOnTargetDays, 1); // target 1,440, within 10%
});

test("weight trend: single weigh-in vs weekly average vs multiweek", () => {
  const entries = [body("2026-10-12", 201), body("2026-10-14", 199), body("2026-10-19", 198), body("2026-10-19", 197.6), body("2026-10-22", 197)];
  const m = computeWeek(input({ body: entries }), W);
  assert.equal(m.body.weighIns, 2); // two entries on Oct 19 count as one day
  assert.equal(m.body.avgLb, 197.3); // (197.6 + 197) / 2
  assert.equal(m.body.prevAvgLb, 200);
  assert.equal(m.body.avgChangeLb, -2.7);
  assert.deepEqual(averageTrend(entries, W, 3), [197.3, 200, null]);
  // One weigh-in is not an average.
  assert.equal(computeWeek(input({ body: [body("2026-10-20", 190)] }), W).body.avgLb, null);
});

test("strength: PRs in the week come from the achievement records; volume vs last week", () => {
  const pr = { id: "pr|x|1", type: "weight-pr", family: "conqueror", title: "Strength Conqueror", tier: "gold", exerciseName: "Shrugs", date: "2026-10-20" } as Achievement;
  const old = { ...pr, id: "pr|x|0", date: "2026-10-10" } as Achievement;
  const m = computeWeek(
    input({
      achievements: [pr, old],
      history: [
        { date: "2026-10-13", session: "Push Day", label: "Push Day", volumeLb: 10000, sets: 20, prs: 0, cardioMin: 0 },
        { date: "2026-10-20", session: "Push Day", label: "Push Day", volumeLb: 11000, sets: 20, prs: 1, cardioMin: 0, exercises: ["Shrugs"] },
      ],
    }),
    W,
  );
  assert.deepEqual(m.strength.prs.map((a) => a.id), ["pr|x|1"]);
  assert.equal(m.strength.volumeChangePct, 10);
  assert.deepEqual(m.workouts.exercises, ["Shrugs"]);
});

test("recalculation: corrected data changes the live numbers", () => {
  const a = computeWeek(input({ body: [body("2026-10-19", 198), body("2026-10-21", 196)] }), W);
  const b = computeWeek(input({ body: [body("2026-10-19", 198), body("2026-10-21", 197)] }), W);
  assert.equal(a.body.avgLb, 197);
  assert.equal(b.body.avgLb, 197.5);
});

// ─── Coach ───────────────────────────────────────────────────────────────
function coachIn(over: Partial<CoachInput> & { prs?: number; rate?: number | null; weighIns?: number } = {}): CoachInput {
  const week = computeWeek(input(), W);
  week.workouts.rate = over.rate === undefined ? 1 : over.rate;
  week.workouts.scheduled = 4;
  week.workouts.completed = Math.round((week.workouts.rate ?? 0) * 4);
  week.workouts.missed = 4 - week.workouts.completed;
  week.body.weighIns = over.weighIns ?? 4;
  week.strength.prs = Array.from({ length: over.prs ?? 0 }, (_, i) => ({ id: `p${i}`, type: "weight-pr", family: "conqueror", title: "x", tier: "gold", date: "2026-10-20" }));
  return { week, averages: [200, 200], earlierRates: [1, 1, 1], body: [], goal: { type: "lose", targetLb: 180 }, checkIn: null, unit: "lb", ...over };
}

test("coach: stable weight with improved strength is not a plateau", () => {
  const r = coach(coachIn({ averages: [200, 200.1, null, null], prs: 2 }));
  assert.equal(r.status, "normal-variation");
  assert.match(r.means, /Your weight remained stable, but your training performance improved\. There isn't enough evidence to conclude that your progress has stopped\./);
});

test("coach: a bounce between weeks without a multiweek stall is normal variation", () => {
  const r = coach(coachIn({ averages: [199, 198, 200, 202] }));
  assert.equal(r.status, "normal-variation");
  assert.notEqual(r.next.kind, "review-targets");
});

test("coach: only several flat weeks with good adherence are a possible plateau, with an approval-only proposal", () => {
  const r = coach(coachIn({ averages: [200, 200.2, 199.8, 200.1] }));
  assert.equal(r.status, "possible-plateau");
  assert.equal(r.next.kind, "review-targets");
  assert.ok(r.proposal && /Nothing changes unless you edit and save/.test(r.proposal.text));
  // Same flat weeks but sessions missed → fix consistency first.
  const lax = coach(coachIn({ averages: [200, 200.2, 199.8, 200.1], earlierRates: [0.5, 1, 1] }));
  assert.equal(lax.next.kind, "adherence");
  // Flat scale but waist down → progress, not plateau.
  const waist = coach(
    coachIn({ averages: [200, 200.2, 199.8, 200.1], body: [body("2026-09-28", 200, { waistIn: 36 }), body("2026-10-22", 200, { waistIn: 35 })] }),
  );
  assert.equal(waist.status, "progress");
});

test("coach: missing measurements → insufficient data and a measurement focus", () => {
  const r = coach(coachIn({ averages: [null, 200], weighIns: 1 }));
  assert.equal(r.status, "insufficient");
  assert.equal(r.next.kind, "measure");
});

test("coach: insufficient nutrition records are not compared with targets", () => {
  const c = coachIn();
  c.week.nutrition.intakeDays = 2;
  c.week.nutrition.avgKcal = 3000;
  assert.ok(!coach(c).shows.some((s) => /kcal/.test(s)));
});

test("coach: pain or very low energy → professional / recovery guidance, no diagnosis", () => {
  const pain = coach(coachIn({ checkIn: { pain: true } }));
  assert.equal(pain.next.kind, "professional");
  assert.match(pain.next.text, /doctor or physiotherapist/);
  const tired = coach(coachIn({ checkIn: { energy: 1 } }));
  assert.equal(tired.next.kind, "recovery");
});

test("coach: unusually fast loss two weeks running is flagged", () => {
  const r = coach(coachIn({ averages: [190, 193, 196] }));
  assert.ok(r.flags.some((f) => /registered dietitian/.test(f)));
});

test("coach never changes targets itself: output is text and an optional proposal only", () => {
  const r = coach(coachIn({ averages: [200, 200.2, 199.8, 200.1] }));
  assert.deepEqual(Object.keys(r).sort(), ["flags", "means", "next", "proposal", "reviewAgain", "shows", "status"]);
});

// ─── Visual Evolution helpers ────────────────────────────────────────────
const ph = (id: string, date: string, view: PhotoMeta["view"] = "front"): PhotoMeta => ({ id, date, view, fileId: "f" + id, w: 900, h: 1600, addedAt: 0 });

test("photos: sessions, week numbers and comparison selection", () => {
  const list = [ph("a", "2026-08-01"), ph("b", "2026-08-01", "side"), ph("c", "2026-08-22"), ph("d", "2026-09-20"), ph("e", "2026-09-24")];
  assert.deepEqual(sessions(list).map((s) => [s.date, s.photos.length]), [["2026-08-01", 2], ["2026-08-22", 1], ["2026-09-20", 1], ["2026-09-24", 1]]);
  assert.equal(weekNumber("2026-08-01", "2026-08-22"), 4);
  assert.deepEqual(pickComparison(list, "front", "w4")?.map((p) => p.id), ["a", "c"]);
  // Latest (Sep 24) vs the latest photo at least 5 days earlier (Sep 20 is only 4 days → Aug 22).
  assert.deepEqual(pickComparison(list, "front", "previous")?.map((p) => p.id), ["c", "e"]);
  assert.equal(pickComparison(list, "side", "w4"), null); // only one side photo
  assert.equal(pickComparison(list, "front", "w12"), null); // no photo in week 12
});

test("photos: overlays use the closest dated measurement and say which day it's from", () => {
  const entries = [body("2026-08-03", 200), body("2026-08-20", 196, { waistIn: 35 })];
  const near = closestEntry(entries, "2026-08-01", () => true)!;
  assert.equal(near.entry.date, "2026-08-03");
  assert.equal(offsetLabel(near.offset), "2 days after the photo");
  assert.equal(closestEntry(entries, "2026-08-01", (e) => e.waistIn != null), null); // waist only 19 days away
  assert.equal(offsetLabel(0), "same day");
});
