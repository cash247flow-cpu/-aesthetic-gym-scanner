// Workout plan swaps — run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlan } from "@/lib/plan";
import { CANONICAL_EQUIPMENT } from "@/lib/equipment";

const RC = "Reverse Crunch (with Ab Mat)";
const slot = (session: "legs" | "abs", equipment: string[]) => buildPlan(session, equipment).exercises.find((e) => e.name === RC || e.swappedFrom === RC);

test("Reverse Crunch keeps its place and offers lower-ab swaps the gym has equipment for", () => {
  for (const session of ["legs", "abs"] as const) {
    const s = slot(session, [...CANONICAL_EQUIPMENT])!;
    assert.equal(s.name, RC, "the programmed exercise is still the default");
    assert.deepEqual(s.alternatives!.map((a) => a.name), ["Hanging Knee Raise", "Captain's Chair Knee Raise", "Decline Reverse Crunch", "Dragon Flag"]);
    for (const a of s.alternatives!) {
      assert.equal(a.swappedFrom, RC);
      assert.equal(a.abs, true);
      assert.equal(a.badge, a.name === "Dragon Flag" ? "Abs · Advanced" : "Abs · Lower");
      assert.equal(a.sets, "3");
      assert.equal(a.reps, "failure", "same programmed sets/reps/rest as the slot");
      assert.ok(a.cue.length > 20);
    }
  }
  // Only equipment the gym has; with none, no Swap button (the original needs no equipment).
  assert.deepEqual(slot("abs", ["pull-up bar"])!.alternatives!.map((a) => a.name), ["Hanging Knee Raise"]);
  assert.equal(slot("abs", [])!.alternatives, undefined);
  assert.deepEqual(slot("abs", ["bench"])!.alternatives!.map((a) => a.name), ["Dragon Flag"], "Garhammer also uses a bench; equipment can be shared, exercises can't");
  assert.match(slot("abs", ["bench"])!.alternatives![0].cue, /^Advanced\..*stop if your lower back hurts/);
  // Swaps never duplicate an exercise already shown elsewhere in the session.
  const names = buildPlan("legs", [...CANONICAL_EQUIPMENT]).exercises.map((e) => e.name);
  assert.equal(new Set(names).size, names.length);
});
