// Naming a meal and attaching its nutrition from a Cronometer food/recipe export (Cronometer →
// Foods → export: one row per saved food or recipe, with the serving size and per-serving totals).
// Read on the phone only — nothing is uploaded, and nothing is saved until the user taps Save.
//
// The export lists a recipe's totals, not its ingredients, so it can set the meal's name and
// nutrition but never changes the food list. Columns are matched by name (the export has ~100);
// values outside a believable range are dropped rather than shown.

import { column, parseCsv, MAX_GRAMS, MAX_KCAL } from "@/lib/cronometer";

export type MealNutrition = {
  source: "cronometer";
  recipe: string; // the Cronometer food/recipe name
  serving: string; // e.g. "1 serving (923 g)"
  kcal: number | null;
  protein: number | null;
  netCarbs: number | null;
  fiber: number | null;
  fat: number | null;
};

const val = (v: string | undefined, max: number) => {
  if (v === undefined || v.trim() === "") return null;
  const x = Number(v.replace(/,/g, ""));
  return Number.isFinite(x) && x >= 0 && x <= max ? Math.round(x * 10) / 10 : null;
};

/** "serving  — 923.0g" → "1 serving (923 g)"; "1.50 cup" → "1.5 cup". */
export function tidyServing(amount: string): string {
  const a = amount.trim().replace(/\s+/g, " ");
  const m = a.match(/^(\d+(?:\.\d+)?)?\s*([^—-]+?)\s*[—-]\s*(\d+(?:\.\d+)?)\s*g$/);
  const num = (s: string) => String(Number(s));
  if (m) return `${m[1] ? num(m[1]) : "1"} ${m[2].trim()} (${num(m[3])} g)`;
  return a.replace(/(\d+(?:\.\d+)?)/g, (s) => num(s));
}

export function parseCronometerFoods(text: string): { foods: MealNutrition[] } | { error: string } {
  const rows = parseCsv(text);
  if (rows.length < 2) return { error: "That file has no rows. In Cronometer, export the recipe (Foods → your recipe → export) and try again." };
  const h = rows[0];
  const iName = column(h, /^food name$/, /^name$/);
  const iKcal = column(h, /^energy \(kcal\)$/, /^energy/, /calories/);
  if (iName === -1 || iKcal === -1) {
    return { error: "This doesn't look like a Cronometer food or recipe export (it needs Food Name and Energy columns). For daily totals, use the import under “Compare with Cronometer”." };
  }
  const iAmount = column(h, /^amount$/);
  const iProtein = column(h, /^protein \(g\)$/);
  const iNet = column(h, /^net carbs \(g\)$/);
  const iCarbs = column(h, /^carbs \(g\)$/);
  const iFiber = column(h, /^fiber \(g\)$/);
  const iFat = column(h, /^fat \(g\)$/);
  const g = (r: string[], i: number) => (i === -1 ? null : val(r[i], MAX_GRAMS));

  const foods: MealNutrition[] = [];
  for (const r of rows.slice(1)) {
    const recipe = (r[iName] ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
    if (!recipe) continue;
    const fiber = g(r, iFiber);
    const carbs = g(r, iCarbs);
    foods.push({
      source: "cronometer",
      recipe,
      serving: iAmount === -1 ? "" : tidyServing(r[iAmount] ?? "").slice(0, 40),
      kcal: val(r[iKcal], MAX_KCAL),
      protein: g(r, iProtein),
      netCarbs: g(r, iNet) ?? (carbs !== null ? Math.round(Math.max(0, carbs - (fiber ?? 0)) * 10) / 10 : null),
      fiber,
      fat: g(r, iFat),
    });
  }
  if (!foods.length) return { error: "Couldn't find any foods or recipes in that file." };
  return { foods: foods.slice(0, 200) };
}

/** One line for the meal card: "≈589 kcal · 67.6 g protein · 29.7 g net carbs · 17.4 g fat · 19 g fiber". */
export function nutritionLine(n: MealNutrition): string {
  const parts = [
    n.kcal !== null ? `≈${Math.round(n.kcal).toLocaleString()} kcal` : null,
    n.protein !== null ? `${n.protein} g protein` : null,
    n.netCarbs !== null ? `${n.netCarbs} g net carbs` : null,
    n.fat !== null ? `${n.fat} g fat` : null,
    n.fiber !== null ? `${n.fiber} g fiber` : null,
  ].filter(Boolean);
  return parts.join(" · ") || "no nutrition values in the file";
}

export const validNutrition = (v: unknown): v is MealNutrition => {
  if (!v || typeof v !== "object") return false;
  const n = v as MealNutrition;
  const okNum = (x: unknown) => x === null || (typeof x === "number" && Number.isFinite(x) && x >= 0);
  return n.source === "cronometer" && typeof n.recipe === "string" && n.recipe.length > 0 && n.recipe.length <= 80 && typeof n.serving === "string" && n.serving.length <= 40 && [n.kcal, n.protein, n.netCarbs, n.fiber, n.fat].every(okNum);
};
