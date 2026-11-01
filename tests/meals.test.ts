// Meal editing and Cronometer food-entry import — run with `npm test`. Synthetic data only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MEALS } from "@/lib/meals";
import { applyEdits, checkDraft, editKey, editMeal, parseEdits, resetMeal, undoMeal } from "@/lib/mealEdits";
import { nutritionLine, parseCronometerFoods, tidyServing } from "@/lib/cronometerMeals";

const lunch = MEALS.current.find((m) => m.id === "lunch")!;
const dinnerCur = MEALS.current.find((m) => m.id === "dinner")!;
const dinnerP2 = MEALS.phase2.find((m) => m.id === "dinner")!;
const mine = { title: "Chicken Bowl", foods: [{ kind: "P" as const, text: "200 g chicken" }, { kind: "C" as const, text: "150 g rice" }] };

test("edits: breakfast/lunch shared across phases, dinner per phase; slot and time unchanged", () => {
  let e = editMeal({}, "current", lunch, mine, 1);
  const cur = applyEdits("current", MEALS.current, e).find((m) => m.id === "lunch")!;
  const p2 = applyEdits("phase2", MEALS.phase2, e).find((m) => m.id === "lunch")!;
  assert.equal(cur.title, "Chicken Bowl");
  assert.equal(p2.title, "Chicken Bowl", "lunch edit applies to Phase 2 too");
  assert.equal(cur.when, "Lunch — best time for psyllium");
  assert.ok(cur.edited && cur.canUndo);
  e = editMeal(e, "phase2", dinnerP2, mine, 2);
  assert.equal(applyEdits("current", MEALS.current, e).find((m) => m.id === "dinner")!.title, dinnerCur.title, "current dinner untouched");
  assert.equal(editKey("phase2", "dinner"), "dinner:phase2");
});

test("edits: undo restores the previous version; reset returns to the plan and is itself undoable", () => {
  const e1 = editMeal({}, "current", lunch, mine, 1);
  assert.equal(editMeal(e1, "current", lunch, mine, 2), e1, "saving unchanged content is a no-op");
  const e2 = editMeal(e1, "current", lunch, { ...mine, title: "Chicken Bowl v2" }, 3);
  const u = undoMeal(e2, "current", lunch);
  assert.equal(applyEdits("current", MEALS.current, u).find((m) => m.id === "lunch")!.title, "Chicken Bowl");
  assert.deepEqual(undoMeal(e1, "current", lunch), {}, "undoing back to the default removes the edit");
  const r = resetMeal(e2, "current", lunch, 4);
  const shown = applyEdits("current", MEALS.current, r).find((m) => m.id === "lunch")!;
  assert.equal(shown.title, lunch.title);
  assert.equal(shown.edited, false);
  assert.equal(applyEdits("current", MEALS.current, undoMeal(r, "current", lunch)).find((m) => m.id === "lunch")!.title, "Chicken Bowl v2");
});

test("edits: drafts are checked and tidied; malformed stored data falls back to the plan", () => {
  assert.equal(checkDraft({ title: " ", foods: mine.foods }).ok, false);
  assert.equal(checkDraft({ title: "x", foods: [{ kind: "P", text: "  " }] }).ok, false, "blank rows dropped → no foods");
  assert.equal(checkDraft({ title: "x", foods: Array.from({ length: 16 }, () => ({ kind: "P" as const, text: "egg" })) }).ok, false);
  const ok = checkDraft({ title: "  My   meal ", foods: [{ kind: "F", text: " spinach  " }, { kind: "C", text: "" }] });
  assert.deepEqual(ok, { ok: true, value: { title: "My meal", foods: [{ kind: "F", text: "spinach" }] } });
  assert.deepEqual(parseEdits({ lunch: { title: "", foods: [] }, snack: mine, "dinner:current": { ...mine, foods: [{ kind: "X", text: "y" }] } }), {});
  assert.equal(parseEdits({ lunch: { ...mine, savedAt: 1, previous: null } }).lunch!.title, "Chicken Bowl");
});

// Same column layout as Cronometer's food/recipe export (a subset of its ~100 columns, in order);
// the names and numbers are made up.
const HEADER =
  "Food ID,Food Name,Comments,Amount,Energy (kcal),Alcohol (g),Water (g),Calcium (mg),Net Carbs (g),Allulose (g),Carbs (g),Fiber (g),Insoluble Fiber (g),Sugars (g),Fat (g),Cholesterol (mg),Saturated (g),Omega-3 (g),Protein (g),Valine (g)";
const row = (id: number, name: string, amount: string, kcal: string, net: string, carbs: string, fiber: string, fat: string, protein: string) =>
  `${id},"${name}","","${amount}",${kcal},0.00,500.0,100.0,${net},,${carbs},${fiber},10.0,12.0,${fat},90.0,2.0,0.5,${protein},2.0`;

test("Cronometer recipe export: name, serving and per-serving nutrition are read; food list untouched", () => {
  const r = parseCronometerFoods(`${HEADER}\n${row(1, "Test Chicken Bowl", "serving  — 812.0g", "510.25", "35.40", "51.10", "15.70", "12.35", "60.12")}\n`);
  assert.ok("foods" in r);
  assert.equal(r.foods.length, 1);
  assert.deepEqual(r.foods[0], { source: "cronometer", recipe: "Test Chicken Bowl", serving: "1 serving (812 g)", kcal: 510.3, protein: 60.1, netCarbs: 35.4, fiber: 15.7, fat: 12.4 });
  assert.equal(nutritionLine(r.foods[0]), "≈510 kcal · 60.1 g protein · 35.4 g net carbs · 12.4 g fat · 15.7 g fiber");
  assert.equal(tidyServing("1.50 cup"), "1.5 cup");
  assert.equal(tidyServing("2 servings — 450.5g"), "2 servings (450.5 g)");
  // Saving it with a meal keeps the plan's foods (the export has no ingredients).
  const e = editMeal({}, "current", lunch, { title: r.foods[0].recipe, foods: lunch.foods, nutrition: r.foods[0] }, 1);
  const shown = applyEdits("current", MEALS.current, e).find((m) => m.id === "lunch")!;
  assert.equal(shown.title, "Test Chicken Bowl");
  assert.deepEqual(shown.foods, lunch.foods);
  assert.equal(shown.nutrition!.kcal, 510.3);
  assert.equal(parseEdits(JSON.parse(JSON.stringify(e))).lunch!.nutrition!.protein, 60.1, "survives storage");
});

test("Cronometer recipe export: several recipes, missing or absurd values, and wrong files", () => {
  const two = parseCronometerFoods(`${HEADER}\n${row(1, "Bowl A", "serving — 900g", "400", "30", "45", "15", "5", "50")}\n${row(2, "Bowl B", "serving — 700g", "999999", "", "40", "10", "-3", "40")}`);
  assert.ok("foods" in two);
  assert.deepEqual(two.foods.map((f) => f.recipe), ["Bowl A", "Bowl B"]);
  assert.equal(two.foods[1].kcal, null, "absurd energy dropped");
  assert.equal(two.foods[1].fat, null, "negative fat dropped");
  assert.equal(two.foods[1].netCarbs, 30, "net carbs worked out from carbs − fiber when missing");
  const daily = parseCronometerFoods("Date,Energy (kcal),Protein (g)\n2026-10-20,1500,150");
  assert.ok("error" in daily && /food or recipe export/.test(daily.error));
  assert.ok("error" in parseCronometerFoods("hello"));
  assert.equal(checkDraft({ ...mine, nutrition: { source: "cronometer", recipe: "", serving: "", kcal: 1, protein: 1, netCarbs: 1, fiber: 1, fat: 1 } }).ok, false, "malformed nutrition refused");
});
