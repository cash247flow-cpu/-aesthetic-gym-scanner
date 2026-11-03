// Cardio logs are kept per workout — run with `npm test`. Synthetic, in-memory data only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLastLog, loadOwnLog, ownCardioMinutes, saveOwnLog } from "@/lib/cardioLog";
import { workoutId } from "@/lib/achievements/workoutRecords";

function fakeStorage(seed: Record<string, string> = {}) {
  const m = new Map(Object.entries(seed));
  (globalThis as { localStorage?: unknown }).localStorage = {
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
  return { m, done: () => delete (globalThis as { localStorage?: unknown }).localStorage };
}

const today = new Date().toLocaleDateString("en-CA");
const log = (minutes: number, level = "7", date = today) => ({ date, minutes, speed: "", incline: "", level });
const LIFT = workoutId(today, "Push Day");
const MAKEUP = workoutId(today, "Cardio Day", "2026-11-01");

test("two StairMaster sessions on one day each keep their own log", () => {
  const s = fakeStorage();
  try {
    saveOwnLog(LIFT, "stairmaster", log(40));
    // The make-up starts fresh: not already "done" with the first session's minutes.
    assert.equal(loadOwnLog(MAKEUP, "stairmaster", today), null);
    saveOwnLog(MAKEUP, "stairmaster", log(25, "9"));
    // Finishing the second didn't overwrite the first.
    assert.equal(loadOwnLog(LIFT, "stairmaster", today)?.minutes, 40);
    assert.equal(ownCardioMinutes(LIFT, today), 40);
    assert.equal(ownCardioMinutes(MAKEUP, today), 25);
    // "Last time" shows the most recent session on that machine.
    assert.equal(loadLastLog("stairmaster")?.level, "9");
  } finally {
    s.done();
  }
});

test("a workout counts both machines it logged, and nothing from other days", () => {
  const s = fakeStorage();
  try {
    saveOwnLog(LIFT, "treadmill", log(10));
    saveOwnLog(LIFT, "stairmaster", log(20));
    assert.equal(ownCardioMinutes(LIFT, today), 30);
    assert.equal(ownCardioMinutes(LIFT, "2000-01-01"), 0);
  } finally {
    s.done();
  }
});

test("a log saved before this update still counts that day, but only for one workout", () => {
  const s = fakeStorage({ "ags:cardio:log:stairmaster": JSON.stringify(log(40)) });
  try {
    assert.equal(ownCardioMinutes(LIFT, today), 40, "older single log still counts for today's workout");
    saveOwnLog(MAKEUP, "stairmaster", log(25));
    // Once any workout today has its own log, the old shared log can't be claimed again.
    assert.equal(loadOwnLog(LIFT, "stairmaster", today), null);
    assert.equal(ownCardioMinutes(MAKEUP, today), 25);
  } finally {
    s.done();
  }
});

test("old per-workout logs are pruned after 60 days", () => {
  const s = fakeStorage();
  try {
    saveOwnLog("old", "stairmaster", log(30, "7", "2000-01-01"));
    saveOwnLog(LIFT, "stairmaster", log(40));
    const store = JSON.parse(s.m.get("ags:cardio:sessions")!);
    assert.deepEqual(Object.keys(store), [LIFT]);
  } finally {
    s.done();
  }
});

test("finishWorkout: a make-up cardio and the day's own cardio are recorded separately", async () => {
  const s = fakeStorage();
  try {
    const { finishWorkout, loadHistory } = await import("@/lib/wins");
    // Lifting day's StairMaster, then a cardio-only make-up for Sunday on the same machine.
    saveOwnLog(LIFT, "stairmaster", log(40));
    const lift = finishWorkout({ session: "Push Day", label: "Push Day", exercises: [], unit: "lb", includeCardio: true });
    assert.equal(lift.cardioMin, 40);
    saveOwnLog(MAKEUP, "stairmaster", log(25));
    const mk = finishWorkout({ session: "Cardio Day", label: "Cardio Day", exercises: [], unit: "lb", includeCardio: true, makeupFor: "2026-11-01" });
    assert.equal(mk.cardioMin, 25);
    // Re-saving the lifting day later (e.g. when leaving the screen) keeps its own 40, not the make-up's 25.
    assert.equal(finishWorkout({ session: "Push Day", label: "Push Day", exercises: [], unit: "lb", includeCardio: true }).cardioMin, 40);
    const h = loadHistory().filter((e) => e.date === today);
    assert.deepEqual(h.map((e) => [e.session, e.makeupFor ?? null, e.cardioMin]).sort(), [["Cardio Day", "2026-11-01", 25], ["Push Day", null, 40]]);
  } finally {
    s.done();
  }
});
