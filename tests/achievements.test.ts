// Achievement rules — run with `npm test`. All data here is in-memory example data; nothing is
// written to any user's storage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectAll, detectBody, detectPRs, detectStreaks, detectWorkoutMilestones, lockedMilestones } from "@/lib/achievements/detect";
import { columns, fmtWeight, improvementText } from "@/lib/achievements/format";
import { FOOTER } from "@/lib/achievements/config";
import type { WorkoutRecord } from "@/lib/achievements/workoutRecords";

let t = 0;
const w = (date: string, name: string, sets: [number, number][], session = "Push Day"): WorkoutRecord => ({
  id: `${date}|${session}|`,
  date,
  session,
  exercises: [{ name, sets: sets.map(([weightLb, reps]) => ({ weightLb, reps })) }],
  savedAt: ++t,
});
const only = (list: ReturnType<typeof detectPRs>, date: string) => list.filter((a) => a.date === date);

test("1. weight PR: heavier at comparable reps, with previous record and tier", () => {
  const prs = detectPRs([w("2026-01-01", "Incline Dumbbell Press", [[60, 12], [60, 10]]), w("2026-01-08", "Incline Dumbbell Press", [[65, 8], [60, 11]])]);
  const [a] = only(prs, "2026-01-08");
  assert.equal(a.type, "weight-pr");
  assert.deepEqual(a.current, { weightLb: 65, reps: 8 });
  assert.deepEqual(a.previous, { weightLb: 60, reps: 12 });
  assert.deepEqual(a.improvement, { kind: "weight", lb: 5, percent: 8.3 });
  assert.equal(a.tier, "gold"); // 8.3% ≥ 5%
  assert.equal(a.declaration, "THE WEIGHT MOVED. THE STANDARD ROSE.");
});

test("1b. heavier but under the comparable-rep minimum is not a weight PR", () => {
  const prs = detectPRs([w("2026-01-01", "Hack Squat", [[200, 10]]), w("2026-01-08", "Hack Squat", [[240, 3]])]);
  assert.equal(only(prs, "2026-01-08").find((a) => a.type === "weight-pr"), undefined);
});

test("2. rep PR: more reps at the same weight", () => {
  const prs = detectPRs([w("2026-01-01", "Cable Rope Pushdown", [[40, 10], [40, 9]]), w("2026-01-08", "Cable Rope Pushdown", [[40, 13], [40, 9]])]);
  const [a] = only(prs, "2026-01-08");
  assert.equal(a.type, "rep-pr");
  assert.deepEqual(a.previous, { weightLb: 40, reps: 10 });
  assert.deepEqual(a.improvement, { kind: "reps", reps: 3 });
  assert.equal(a.tier, "gold");
});

test("3. volume PR: more total work, same top weight and reps", () => {
  const prs = detectPRs([w("2026-01-01", "Leg Extension", [[100, 12], [100, 12]]), w("2026-01-08", "Leg Extension", [[100, 12], [100, 12], [100, 12]])]);
  const [a] = only(prs, "2026-01-08");
  assert.equal(a.type, "volume-pr");
  assert.deepEqual(a.previous, { volumeLb: 2400 });
  assert.deepEqual(a.current, { volumeLb: 3600 });
  assert.deepEqual(a.improvement, { kind: "volume", lb: 1200, percent: 50 });
  assert.equal(a.tier, "platinum");
});

test("4. first PR: first logged performance, no invented previous result", () => {
  const [a] = detectPRs([w("2026-01-01", "Meadows Row", [[45, 10], [50, 8]])]);
  assert.equal(a.type, "first-pr");
  assert.equal(a.previous, null);
  assert.deepEqual(a.current, { weightLb: 50, reps: 8 });
  assert.equal(a.tier, "silver");
  assert.equal(columns(a, "lb", { exercise: true, performance: true, measurements: false })[2].value, "None — first logged");
});

test("5. bodyweight PR: no-added-weight sets compare only with no-added-weight sets", () => {
  const prs = detectPRs([w("2026-01-01", "Reverse Crunch (with Ab Mat)", [[0, 15], [0, 12]]), w("2026-01-08", "Reverse Crunch (with Ab Mat)", [[0, 21]])]);
  const [a] = only(prs, "2026-01-08");
  assert.equal(a.type, "bodyweight-pr");
  assert.deepEqual(a.improvement, { kind: "reps", reps: 6 });
  assert.equal(a.tier, "platinum");
  // Weighted history doesn't make a bodyweight set comparable.
  const mixed = detectPRs([w("2026-01-01", "Dips", [[25, 8]]), w("2026-01-08", "Dips", [[0, 20]])]);
  assert.equal(only(mixed, "2026-01-08").length, 0);
});

test("6. duplicate prevention: same workout processed twice or saved again gives the same ids", () => {
  const a = w("2026-01-01", "Shrugs", [[70, 12]]);
  const b = w("2026-01-08", "Shrugs", [[80, 12]]);
  const once = detectPRs([a, b]).map((x) => x.id);
  const twice = detectPRs([a, b, { ...b }, { ...a }]).map((x) => x.id);
  assert.deepEqual(new Set(twice), new Set(once));
  assert.equal(new Set(once).size, once.length);
  // One award per exercise per workout even if several rules match.
  assert.equal(only(detectPRs([a, b]), "2026-01-08").length, 1);
});

test("6b. variants are separate exercises (no cross-variant comparison)", () => {
  const prs = detectPRs([w("2026-01-01", "Wide-Grip Lat Pulldown", [[150, 10]]), w("2026-01-08", "Neutral-Grip Pulldown", [[120, 10]])]);
  assert.deepEqual(prs.map((a) => a.type), ["first-pr", "first-pr"]);
});

test("7. unit conversion: stored lb shown in kg", () => {
  assert.equal(fmtWeight(66.1386, "kg"), "30 kg");
  assert.equal(fmtWeight(65, "lb"), "65 lb");
  const [, a] = detectPRs([w("2026-01-01", "Seated Cable Row", [[22.5 * 2.20462, 12]]), w("2026-01-08", "Seated Cable Row", [[25 * 2.20462, 10]])]);
  assert.equal(improvementText(a, "kg"), "+2.5 kg (+11.1%)");
});

test("9. recalculation: editing source sets changes or withdraws the dependent award", () => {
  const base = w("2026-01-01", "Spider Curl", [[30, 10]]);
  const pr = w("2026-01-08", "Spider Curl", [[35, 10]]);
  assert.equal(only(detectPRs([base, pr]), "2026-01-08")[0].type, "weight-pr");
  const edited = { ...pr, exercises: [{ name: "Spider Curl", sets: [{ weightLb: 30, reps: 9 }] }] };
  assert.equal(only(detectPRs([base, edited]), "2026-01-08").length, 0);
  const sameId = only(detectPRs([base, { ...pr, exercises: [{ name: "Spider Curl", sets: [{ weightLb: 30, reps: 12 }] }] }]), "2026-01-08")[0];
  assert.equal(sameId.id, only(detectPRs([base, pr]), "2026-01-08")[0].id);
  assert.equal(sameId.type, "rep-pr");
});

test("10/11. milestones: tiers from config; locked until reached", () => {
  const hist = Array.from({ length: 12 }, (_, i) => ({ date: `2026-02-${String(i + 1).padStart(2, "0")}`, session: "Pull Day", volumeLb: 9000, sets: 20, cardioMin: 0 }));
  const m = detectWorkoutMilestones(hist);
  const ten = m.find((a) => a.id === "milestone|workouts|10")!;
  assert.equal(ten.tier, "silver");
  assert.equal(ten.date, "2026-02-10");
  const vol = m.find((a) => a.id === "milestone|volume|100000")!;
  assert.equal(vol.date, "2026-02-12"); // 12 × 9,000 = 108,000 crosses 100,000 on the 12th
  const locked = lockedMilestones({ workouts: [], history: hist, perfectDays: {}, body: [], goal: null }, new Set(m.map((a) => a.id)));
  assert.ok(locked.some((l) => l.id === "milestone|workouts|50" && l.progress === 12));
  assert.ok(!locked.some((l) => l.id === "milestone|workouts|10"));
});

test("streaks: only consecutive perfect days count; a missed day restarts the run", () => {
  const days: Record<string, boolean> = {};
  for (let d = 1; d <= 6; d++) days[`2026-03-${String(d).padStart(2, "0")}`] = true;
  days["2026-03-07"] = false; // one habit missed
  for (let d = 8; d <= 31; d++) days[`2026-03-${String(d).padStart(2, "0")}`] = true;
  assert.equal(detectStreaks(days).length, 1); // 24-day run: 7-day award only
  const s7 = detectStreaks(days)[0];
  assert.equal(s7.date, "2026-03-14");
  for (let d = 1; d <= 6; d++) days[`2026-04-${String(d).padStart(2, "0")}`] = true;
  const s30 = detectStreaks(days).find((a) => a.milestone === 30)!;
  assert.equal(s30.title, "30 Days Unbroken");
  assert.equal(s30.tier, "gold");
});

test("transformation: goal and weight-change milestones, measurements private unless chosen", () => {
  const body = [
    { id: "a", date: "2026-01-01", weightLb: 200, bodyFatPct: 24 },
    { id: "b", date: "2026-02-01", weightLb: 194 },
    { id: "c", date: "2026-03-01", weightLb: 189, bodyFatPct: 21.5 },
  ];
  const got = detectBody(body, { type: "lose", targetLb: 190 });
  assert.deepEqual(got.map((a) => a.id).sort(), ["body|bodyfat-drop|2", "body|weight-change|lose|10", "body|weight-change|lose|5", "body|weight-goal|lose|190"]);
  const goal = got.find((a) => a.type === "weight-goal")!;
  const hidden = columns(goal, "lb", { exercise: true, performance: true, measurements: false });
  assert.ok(hidden.slice(1).every((c) => c.private && c.value === "Private"));
  assert.ok(!hidden.some((c) => /\d{2,} lb/.test(c.value)));
  assert.equal(detectBody(body, { type: "maintain", targetLb: 200 }).filter((a) => a.type !== "bodyfat-drop").length, 0);
});

test("no fictional data: every PR column comes from logged sets; footer is fixed", () => {
  const all = detectAll({ workouts: [w("2026-01-01", "Shrugs", [[70, 12]]), w("2026-01-08", "Shrugs", [[80, 12]])], history: [], perfectDays: {}, body: [], goal: null });
  const pr = all.find((a) => a.type === "weight-pr")!;
  assert.deepEqual(columns(pr, "lb", { exercise: true, performance: true, measurements: false }).map((c) => c.value), [
    "Shrugs",
    "80 lb × 12 reps",
    "70 lb × 12 reps",
    "+10 lb (+14.3%)",
  ]);
  assert.equal(FOOTER, "STRENGTH IS EARNED. NEVER GIVEN.");
});
