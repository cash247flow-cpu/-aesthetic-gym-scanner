// Supersets and the Antagonist week — run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlan, type SessionKey } from "@/lib/plan";
import { CANONICAL_EQUIPMENT } from "@/lib/equipment";
import { PAIR_REST, SUPERSET_PAIRS, TRANSITION_REST, withSupersets } from "@/lib/superset";

const tags = (session: SessionKey, equipment: readonly string[] = CANONICAL_EQUIPMENT) =>
  withSupersets(buildPlan(session, [...equipment]).exercises).map((e) => ({ name: e.name, rest: e.restSeconds, tag: e.superset }));
const layout = (session: SessionKey) => tags(session).map((e) => [e.name, e.tag ? `${e.tag.group}${e.tag.order}` : "-"]);

test("Legs: leg extension + leg curl (A) and hip abduction + adduction (B) as antagonist pairs; the heavy lifts stay straight sets", () => {
  const legs = tags("legs");
  const by = (n: string) => legs.find((e) => e.name === n)!;
  assert.deepEqual(by("Leg Extension").tag, { group: "A", order: 1, partner: "Seated Leg Curls", kind: "antagonist" });
  assert.deepEqual(by("Seated Leg Curls").tag, { group: "A", order: 2, partner: "Leg Extension", kind: "antagonist" });
  assert.deepEqual(by("Hip Abduction").tag, { group: "B", order: 1, partner: "Hip Adduction", kind: "antagonist" });
  assert.equal(by("Leg Extension").rest, TRANSITION_REST);
  assert.equal(by("Seated Leg Curls").rest, PAIR_REST.antagonist);
  for (const n of ["Hack Squat", "Romanian Deadlift", "Standing Calf Raise"]) assert.equal(by(n).tag, undefined, n);
  assert.equal(by("Hack Squat").rest, "120–180");
  assert.equal(legs.filter((e) => e.tag).length, 4);
});

test("Pump: chest press + reverse pec deck; Push has no pairs; Pull only pairs its forearm finish", () => {
  assert.deepEqual(tags("pump").filter((e) => e.tag).map((e) => e.name), ["Machine Chest Press", "Reverse Pec Deck"]);
  assert.equal(tags("push").filter((e) => e.tag).length, 0);
  assert.deepEqual(tags("pull").filter((e) => e.tag).map((e) => e.name), ["Wrist Curl", "Reverse Curl"]);
});

test("Chest + Biceps + Shoulders: each chest move paired with a curl (non-competing), shoulders as straight sets", () => {
  assert.deepEqual(layout("chestbi"), [
    ["Incline Dumbbell Press", "A1"], ["Spider Curl", "A2"],
    ["Machine Chest Press", "B1"], ["Incline Dumbbell Curl", "B2"],
    ["High-to-Low Cable Fly", "C1"], ["Cable Hammer Curl", "C2"],
    ["Dumbbell Overhead Press", "-"], ["Chest-Supported Lateral Raise", "-"],
  ]);
  const curl = tags("chestbi").find((e) => e.name === "Spider Curl")!;
  assert.equal(curl.tag?.kind, "non-competing");
  assert.equal(curl.rest, PAIR_REST["non-competing"]);
});

test("Back + Triceps: pulls paired with triceps moves (non-competing), then straight sets and the forearm antagonist pair", () => {
  assert.deepEqual(layout("backtri"), [
    ["Wide-Grip Lat Pulldown", "A1"], ["Cable Rope Pushdown", "A2"],
    ["Chest-Supported T-Bar Row", "B1"], ["EZ-Bar Skullcrusher", "B2"],
    ["Seated Cable Row", "-"], ["Reverse Pec Deck", "-"], ["Shrugs", "-"],
    ["Wrist Curl", "C1"], ["Reverse Curl", "C2"],
  ]);
  const forearm = tags("backtri").find((e) => e.name === "Reverse Curl")!;
  assert.equal(forearm.tag?.kind, "antagonist");
  assert.equal(forearm.rest, PAIR_REST.antagonist);
});

test("a swapped exercise keeps its pair; a pair with a missing half is left as straight sets", () => {
  const noSeated = CANONICAL_EQUIPMENT.filter((e) => e !== "seated leg curl machine");
  const curl = tags("legs", noSeated).find((e) => e.tag?.group === "A" && e.tag.order === 2);
  assert.equal(curl?.name, "Lying Leg Curl");
  const plan = buildPlan("legs", [...CANONICAL_EQUIPMENT]).exercises.filter((e) => e.name !== "Seated Leg Curls");
  assert.equal(withSupersets(plan).filter((e) => e.superset?.group === "A" && e.name === "Leg Extension").length, 0);
});

test("every pair is used: its two slots sit side by side on at least one day", () => {
  const days = (["legs", "pump", "pull", "chestbi", "backtri"] as const).map((k) => buildPlan(k, [...CANONICAL_EQUIPMENT]).exercises.map((e) => e.name));
  for (const { first, second } of SUPERSET_PAIRS) assert.ok(days.some((d) => d.includes(first) && d.indexOf(second) === d.indexOf(first) + 1), `${first} + ${second}`);
});

test("the Antagonist week matches the diagram: Mon/Fri Chest + Biceps + Shoulders, Tue/Sat Legs, Wed/Sun Back + Triceps, Thursday off", async () => {
  const { ANTAGONIST_WEEK, abWarnings, isAntagonistWeek } = await import("@/lib/schedule");
  // index 0 = Sunday
  assert.deepEqual(ANTAGONIST_WEEK.map((d) => d.choice), ["backtri", "chestbi", "legs", "backtri", "rest", "chestbi", "legs"]);
  assert.ok(isAntagonistWeek(ANTAGONIST_WEEK));
  assert.deepEqual(abWarnings(ANTAGONIST_WEEK), []);
});

test("a week saved with the first Antagonist week's days loads as the diagram's days", async () => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  };
  const old = [
    { choice: "arms", name: "Shoulders + Arms" }, { choice: "chestback", name: "Chest + Back" }, { choice: "legs", name: "Legs" },
    { choice: "arms", name: "Shoulders + Arms" }, { choice: "rest", name: "Rest" }, { choice: "chestback", name: "Chest + Back" },
    { choice: "legs", name: "Legs" },
  ];
  store.set("ags:schedule", JSON.stringify(old));
  const { loadWeek, isAntagonistWeek } = await import("@/lib/schedule");
  assert.ok(isAntagonistWeek(loadWeek()));
  delete (globalThis as { localStorage?: unknown }).localStorage;
});
