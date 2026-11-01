// Editable shopping list. Items come from a chosen meal's missing ingredients or are typed in.
// Ticking an item off only means "in my basket" — nothing is added to the inventory unless the
// user confirms "I bought these". No prices, stock or store availability are claimed.

import { allergenCheck, resolveFood, FOOD_BY_KEY, type Allergen } from "./foods";
import { toUnit, type Unit } from "./inventory";
import type { Prefs } from "./prefs";
import { KEYS, cleanText, newId, num, readJson, writeJson, type KV } from "./store";

export type GroceryItem = {
  id: string;
  name: string;
  qty: number | null;
  unit: Unit | null;
  checked: boolean;
  note: string;
  from: "meal" | "manual" | "label";
  addedAt: number;
};

function parseItem(v: unknown): GroceryItem | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const name = cleanText(r.name, 60);
  if (!name || typeof r.id !== "string") return null;
  return {
    id: r.id.slice(0, 64),
    name,
    qty: num(r.qty, 0.1, 100000),
    unit: toUnit(r.unit),
    checked: r.checked === true,
    note: cleanText(r.note, 80),
    from: r.from === "meal" || r.from === "label" ? r.from : "manual",
    addedAt: typeof r.addedAt === "number" ? r.addedAt : 0,
  };
}

export const parseGrocery = (raw: unknown): GroceryItem[] => (Array.isArray(raw) ? raw.map(parseItem).filter((x): x is GroceryItem => !!x).slice(0, 200) : []);
export const loadGrocery = (kv?: KV | null) => readJson(KEYS.grocery, parseGrocery, kv);
export const saveGrocery = (items: GroceryItem[], kv?: KV | null) => writeJson(KEYS.grocery, items.length ? items : null, kv);

/** Adds an item; the same name and unit already on the list has its amount increased instead. */
export function addGrocery(
  items: GroceryItem[],
  input: { name: string; qty?: number | null; unit?: Unit | null; note?: string; from?: GroceryItem["from"] },
  now = Date.now(),
): GroceryItem[] {
  const name = cleanText(input.name, 60);
  if (!name) return items;
  const qty = input.qty == null ? null : num(input.qty, 0.1, 100000);
  const unit = qty === null ? null : (input.unit ?? null);
  const i = items.findIndex((x) => x.name.toLowerCase() === name.toLowerCase() && x.unit === unit && !x.checked);
  if (i >= 0) {
    const cur = items[i];
    const merged = cur.qty !== null && qty !== null ? Math.round((cur.qty + qty) * 10) / 10 : (cur.qty ?? qty);
    return items.map((x, j) => (j === i ? { ...x, qty: merged } : x));
  }
  return [...items, { id: newId(), name, qty, unit, checked: false, note: cleanText(input.note ?? "", 80), from: input.from ?? "manual", addedAt: now }].slice(0, 200);
}

export const toggleGrocery = (items: GroceryItem[], id: string) => items.map((x) => (x.id === id ? { ...x, checked: !x.checked } : x));
export const removeGrocery = (items: GroceryItem[], id: string) => items.filter((x) => x.id !== id);
export const editGrocery = (items: GroceryItem[], id: string, patch: Partial<Pick<GroceryItem, "name" | "qty" | "unit" | "note">>) =>
  items.map((x) => (x.id === id ? (parseItem({ ...x, ...patch }) ?? x) : x));
export const clearChecked = (items: GroceryItem[]) => items.filter((x) => !x.checked);

/** Warnings for one item against the user's allergies and avoid list (never "safe"). */
export function groceryWarnings(name: string, prefs: Prefs | null): string[] {
  if (!prefs) return [];
  const out: string[] = [];
  const check = allergenCheck(name);
  const hits = [...check.known, ...check.hinted].filter((a) => prefs.allergies.includes(a as Allergen));
  if (hits.length) out.push(`May contain ${hits.join(", ")} — on your allergy list.`);
  const avoided = prefs.avoid.find((a) => name.toLowerCase().includes(a));
  if (avoided) out.push(`On your avoid list ("${avoided}").`);
  // Never "safe": unknown or packaged items can only be settled by their own label.
  if (prefs.allergies.length && !hits.length && check.uncertain) out.push("Check the package label against your allergies — ingredients and cross-contact vary by product.");
  if (prefs.allergies.length && check.caution) out.push(check.caution);
  return out;
}

/** Simple swaps (and an optional lower-cost note), filtered by allergies and avoid list. */
export function swapsFor(name: string, prefs: Prefs | null): { swaps: string[]; budget: string | null } {
  const food = resolveFood(name);
  if (!food) return { swaps: [], budget: null };
  const swaps = (food.subs ?? [])
    .map((k) => FOOD_BY_KEY.get(k))
    .filter((f): f is NonNullable<typeof f> => !!f)
    .filter((f) => !prefs || (!f.allergens.some((a) => prefs.allergies.includes(a)) && !prefs.avoid.some((a) => f.name.toLowerCase().includes(a))))
    .map((f) => f.name);
  return { swaps, budget: prefs?.budget ? (food.budget ?? null) : null };
}
