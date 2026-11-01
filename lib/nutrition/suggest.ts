// "What should I eat now?" — two practical meals from confirmed food, built deterministically:
// portions come from the remaining targets and the FDC-sourced reference values (or the user's own
// label values). AI is not involved here. All results are estimates — even sourced values describe a
// reference food, not the user's exact brand, cut, cooking or portion — and say where they came from.

import { FOODS, add, allergenCheck, labelToPer100, matchFood, resolveFood, scale, ZERO, type Allergen, type NetCarbsBasis, type Per100, type RefFood, type Role } from "./foods";
import { REF_VERSION } from "./log";
import { gramsAvailable, type InventoryItem } from "./inventory";
import type { Prefs } from "./prefs";
import type { Remaining, Source } from "./log";

export type Hunger = 1 | 2 | 3; // a bit · hungry · very hungry

export type Ingredient = {
  key: string;
  name: string;
  grams: number;
  display: string; // "2 eggs (≈100 g)" or "150 g"
  role: Role;
  per100: Per100; // the values used (net carbs)
  totals: Per100;
  source: Source;
  fdcId: number;
  weighed: string; // "cooked weight", "drained weight", …
  netCarbsBasis: NetCarbsBasis;
  refVersion: string;
  have: "yes" | "missing";
  amountUnknown: boolean; // in the inventory, but the user didn't say how much
  short: boolean; // in the inventory, but less than the portion
};

export type Suggestion = {
  key: string; // stable per day + content — used to stop the same suggestion being logged twice
  title: string;
  ingredients: Ingredient[];
  steps: string[];
  prepMin: number;
  totals: Per100;
  source: Source | "mixed";
  why: string[];
  missing: string[];
};

export type Excluded = { name: string; reason: string };

export type SuggestResult =
  | { status: "ok"; meals: Suggestion[]; excluded: Excluded[]; askAmounts: string[]; over: boolean; tradeoff: string | null }
  | { status: "needs-targets" }
  | { status: "needs-prefs" };

type Candidate = { food: RefFood; item: InventoryItem | null; per100: Per100; source: Source; netCarbsBasis: NetCarbsBasis };

const round5 = (g: number) => Math.max(5, Math.round(g / 5) * 5);

function blockedBy(name: string, food: RefFood | null, prefs: Prefs): string | null {
  const check = allergenCheck(name, food);
  const allergens = new Set<Allergen>([...check.known, ...check.hinted]);
  const hit = prefs.allergies.find((a) => allergens.has(a));
  if (hit) return `contains or may contain ${hit} (your allergy list)`;
  // Cross-contact the reference food is known for (e.g. oats processed with wheat).
  if (check.caution && prefs.allergies.includes("wheat/gluten") && /wheat|gluten/.test(check.caution)) return `may contain wheat/gluten through processing — ${check.caution}`;
  const text = `${name} ${food?.name ?? ""}`.toLowerCase();
  const avoided = prefs.avoid.find((a) => a && text.includes(a));
  if (avoided) return `on your avoid list ("${avoided}")`;
  return null;
}

/** Sorts what's on hand into usable candidates, and explains anything left out. */
export function candidates(inventory: InventoryItem[], prefs: Prefs) {
  const usable: Candidate[] = [];
  const excluded: Excluded[] = [];
  for (const item of inventory) {
    const food = resolveFood(item.name, item.refKey);
    const blocked = blockedBy(item.name, food, prefs);
    if (blocked) {
      excluded.push({ name: item.name, reason: blocked });
      continue;
    }
    if (!food) {
      const m = matchFood(item.name);
      const allergyNote = prefs.allergies.length ? " Until then it can't be checked against your allergies." : "";
      excluded.push({
        name: item.name,
        reason:
          m.status === "confirm"
            ? `needs a choice: ${m.question} Pick it under Fridge.${allergyNote}`
            : `not in the reference list, so no values are assumed. Choose a reference food under Fridge or use the label.${allergyNote}`,
      });
      continue;
    }
    if (item.nutrition) {
      const l = labelToPer100(item.nutrition);
      usable.push({ food, item, per100: l.per100, source: "label", netCarbsBasis: l.basis });
    } else usable.push({ food, item, per100: food.per100, source: "estimate", netCarbsBasis: food.netCarbsBasis });
  }
  return { usable, excluded };
}

/** Staples to suggest buying when nothing on hand fills a role (respecting allergies/avoid). */
function staple(role: Role, prefs: Prefs, maxPrep: number, skip: Set<string>): Candidate | null {
  const ok = FOODS.filter((f) => f.role === role && !skip.has(f.key) && !blockedBy(f.name, f, prefs));
  const quick = ok.filter((f) => f.prepMin <= maxPrep);
  const pick = (quick.length ? quick : ok).sort((a, b) => a.prepMin - b.prepMin)[0];
  return pick ? { food: pick, item: null, per100: pick.per100, source: "estimate", netCarbsBasis: pick.netCarbsBasis } : null;
}

function pickRole(pool: Candidate[], role: Role | Role[], maxPrep: number, skip: Set<string>, lean = false): Candidate | null {
  const roles = Array.isArray(role) ? role : [role];
  const ofRole = pool.filter((c) => roles.includes(c.food.role) && !skip.has(c.food.key));
  if (!ofRole.length) return null;
  const quick = ofRole.filter((c) => c.food.prepMin <= maxPrep);
  const density = (c: Candidate) => c.per100.kcal / Math.max(c.per100.protein, 0.1);
  return (quick.length ? quick : ofRole).sort((a, b) => (lean ? density(a) - density(b) : 0) || a.food.prepMin - b.food.prepMin)[0];
}

function portion(c: Candidate, gramsWanted: number): Ingredient {
  let grams = round5(gramsWanted);
  let display = `${grams} g`;
  const unit = c.food.unit;
  if (unit && (c.food.role === "protein" || c.food.role === "fruit") && unit.grams >= 30) {
    const n = Math.max(1, Math.min(unit.max ?? 6, Math.round(gramsWanted / unit.grams)));
    grams = n * unit.grams;
    display = `${n} ${unit.name}${n > 1 && !unit.name.includes("(") ? "s" : ""} (≈${grams} g)`;
  }
  // An amount on hand is usually raw weight; cooked reference values are per cooked gram, so the
  // two aren't compared (no conversion is assumed).
  const cookedBasis = /^cooked/.test(c.food.weighed);
  const available = c.item && !cookedBasis ? gramsAvailable(c.item, unit?.grams) : null;
  const short = available !== null && available < grams;
  if (short) {
    grams = Math.max(5, Math.floor(available! / 5) * 5);
    display = `${grams} g (all you listed)`;
  }
  return {
    key: c.food.key,
    name: c.item?.name ?? c.food.name,
    grams,
    display: `${display} · ${c.food.weighed}`,
    role: c.food.role,
    per100: c.per100,
    totals: scale(c.per100, grams),
    source: c.source,
    fdcId: c.food.source.fdcId,
    weighed: c.food.weighed,
    netCarbsBasis: c.netCarbsBasis,
    refVersion: REF_VERSION,
    have: c.item ? "yes" : "missing",
    amountUnknown: !!c.item && (c.item.qty === null || available === null),
    short,
  };
}

const sum = (xs: Ingredient[]) => xs.reduce((t, x) => add(t, x.totals), ZERO);
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

function build(
  protein: Candidate,
  others: { veg: Candidate | null; carb: Candidate | null; fat: Candidate | null },
  remaining: Remaining,
  hunger: Hunger,
  over: boolean,
  date: string,
): Suggestion {
  const proteinGoal = over ? 25 : Math.max(20, Math.min(45, remaining.protein));
  const ings: Ingredient[] = [portion(protein, (proteinGoal / Math.max(protein.per100.protein, 1)) * 100)];
  if (others.veg) ings.push(portion(others.veg, hunger === 3 ? 250 : 150));

  if (others.carb) {
    const carbsLeft = remaining.carbs - sum(ings).carbs;
    const cap = others.carb.food.role === "fruit" ? 200 : 350;
    if (!over && carbsLeft >= 10) ings.push(portion(others.carb, Math.min(cap, (Math.min(carbsLeft, 60) / Math.max(others.carb.per100.carbs, 1)) * 100)));
    else if (over && hunger === 3 && others.carb.food.role === "fruit") ings.push(portion(others.carb, 100));
  }
  if (others.fat && !over) {
    const fatLeft = remaining.fat - sum(ings).fat;
    if (fatLeft >= 8) ings.push(portion(others.fat, (Math.min(fatLeft, 15) / Math.max(others.fat.per100.fat, 1)) * 100));
  }

  // Keep within the calories left: trim the carb, then the fat — never the protein.
  for (const role of ["carb", "fruit", "fat"] as Role[]) {
    const extra = sum(ings).kcal - Math.max(remaining.kcal, 0) - 50;
    const i = ings.findIndex((x) => x.role === role);
    if (over || extra <= 0 || i === -1) continue;
    const ing = ings[i];
    const perGram = ing.totals.kcal / ing.grams;
    const grams = Math.floor((ing.grams - extra / perGram) / 5) * 5;
    if (grams < 15) ings.splice(i, 1);
    else {
      ings[i] = { ...ing, grams, display: `${grams} g · ${ing.weighed}`, totals: scale(ing.per100, grams) };
    }
  }

  const totals = sum(ings);
  const used = ings.map((x) => FOODS.find((f) => f.key === x.key)!).filter(Boolean);
  const steps = [...new Set(used.map((f) => f.how))];
  steps.push(over ? "Eat it slowly, then call it a night — tomorrow starts from your normal targets." : "Plate it up and enjoy it.");
  const prepMin = Math.max(...used.map((f) => f.prepMin), 1);
  const sources = new Set(ings.map((x) => x.source));
  const why: string[] = [];
  if (over) {
    why.push("You're at or past today's calorie target. If you're hungry, this keeps it modest and protein-forward.");
    why.push("No need to cut tomorrow's food to make up for it — tomorrow starts from your normal targets.");
  } else {
    why.push(`≈${Math.round(totals.protein)} g protein — about ${pct(totals.protein, remaining.protein)}% of the ${Math.max(remaining.protein, 0)} g you have left.`);
    if (ings.some((x) => x.role === "carb" || x.role === "fruit")) why.push(`≈${Math.round(totals.carbs)} g net carbs of the ${Math.max(remaining.carbs, 0)} g left for today.`);
    else if (remaining.carbs < 10) why.push("No starchy carb, because today's carb target is used up. That's about your plan for today, not a rule against carbs.");
    why.push(`≈${totals.kcal} kcal, leaving about ${Math.max(remaining.kcal - totals.kcal, 0)} kcal for the rest of today.`);
  }
  if (!over && totals.fat > remaining.fat + 5) {
    const fattiest = [...ings].sort((a, b) => b.totals.fat - a.totals.fat)[0];
    why.push(`Tradeoff: ≈${Math.round(totals.fat)} g fat is over the ${Math.max(remaining.fat, 0)} g left. A smaller portion of ${fattiest.name} keeps it closer.`);
  }
  if (hunger === 3 && ings.some((x) => x.role === "veg")) why.push("A bigger portion of vegetables adds volume for how hungry you are.");
  const noFiber = ings.filter((x) => x.netCarbsBasis === "fiber-not-reported-total-used").map((x) => x.name);
  if (noFiber.length) why.push(`Net carbs for ${noFiber.join(", ")} use total carbohydrate because the source reports no fiber value (an upper bound).`);
  const missing = ings.filter((x) => x.have === "missing").map((x) => x.name);
  // Same day + same foods = the same meal, even if portions shift after something else is logged.
  const key = `sugg:${date}:${ings.map((x) => x.key).sort().join("+")}`;
  return {
    key,
    title: titleOf(ings),
    ingredients: ings,
    steps,
    prepMin,
    totals,
    source: sources.size === 1 ? [...sources][0] : "mixed",
    why,
    missing,
  };
}

function titleOf(ings: Ingredient[]) {
  const order: Role[] = ["protein", "carb", "fruit", "veg", "fat"];
  const names = order.flatMap((r) => ings.filter((x) => x.role === r).map((x) => x.name.replace(/\s*\(.*\)$/, "")));
  const s = names.join(", ").replace(/, ([^,]*)$/, " & $1");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function suggestMeals(input: {
  remaining: Remaining | null;
  prefs: Prefs | null;
  inventory: InventoryItem[];
  maxPrep: number;
  hunger: Hunger;
  date: string;
}): SuggestResult {
  if (!input.remaining) return { status: "needs-targets" };
  if (!input.prefs) return { status: "needs-prefs" };
  const { usable, excluded } = candidates(input.inventory, input.prefs);
  const over = input.remaining.kcal <= 0;
  const meals: Suggestion[] = [];
  const usedProteins = new Set<string>();

  for (let n = 0; n < 2; n++) {
    let protein = pickRole(usable, "protein", input.maxPrep, usedProteins, over);
    if (!protein && n === 1) protein = pickRole(usable, "protein", input.maxPrep, new Set(), over); // only one protein on hand: vary the sides
    protein ??= staple("protein", input.prefs, input.maxPrep, usedProteins);
    if (!protein) break;
    usedProteins.add(protein.food.key);
    const skipSides = new Set<string>(n === 1 && meals[0] ? meals[0].ingredients.filter((x) => x.role !== "protein").map((x) => x.key) : []);
    const veg = pickRole(usable, "veg", input.maxPrep, skipSides) ?? pickRole(usable, "veg", input.maxPrep, new Set()) ?? staple("veg", input.prefs, input.maxPrep, skipSides);
    const carb =
      pickRole(usable, ["carb", "fruit"], input.maxPrep, skipSides) ??
      pickRole(usable, ["carb", "fruit"], input.maxPrep, new Set()) ??
      (input.remaining.carbs >= 10 && !over ? staple("carb", input.prefs, input.maxPrep, skipSides) : null);
    const fat = pickRole(usable, "fat", input.maxPrep, skipSides) ?? pickRole(usable, "fat", input.maxPrep, new Set());
    let m = build(protein, { veg, carb, fat }, input.remaining, input.hunger, over, input.date);
    if (meals.some((x) => x.key === m.key)) {
      // Nothing else on hand makes a different meal: offer one with a protein to buy instead.
      const alt = staple("protein", input.prefs, input.maxPrep, usedProteins);
      if (!alt) continue;
      usedProteins.add(alt.food.key);
      m = build(alt, { veg, carb, fat }, input.remaining, input.hunger, over, input.date);
      if (meals.some((x) => x.key === m.key)) continue;
    }
    meals.push(m);
  }

  const askAmounts = [
    ...new Set(
      meals.flatMap((m) =>
        m.ingredients
          .filter((x) => x.amountUnknown)
          .map((x) =>
            /^cooked/.test(x.weighed)
              ? `${x.name}: the portion is ${x.grams} g cooked weight. Raw weight is more, so check you have enough.`
              : `How much ${x.name} do you have? The portion assumes at least ${x.grams} g.`,
          ),
      ),
    ),
  ];
  let tradeoff: string | null = null;
  if (meals.length === 2) {
    const [a, b] = meals;
    const faster = a.prepMin <= b.prepMin ? a : b;
    const other = faster === a ? b : a;
    tradeoff =
      faster.prepMin < other.prepMin
        ? `“${faster.title}” is ready in about ${faster.prepMin} min; “${other.title}” takes about ${other.prepMin} min${other.totals.protein > faster.totals.protein + 3 ? ` but has more protein (≈${Math.round(other.totals.protein)} g vs ≈${Math.round(faster.totals.protein)} g)` : ""}.`
        : `Both take about ${a.prepMin} min — pick whichever you'd rather eat.`;
  }
  return { status: "ok", meals, excluded, askAmounts, over, tradeoff };
}
