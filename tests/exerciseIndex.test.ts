// "Exercises by muscle" index — run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MUSCLES, exerciseIndex, exercisesFor } from "@/lib/exerciseIndex";
import { getProgram, type SessionKey } from "@/lib/plan";

const KEYS: SessionKey[] = ["push", "pull", "legs", "pump", "abs", "forearms"];

test("every program exercise and swap is in the index once, with muscle tags", () => {
  const names = new Set<string>();
  for (const k of KEYS) for (const e of getProgram(k).exercises) [e.name, ...(e.substitutes ?? []).map((s) => s.name)].forEach((n) => names.add(n));
  const idx = exerciseIndex();
  assert.equal(idx.length, names.size);
  assert.equal(new Set(idx.map((e) => e.name)).size, idx.length);
  for (const e of idx) assert.ok(e.primary.length > 0, `${e.name} has no muscle tags`);
});

test("main exercises come before swaps, and carry their days", () => {
  const chest = exercisesFor("chest").main;
  const incline = chest.find((e) => e.name === "Incline Dumbbell Press");
  assert.deepEqual(incline?.days, ["Push", "Pump"]);
  assert.equal(incline?.swapFor, undefined);
  const dip = chest.find((e) => e.name === "Reverse-Seated Machine Dip");
  assert.ok(dip?.swapFor, "the seated dip is a swap option");
  const firstSwap = chest.findIndex((e) => e.swapFor);
  assert.ok(chest.slice(firstSwap).every((e) => e.swapFor), "no main exercise after the first swap");

  const rear = exercisesFor("shoulders").main.find((e) => e.name === "Reverse Pec Deck");
  assert.deepEqual(rear?.days, ["Pull", "Pump"]);
  assert.match(rear?.cue ?? "", /palms facing each other/);
});

test("a swap shows its own cue, or the main exercise's when it has none", () => {
  const db = exercisesFor("hamstrings").main.find((e) => e.name === "Dumbbell RDL");
  assert.equal(db?.swapFor, "Romanian Deadlift");
  assert.match(db?.cue ?? "", /dumbbells close to the legs/);
});

test("every muscle on the map but the inner thighs has at least one exercise, main or helper", () => {
  for (const m of MUSCLES) {
    const { main, helping } = exercisesFor(m);
    // The program has no inner-thigh (adductor) work; the screen says so.
    if (m === "adductors") assert.equal(main.length + helping.length, 0);
    else assert.ok(main.length + helping.length > 0, `${m} has no exercises`);
    for (const e of helping) assert.ok(!e.primary.includes(m));
  }
  const abs = exercisesFor("abdominals").main.map((e) => e.name);
  for (const n of ["Hanging Knee Raise", "Dragon Flag", "Cable Oblique Crunch"]) assert.ok(abs.includes(n), n);
});
