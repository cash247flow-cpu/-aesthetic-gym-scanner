// Training terms glossary — run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TRAINING_TERMS } from "@/lib/trainingTerms";
import { SESSIONS } from "@/lib/programs";
import { stepFor } from "@/lib/overload";

const all = TRAINING_TERMS.flatMap((g) => g.terms);
const find = (t: string) => all.find((x) => x.term === t);

test("terms are unique and each has a plain meaning", () => {
  assert.equal(new Set(all.map((t) => t.term)).size, all.length);
  for (const t of all) assert.ok(t.meaning.length > 10, t.term);
});

test("the glossary matches the plan and the app's rules", () => {
  // Drop set: the plan really uses one, on Hip Abduction's last set.
  const abd = SESSIONS.legs.exercises.find((e) => e.name === "Hip Abduction");
  assert.match(abd?.cue ?? "", /drop set on the last set/);
  assert.match(find("Drop set")?.inApp ?? "", /Hip Abduction/);
  // "failure" appears as a rep target in the plan.
  assert.ok(Object.values(SESSIONS).some((s) => s.exercises.some((e) => e.reps === "failure")));
  // Double progression: the weight steps quoted are the app's.
  const dp = find("Double progression")?.inApp ?? "";
  assert.equal(stepFor("Hack Squat", "lb"), 5);
  assert.equal(stepFor("Hack Squat", "kg"), 2.5);
  assert.equal(stepFor("Leg Extension", "lb"), 2.5);
  assert.equal(stepFor("Leg Extension", "kg"), 1.25);
  assert.match(dp, /\+5 lb \(2\.5 kg\).*\+2\.5 lb \(1\.25 kg\)/);
  // Progression hold never reads as medical clearance.
  assert.match(find("Progression hold")?.inApp ?? "", /isn't medical advice or medical clearance/);
});
