// Antagonist supersets — run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlan } from "@/lib/plan";
import { CANONICAL_EQUIPMENT } from "@/lib/equipment";
import { ANTAGONIST_PAIRS, PAIR_REST, TRANSITION_REST, withSupersets } from "@/lib/superset";

const tags = (session: "push" | "pull" | "legs" | "pump", equipment: readonly string[] = CANONICAL_EQUIPMENT) =>
  withSupersets(buildPlan(session, [...equipment]).exercises).map((e) => ({ name: e.name, rest: e.restSeconds, tag: e.superset }));

test("Legs: leg extension + leg curl (A) and hip abduction + adduction (B); the heavy lifts stay straight sets", () => {
  const legs = tags("legs");
  const by = (n: string) => legs.find((e) => e.name === n)!;
  assert.deepEqual(by("Leg Extension").tag, { group: "A", order: 1, partner: "Seated Leg Curls" });
  assert.deepEqual(by("Seated Leg Curls").tag, { group: "A", order: 2, partner: "Leg Extension" });
  assert.deepEqual(by("Hip Abduction").tag, { group: "B", order: 1, partner: "Hip Adduction" });
  assert.deepEqual(by("Hip Adduction").tag, { group: "B", order: 2, partner: "Hip Abduction" });
  assert.equal(by("Leg Extension").rest, TRANSITION_REST);
  assert.equal(by("Seated Leg Curls").rest, PAIR_REST);
  for (const n of ["Hack Squat", "Romanian Deadlift", "Standing Calf Raise"]) assert.equal(by(n).tag, undefined, n);
  assert.equal(by("Hack Squat").rest, "120–180");
  assert.equal(legs.filter((e) => e.tag).length, 4);
});

test("Pump: chest press + reverse pec deck; Push and Pull have no pairs", () => {
  const pump = tags("pump").filter((e) => e.tag);
  assert.deepEqual(pump.map((e) => e.name), ["Machine Chest Press", "Reverse Pec Deck"]);
  for (const s of ["push", "pull"] as const) assert.equal(tags(s).filter((e) => e.tag).length, 0, s);
});

test("a swapped exercise keeps its pair; a pair with a missing half is left as straight sets", () => {
  // No leg curl machine: the curl slot is swapped, and stays paired with the extension.
  const noSeated = CANONICAL_EQUIPMENT.filter((e) => e !== "seated leg curl machine");
  const legs = tags("legs", noSeated);
  const curl = legs.find((e) => e.tag?.group === "A" && e.tag.order === 2);
  assert.equal(curl?.name, "Lying Leg Curl");
  // Only one half present: nothing paired.
  const plan = buildPlan("legs", [...CANONICAL_EQUIPMENT]).exercises.filter((e) => e.name !== "Seated Leg Curls");
  assert.equal(withSupersets(plan).filter((e) => e.superset?.group === "A" && e.name === "Leg Extension").length, 0);
});

test("every pair names two adjacent programmed slots", () => {
  const legs = buildPlan("legs", [...CANONICAL_EQUIPMENT]).exercises.map((e) => e.name);
  const pump = buildPlan("pump", [...CANONICAL_EQUIPMENT]).exercises.map((e) => e.name);
  for (const [a, b] of ANTAGONIST_PAIRS) {
    const list = legs.includes(a) ? legs : pump;
    assert.equal(list.indexOf(b), list.indexOf(a) + 1, `${a} + ${b}`);
  }
});
