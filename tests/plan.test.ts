// Workout plan swaps — run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlan, type SessionKey } from "@/lib/plan";
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

test("Cable Oblique Crunch is the 4th ab slot on Legs, in the Abs session and on +Abs days", () => {
  const OC = "Cable Oblique Crunch";
  const abNames = (p: ReturnType<typeof buildPlan>) => p.exercises.filter((e) => e.abs).map((e) => e.name);
  const all = [...CANONICAL_EQUIPMENT];
  const order = ["Assisted Lat Pulldown Crunch", "Reverse Crunch (with Ab Mat)", "Garhammer Raise", OC];
  assert.deepEqual(abNames(buildPlan("legs", all)), order);
  assert.deepEqual(abNames(buildPlan("abs", all)), order);
  assert.deepEqual(abNames(buildPlan("push", all, { withAbs: true })), order);
  const oc = buildPlan("abs", all).exercises.find((e) => e.name === OC)!;
  assert.equal(oc.badge, "Abs · Obliques");
  assert.equal(oc.sets, "3");
  assert.equal(oc.reps, "12–15");
  assert.equal(oc.restSeconds, "60–90");
  assert.match(oc.cue, /^Each side\..*log one side's reps\.$/);
  // Needs a cable machine; without one the slot is left out and reported, never replaced by another muscle's exercise.
  const noCable = buildPlan("abs", all.filter((e) => e !== "cable machine"));
  assert.ok(!abNames(noCable).includes(OC));
  assert.match(noCable.missingNote ?? "", /Couldn.t fill: .*Cable Oblique Crunch/);
});

test("Reverse-Seated Machine Dip is a lower-chest swap for Machine Chest Press", () => {
  const MCP = "Machine Chest Press";
  const DIP = "Reverse-Seated Machine Dip";
  const slotOf = (equipment: string[]) => buildPlan("push", equipment).exercises.find((e) => e.name === MCP || e.swappedFrom === MCP);
  const all = [...CANONICAL_EQUIPMENT];
  const s = slotOf(all)!;
  assert.equal(s.name, MCP, "the chest press stays the default");
  const dip = s.alternatives!.find((a) => a.name === DIP)!;
  assert.ok(dip, "offered as a swap");
  assert.equal(dip.swappedFrom, MCP);
  assert.equal(dip.sets, "2–3");
  assert.equal(dip.reps, "8–12", "same programmed sets/reps/rest as the slot");
  assert.match(dip.cue, /Sit backwards on the seat.*lower chest/);
  assert.match(dip.reason, /^Lower chest/, "its own reason line, not the slot's upper-chest one");
  // Only with a seated dip machine; a dip station alone doesn't offer it.
  assert.ok(!slotOf(all.filter((e) => e !== "seated dip machine"))!.alternatives?.some((a) => a.name === DIP));
  // With only the dip machine, it fills the slot instead of leaving it empty.
  assert.equal(slotOf(["seated dip machine"])!.name, DIP);
});

test("shoulder cable swaps: one per head, offered with a cable machine, programmed sets kept", () => {
  const all = [...CANONICAL_EQUIPMENT];
  const cases: [SessionKey, string, string][] = [
    ["push", "Chest-Supported Lateral Raise", "Cable Scapular-Plane Raise"],
    ["push", "Dumbbell Overhead Press", "Cable Partial Front Raise"],
    ["pull", "Reverse Pec Deck", "Single-Arm Cable Rear Delt Raise"],
  ];
  for (const [session, slotName, swap] of cases) {
    const slot = (eq: string[]) => buildPlan(session, eq).exercises.find((e) => e.name === slotName || e.swappedFrom === slotName)!;
    const s = slot(all);
    assert.equal(s.name, slotName, "the programmed exercise stays the default");
    const alt = s.alternatives!.find((a) => a.name === swap)!;
    assert.ok(alt, `${swap} offered`);
    assert.equal(alt.sets, s.sets);
    assert.equal(alt.reps, s.reps);
    assert.ok(alt.cue.length > 40);
    // Needs a cable machine.
    assert.ok(!slot(all.filter((e) => e !== "cable machine")).alternatives?.some((a) => a.name === swap));
  }
  // The rear-delt swap also appears on Pump day, where the Reverse Pec Deck is used too.
  const pump = buildPlan("pump", all).exercises.find((e) => e.name === "Reverse Pec Deck")!;
  assert.ok(pump.alternatives!.some((a) => a.name === "Single-Arm Cable Rear Delt Raise"));
});
