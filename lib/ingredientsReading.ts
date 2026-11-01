// Turns the AI reader's reply for an ingredient screenshot into editor rows. The reply is
// untrusted: only an "ingredients" array of { name, amount, type } is read; every value is
// type-checked, tidied and capped, and anything else in the reply is ignored. The rows are a draft
// the user reviews in the meal editor — nothing is saved from here.

import type { Food, FoodKind } from "@/lib/meals";
import { LIMITS } from "@/lib/mealEdits";

const KIND: Record<string, FoodKind> = {
  protein: "P",
  fiber: "F",
  fibre: "F",
  vegetable: "F",
  vegetables: "F",
  fat: "F",
  carbs: "C",
  carb: "C",
  carbohydrate: "C",
  carbohydrates: "C",
  fruit: "C",
  supplement: "note",
  psyllium: "note",
  note: "note",
};

// Plain text only: no control characters, no angle brackets, collapsed spaces.
const clean = (v: unknown, max: number) =>
  typeof v === "string" || typeof v === "number"
    ? String(v).replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
    : "";

export type IngredientsReading = { foods: Food[] };

export function normalizeIngredients(raw: Record<string, unknown>): IngredientsReading {
  const list = Array.isArray(raw.ingredients) ? raw.ingredients : [];
  const foods: Food[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const it = item as Record<string, unknown>;
    const name = clean(it.name, LIMITS.foodText);
    if (!name) continue;
    const amount = clean(it.amount, 30);
    const type = clean(it.type, 20).toLowerCase();
    foods.push({ kind: /psyllium/i.test(name) ? "note" : (KIND[type] ?? "F"), text: `${amount ? `${amount} ` : ""}${name}`.slice(0, LIMITS.foodText) });
    if (foods.length >= LIMITS.foods) break;
  }
  return { foods };
}
