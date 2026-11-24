// Antagonist supersets — run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlan, type SessionKey } from "@/lib/plan";
import { CANONICAL_EQUIPMENT } from "@/lib/equipment";
import { ANTAGONIST_PAIRS, PAIR_REST, TRANSITION_REST, withSupersets } from "@/lib/superset";

const tags = (session: SessionKey, equipment: readonly string[] = CANONICAL_EQUIPMENT) =>
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

test("Pump: chest press + reverse pec deck; Push has no pairs; Pull only pairs its forearm finish", () => {
  const pump = tags("pump").filter((e) => e.tag);
  assert.deepEqual(pump.map((e) => e.name), ["Machine Chest Press", "Reverse Pec Deck"]);
  assert.equal(tags("push").filter((e) => e.tag).length, 0);
  assert.deepEqual(tags("pull").filter((e) => e.tag).map((e) => e.name), ["Wrist Curl", "Reverse Curl"]);
});

test("Antagonist week days: Chest + Back is three chest/back pairs plus shrugs; Shoulders + Arms pairs curls with triceps and the forearms", () => {
  const cb = tags("chestback");
  assert.deepEqual(
    cb.map((e) => [e.name, e.tag ? `${e.tag.group}${e.tag.order}` : "-"]),
    [
      ["Incline Dumbbell Press", "A1"], ["Wide-Grip Lat Pulldown", "A2"],
      ["Machine Chest Press", "B1"], ["Chest-Supported T-Bar Row", "B2"],
      ["High-to-Low Cable Fly", "C1"], ["Seated Cable Row", "C2"],
      ["Shrugs", "-"],
    ],
  );
  const arms = tags("arms");
  assert.deepEqual(
    arms.map((e) => [e.name, e.tag ? `${e.tag.group}${e.tag.order}` : "-"]),
    [
      ["Dumbbell Overhead Press", "-"], ["Chest-Supported Lateral Raise", "-"], ["Reverse Pec Deck", "-"],
      ["Spider Curl", "A1"], ["Cable Rope Pushdown", "A2"],
      ["Incline Dumbbell Curl", "B1"], ["EZ-Bar Skullcrusher", "B2"],
      ["Wrist Curl", "C1"], ["Reverse Curl", "C2"],
      ["Cable Hammer Curl", "-"],
    ],
  );
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

test("every pair is used: its two slots sit side by side on at least one day", () => {
  const days = (["legs", "pump", "pull", "chestback", "arms"] as const).map((k) => buildPlan(k, [...CANONICAL_EQUIPMENT]).exercises.map((e) => e.name));
  for (const [a, b] of ANTAGONIST_PAIRS) assert.ok(days.some((d) => d.includes(a) && d.indexOf(b) === d.indexOf(a) + 1), `${a} + ${b}`);
});

test("the Antagonist week: Thursday off, each day type twice, abs never on neighbouring days", async () => {
  const { ANTAGONIST_WEEK, abWarnings, isAntagonistWeek } = await import("@/lib/schedule");
  assert.deepEqual(ANTAGONIST_WEEK.map((d) => d.choice), ["arms", "chestback", "legs", "arms", "rest", "chestback", "legs"]);
  assert.ok(isAntagonistWeek(ANTAGONIST_WEEK));
  assert.deepEqual(abWarnings(ANTAGONIST_WEEK), []);
});
