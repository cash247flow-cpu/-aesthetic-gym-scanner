// Reference-data fidelity for the nutrition coach — run with `npm test`. No network: it checks the
// code against the committed FoodData Central snapshot (lib/nutrition/data/fdc-snapshot.json) and a
// few values read from the FDC API response when it was retrieved.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FOODS, FOOD_BY_KEY, SNAPSHOT_FOODS, SNAPSHOT_RETRIEVED, add, allergenCheck, allergensOf, labelToPer100, matchFood, netCarbs, resolveFood, scale } from "@/lib/nutrition/foods";
import { candidates, suggestMeals } from "@/lib/nutrition/suggest";
import { compareLabel, normalizeLabel } from "@/lib/nutrition/readings";
import { correctEntry, logMeal, parseLog, REF_VERSION } from "@/lib/nutrition/log";
import { groceryWarnings } from "@/lib/nutrition/grocery";
import type { Prefs } from "@/lib/nutrition/prefs";
import type { InventoryItem } from "@/lib/nutrition/inventory";

const prefs = (p: Partial<Prefs> = {}): Prefs => ({ allergies: [], avoid: [], prepMin: 30, budget: false, savedAt: 1, ...p });
const item = (name: string, extra: Partial<InventoryItem> = {}): InventoryItem => ({ id: name, name, qty: null, unit: null, note: "", source: "manual", addedAt: Date.now(), ...extra });
const snap = new Map(SNAPSHOT_FOODS.map((f) => [f.fdcId, f]));

// ── Source fidelity ──
test("every reference food comes from the snapshot, unchanged, with full provenance", () => {
  assert.equal(SNAPSHOT_RETRIEVED, "2026-11-01");
  assert.equal(FOODS.length, SNAPSHOT_FOODS.length, "one reference food per retrieved record, no orphans");
  const ids = new Set(FOODS.map((f) => f.source.fdcId));
  assert.equal(ids.size, FOODS.length, "no FDC record used twice");
  for (const f of FOODS) {
    const s = snap.get(f.source.fdcId)!;
    assert.ok(s, f.key);
    assert.equal(f.source.description, s.description, f.key);
    assert.equal(f.source.dataType, "SR Legacy", f.key);
    assert.equal(f.source.url, `https://fdc.nal.usda.gov/food-details/${f.source.fdcId}/nutrients`);
    assert.equal(f.source.retrieved, "2026-11-01");
    for (const k of ["kcal", "protein", "carbs", "fiber", "fat"] as const) {
      const v = s.per100g[k];
      assert.equal(f.nutrients[k], v ? v.value : null, `${f.key}.${k}`);
    }
    assert.equal(s.per100g.kcal?.unit.toLowerCase(), "kcal", f.key);
    for (const k of ["protein", "carbs", "fat"] as const) assert.equal(s.per100g[k]?.unit.toLowerCase(), "g", `${f.key}.${k} unit`);
    assert.equal(f.per100.kcal, f.nutrients.kcal);
    assert.equal(f.per100.protein, f.nutrients.protein);
    assert.equal(f.per100.fat, f.nutrients.fat);
  }
});

test("spot checks against values read from the FDC API response at retrieval", () => {
  // fdcId → [kcal, protein, total carbs, fiber, fat] per 100 g, copied from the raw format=full API
  // responses (not from the snapshot), so an accidental snapshot edit is caught.
  const seen: Record<number, [number, number, number, number | null, number]> = {
    171477: [165, 31.02, 0, 0, 3.57], // chicken breast, roasted
    171794: [230, 28.45, 0, 0, 12.04], // ground beef 90% lean, pan-browned
    171287: [143, 12.56, 0.72, 0, 9.51], // egg, whole, raw
    172470: [598, 22.21, 22.31, 5.0, 51.36], // peanut butter, smooth, no salt
    175037: [306, 8.2, 49.38, 3.5, 7.99], // flour tortilla
    172688: [252, 12.45, 42.71, 6.0, 3.5], // whole-wheat bread
    171956: [105, 22.83, 0, 0, 0.86], // Atlantic cod, cooked
    175177: [128, 26.15, 0, 0, 2.65], // tilapia, cooked
    173757: [164, 8.86, 27.42, 7.6, 2.59], // chickpeas, boiled
    173735: [132, 8.86, 23.71, 8.7, 0.54], // black beans, boiled
    175180: [99, 23.98, 0.2, null, 0.28], // shrimp, cooked — fiber not reported
  };
  for (const [id, [kcal, protein, carbs, fiber, fat]] of Object.entries(seen)) {
    const f = FOODS.find((x) => x.source.fdcId === Number(id))!;
    assert.deepEqual([f.nutrients.kcal, f.nutrients.protein, f.nutrients.carbs, f.nutrients.fiber, f.nutrients.fat], [kcal, protein, carbs, fiber, fat], `FDC ${id}`);
  }
});

// ── Food identity: no silent substitution ──
test("distinct foods stay distinct; broad words and unknown names never resolve silently", () => {
  const key = (n: string) => {
    const m = matchFood(n);
    return m.status === "match" ? m.food.key : m.status;
  };
  assert.equal(key("flour tortilla"), "tortilla-flour");
  assert.equal(key("whole wheat bread"), "bread-whole-wheat");
  assert.notEqual(FOOD_BY_KEY.get("tortilla-flour")!.source.fdcId, FOOD_BY_KEY.get("bread-whole-wheat")!.source.fdcId);
  assert.equal(key("tilapia"), "tilapia");
  assert.equal(key("atlantic cod"), "cod-atlantic");
  assert.equal(key("cod"), "confirm"); // Atlantic vs Pacific
  assert.equal(key("chickpeas"), "chickpeas");
  assert.equal(key("garbanzo beans"), "chickpeas");
  assert.equal(key("black beans"), "black-beans");
  assert.equal(key("sweet potato"), "sweet-potato-baked");
  assert.equal(key("egg whites"), "egg-white");
  for (const broad of ["nuts", "oil", "rice", "bread", "tortilla", "wrap", "salad", "milk", "cheese", "fish", "beans", "salmon", "tuna", "chicken", "yogurt", "greek yogurt", "sardines"]) {
    assert.equal(key(broad), "confirm", broad);
  }
  for (const unknown of ["corn tortilla", "almond milk", "oat milk", "black lentils", "mixed nuts", "canola oil", "pacific cod", "whole wheat pasta", "mystery sauce"]) {
    assert.equal(key(unknown), "unknown", unknown);
  }
  // A confirmation offers only foods of the right kind.
  const nuts = matchFood("nuts");
  assert.ok(nuts.status === "confirm" && nuts.options.every((o) => o.key === "almonds"));
  const oil = matchFood("oil");
  assert.ok(oil.status === "confirm" && oil.options.map((o) => o.key).join() === "olive-oil");
  // resolveFood: an explicit user choice wins; otherwise only exact matches resolve.
  assert.equal(resolveFood("rice"), null);
  assert.equal(resolveFood("rice", "rice-brown")?.key, "rice-brown");
  assert.equal(resolveFood("rice", "not-a-food"), null);
});

// ── Preparation state and weighing basis ──
test("preparation state is preserved: names, weighing basis and FDC descriptions agree", () => {
  const cooked = ["chicken-breast", "chicken-thigh", "turkey-breast", "ground-beef-90", "salmon-farmed", "salmon-wild", "tilapia", "cod-atlantic", "shrimp", "rice-white", "rice-brown", "potato-baked", "sweet-potato-baked", "pasta-enriched", "lentils", "black-beans", "chickpeas"];
  for (const k of cooked) {
    const f = FOOD_BY_KEY.get(k)!;
    assert.match(f.source.description, /cooked|roasted|baked|boiled|pan-browned/i, k);
    assert.match(f.weighed, /^cooked/, k);
  }
  for (const k of ["egg", "egg-white", "spinach", "broccoli", "carrots", "banana", "strawberries", "pepper-red", "tofu-firm"]) {
    assert.match(FOOD_BY_KEY.get(k)!.source.description, /raw/i, k);
  }
  assert.match(FOOD_BY_KEY.get("oats-dry")!.source.description, /dry/i);
  assert.equal(FOOD_BY_KEY.get("oats-dry")!.weighed, "dry weight");
  for (const k of ["tuna-light-canned-water", "sardines-oil"]) {
    assert.match(FOOD_BY_KEY.get(k)!.source.description, /canned.*drained/i, k);
    assert.equal(FOOD_BY_KEY.get(k)!.weighed, "drained weight");
  }
  // A state word the reference doesn't state asks for confirmation instead of matching.
  for (const n of ["raw shrimp", "frozen blueberries", "canned black beans", "boiled potatoes", "raw chicken breast"]) assert.equal(matchFood(n).status, "confirm", n);
  // Cooked reference portions are never compared with a (likely raw) amount on hand.
  const r = suggestMeals({ remaining: { kcal: 800, protein: 60, carbs: 60, fat: 25 }, prefs: prefs(), inventory: [item("chicken breast", { qty: 100, unit: "g" })], maxPrep: 30, hunger: 2, date: "d" });
  assert.equal(r.status, "ok");
  if (r.status === "ok") {
    const ch = r.meals[0].ingredients.find((x) => x.key === "chicken-breast")!;
    assert.equal(ch.short, false);
    assert.match(ch.display, /cooked weight/);
    assert.ok(r.askAmounts.some((q) => /cooked weight.*Raw weight is more/.test(q)));
  }
});

// ── Units ──
test("unit weights are FDC portion weights from the same record", () => {
  const expected: Record<string, number> = { egg: 50, "egg-white": 33, banana: 118, apple: 182, "potato-baked": 173, "bread-whole-wheat": 32, "tuna-light-canned-water": 165, "sardines-oil": 92, tomato: 123, onion: 110, "pepper-red": 119, "pepper-green": 119 };
  for (const [k, g] of Object.entries(expected)) {
    const f = FOOD_BY_KEY.get(k)!;
    assert.equal(f.unit?.grams, g, k);
    assert.ok(snap.get(f.source.fdcId)!.portions.some((p) => p.label === f.unit!.fdcPortion && p.gramWeight === g), `${k} portion in snapshot`);
  }
  // Foods whose FDC record lists conflicting sizes have no unit (grams only).
  assert.equal(FOOD_BY_KEY.get("bread-white")!.unit, undefined);
  assert.equal(FOOD_BY_KEY.get("tortilla-flour")!.unit, undefined);
  assert.equal(FOOD_BY_KEY.get("avocado")!.unit, undefined);
});

// ── Missing nutrients and net carbs ──
test("missing is not zero: unreported fiber stays null and net carbs are flagged as an upper bound", () => {
  const shrimp = FOOD_BY_KEY.get("shrimp")!;
  assert.equal(shrimp.nutrients.fiber, null);
  assert.equal(shrimp.per100.fiber, null);
  assert.equal(shrimp.netCarbsBasis, "fiber-not-reported-total-used");
  assert.equal(shrimp.per100.carbs, shrimp.nutrients.carbs);
  assert.deepEqual(netCarbs({ carbs: null, fiber: 2 }), { value: null, basis: null });
  assert.deepEqual(netCarbs({ carbs: 10, fiber: 0 }), { value: 10, basis: "carbs-minus-fiber" }); // a reported zero is a zero
  assert.equal(scale(shrimp.per100, 200).fiber, null);
  assert.equal(add(scale(shrimp.per100, 100), scale(FOOD_BY_KEY.get("spinach")!.per100, 100)).fiber, null);
  // Logged and re-read: still null, not 0.
  const r = logMeal([], { title: "Shrimp", sourceKey: "k", foods: [{ name: "shrimp", grams: 150, totals: scale(shrimp.per100, 150), source: "estimate", netCarbsBasis: shrimp.netCarbsBasis }] }, new Date(2026, 10, 1));
  assert.ok(r.ok);
  if (r.ok) assert.equal(parseLog(JSON.parse(JSON.stringify(r.log)))[0].foods[0].totals.fiber, null);
  // Suggestions say so.
  const s = suggestMeals({ remaining: { kcal: 800, protein: 60, carbs: 60, fat: 25 }, prefs: prefs(), inventory: [item("shrimp", { qty: 400, unit: "g" })], maxPrep: 30, hunger: 2, date: "d" });
  if (s.status === "ok") assert.ok(s.meals[0].why.some((w) => /shrimp.*no fiber value \(an upper bound\)|Net carbs for shrimp/.test(w)));
});

test("fiber is subtracted exactly once — reference, label and log paths", () => {
  const beans = FOOD_BY_KEY.get("black-beans")!;
  assert.equal(beans.per100.carbs, Math.round((23.71 - 8.7) * 100) / 100);
  assert.deepEqual(labelToPer100({ kcal: 220, protein: 20, carbs: 24, fiber: 8, fat: 7 }).per100.carbs, 16);
  const l = normalizeLabel({ kcal: 220, protein: 20, carbs: 24, fiber: 8, fat: 7 });
  assert.ok(compareLabel(l, { kcal: 1000, protein: 100, carbs: 60, fat: 30 }, []).lines.some((x) => x.includes("≈16 g (24 g carbs − 8 g fiber)")));
  const noFiber = normalizeLabel({ kcal: 220, protein: 20, carbs: 24, fat: 7 });
  assert.ok(compareLabel(noFiber, { kcal: 1000, protein: 100, carbs: 60, fat: 30 }, []).lines.some((x) => x.includes("up to 24 g — no fiber value was read")));
  // A logged entry stores net carbs; correcting grams rescales them, it doesn't subtract fiber again.
  const totals = scale(beans.per100, 100);
  const r = logMeal([], { title: "Beans", sourceKey: "k", foods: [{ name: "black beans", grams: 100, totals, source: "estimate" }] }, new Date(2026, 10, 1));
  assert.ok(r.ok);
  if (r.ok) {
    const fixed = correctEntry(r.log, r.entry.id, [{ ...r.entry.foods[0], grams: 200, totals: scale(beans.per100, 200) }]);
    assert.equal(fixed[0].totals.carbs, Math.round(beans.per100.carbs * 2 * 10) / 10);
  }
});

// ── Allergen uncertainty ──
test("allergen checks: known vs hinted vs uncertain — never a guarantee", () => {
  assert.deepEqual(allergenCheck("mystery sauce"), { known: [], hinted: [], uncertain: true, caution: undefined });
  const pb = allergenCheck("peanut butter");
  assert.deepEqual(pb.known, ["peanuts"]);
  assert.equal(pb.uncertain, true); // packaged — brand and cross-contact vary
  assert.equal(allergenCheck("chicken breast").uncertain, false);
  assert.deepEqual(allergensOf("peanut butter"), ["peanuts"]); // not milk
  assert.deepEqual(allergensOf("eggplant"), []);
  for (const n of ["flour tortillas", "rice noodles", "crackers", "whole wheat wraps"]) assert.ok(allergensOf(n).includes("wheat/gluten"), n); // plural hints still fire (rice noodles: a cautious hint, not a claim)
  assert.deepEqual(allergensOf("spinach and feta wrap"), ["wheat/gluten"]); // a hint only; feta isn't a keyword → stays unknown
  assert.equal(allergenCheck("spinach and feta wrap").uncertain, true);
  // Oats: no inherent wheat, but the cross-contact caution excludes them for a wheat/gluten allergy.
  const { excluded } = candidates([item("rolled oats")], prefs({ allergies: ["wheat/gluten"] }));
  assert.match(excluded[0].reason, /wheat\/gluten through processing/);
  // Unknown or packaged items always point to the label; nothing says "safe".
  const w = groceryWarnings("Brand X protein bar", prefs({ allergies: ["milk"] }));
  assert.ok(w.some((x) => /Check the package label/.test(x)));
  for (const x of [...w, ...groceryWarnings("cheddar cheese", prefs({ allergies: ["milk"] }))]) assert.doesNotMatch(x, /\bsafe\b/i);
});

// ── Existing records ──
test("meals logged before this change keep their stored values; new entries record their reference", () => {
  const old = parseLog([{ id: "o1", date: "2026-10-31", at: 1, title: "Eggs", sourceKey: "k", foods: [{ name: "eggs", grams: 100, totals: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: 0 }, source: "estimate" }], totals: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: 0 }, source: "estimate" }]);
  assert.deepEqual(old[0].foods[0].totals, { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: 0 });
  assert.equal(old[0].foods[0].refVersion, undefined);
  const s = suggestMeals({ remaining: { kcal: 800, protein: 60, carbs: 60, fat: 25 }, prefs: prefs(), inventory: [item("eggs")], maxPrep: 30, hunger: 2, date: "d" });
  assert.equal(s.status, "ok");
  if (s.status === "ok") {
    const egg = s.meals[0].ingredients.find((x) => x.key === "egg")!;
    assert.equal(egg.fdcId, 171287);
    assert.equal(egg.refVersion, REF_VERSION);
    assert.equal(egg.weighed, "raw weight without shell");
  }
});
