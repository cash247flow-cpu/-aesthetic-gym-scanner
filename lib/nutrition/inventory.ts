// Food the user has confirmed they have. Scan results are only a draft until the user confirms
// them; nothing is ever marked used up, bought or eaten without the user saying so.

import type { Per100 } from "./foods";
import { KEYS, cleanText, newId, num, readJson, writeJson, type KV } from "./store";

export const UNITS = ["g", "kg", "ml", "l", "oz", "lb", "item", "can", "pack", "bag", "bottle", "carton", "jar", "bunch", "dozen"] as const;
export type Unit = (typeof UNITS)[number];

export type Nutrition = Per100 & { source: "label"; per: "100g" }; // only from a label the user confirmed

export type InventoryItem = {
  id: string;
  name: string;
  qty: number | null; // null = the user didn't say how much
  unit: Unit | null;
  note: string; // e.g. "about half left"
  source: "scan" | "manual" | "grocery";
  addedAt: number;
  nutrition?: Nutrition;
};

/** A draft row from a scan or typed entry, before the user confirms it. */
export type Draft = { name: string; qty: number | null; unit: Unit | null; note: string; confidence?: "high" | "medium" | "low" };

const LIMITS = { items: 150, name: 60, note: 80 };

export const toUnit = (u: unknown): Unit | null => {
  const s = cleanText(u, 12).toLowerCase().replace(/s$/, "");
  const map: Record<string, Unit> = { gram: "g", kilogram: "kg", millilitre: "ml", milliliter: "ml", litre: "l", liter: "l", ounce: "oz", pound: "lb", piece: "item", pc: "item", each: "item", package: "pack", box: "pack", carton: "carton", jar: "jar" };
  const v = (map[s] ?? s) as Unit;
  return (UNITS as readonly string[]).includes(v) ? v : null;
};

export function validNutrition(n: unknown): Nutrition | undefined {
  if (!n || typeof n !== "object") return undefined;
  const r = n as Record<string, unknown>;
  const kcal = num(r.kcal, 0, 900);
  const protein = num(r.protein, 0, 100);
  const carbs = num(r.carbs, 0, 100);
  const fat = num(r.fat, 0, 100);
  const fiber = num(r.fiber ?? 0, 0, 100);
  if (kcal === null || protein === null || carbs === null || fat === null || fiber === null) return undefined;
  return { kcal, protein, carbs, fat, fiber, source: "label", per: "100g" };
}

function parseItem(v: unknown): InventoryItem | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const name = cleanText(r.name, LIMITS.name);
  if (!name || typeof r.id !== "string") return null;
  const source = r.source === "scan" || r.source === "grocery" ? r.source : "manual";
  return {
    id: r.id.slice(0, 64),
    name,
    qty: num(r.qty, 0.1, 100000),
    unit: toUnit(r.unit),
    note: cleanText(r.note, LIMITS.note),
    source,
    addedAt: typeof r.addedAt === "number" ? r.addedAt : 0,
    ...(validNutrition(r.nutrition) ? { nutrition: validNutrition(r.nutrition) } : {}),
  };
}

export const parseInventory = (raw: unknown): InventoryItem[] =>
  Array.isArray(raw) ? raw.map(parseItem).filter((x): x is InventoryItem => !!x).slice(0, LIMITS.items) : [];

export const loadInventory = (kv?: KV | null) => readJson(KEYS.inventory, parseInventory, kv);
export const saveInventory = (items: InventoryItem[], kv?: KV | null) => writeJson(KEYS.inventory, items.length ? items : null, kv);

/** Checks a draft row; returns an error message or the tidy row. */
export function checkDraft(d: Draft): { ok: true; value: Draft } | { ok: false; error: string } {
  const name = cleanText(d.name, LIMITS.name);
  if (!name) return { ok: false, error: "Each item needs a name." };
  const qty = d.qty === null ? null : num(d.qty, 0.1, 100000);
  if (d.qty !== null && qty === null) return { ok: false, error: `Check the amount for ${name}.` };
  return { ok: true, value: { name, qty, unit: qty === null ? null : d.unit, note: cleanText(d.note, LIMITS.note) } };
}

/**
 * Adds confirmed rows. A row with the same name and unit as an existing item updates that item's
 * amount (the user just confirmed what's there now) instead of creating a duplicate.
 */
export function confirmDrafts(items: InventoryItem[], drafts: Draft[], source: InventoryItem["source"], now = Date.now()): InventoryItem[] {
  const next = [...items];
  for (const d of drafts) {
    const c = checkDraft(d);
    if (!c.ok) continue;
    const i = next.findIndex((x) => x.name.toLowerCase() === c.value.name.toLowerCase() && x.unit === c.value.unit);
    const row = { name: c.value.name, qty: c.value.qty, unit: c.value.unit, note: c.value.note };
    if (i >= 0) next[i] = { ...next[i], ...row, addedAt: now, source };
    else next.push({ id: newId(), ...row, source, addedAt: now });
  }
  return next.slice(0, LIMITS.items);
}

export const editItem = (items: InventoryItem[], id: string, patch: Partial<Omit<InventoryItem, "id">>) =>
  items.map((x) => (x.id === id ? (parseItem({ ...x, ...patch }) ?? x) : x));
export const removeItem = (items: InventoryItem[], id: string) => items.filter((x) => x.id !== id);

/** "Added 9 days ago — still have it?" for older items; nothing is removed automatically. */
export function ageLabel(item: InventoryItem, now = Date.now()): { days: number; text: string; stale: boolean } {
  const days = item.addedAt ? Math.floor((now - item.addedAt) / 86_400_000) : 0;
  if (days >= 7) return { days, text: `Added ${days} days ago — still have it?`, stale: true };
  return { days, text: days === 0 ? "Added today" : days === 1 ? "Added yesterday" : `Added ${days} days ago`, stale: false };
}

/** Grams available, when the user gave an amount we can convert; otherwise null (unknown). */
export function gramsAvailable(item: InventoryItem, unitGrams?: number): number | null {
  if (item.qty === null || item.unit === null) return null;
  const per: Partial<Record<Unit, number>> = { g: 1, kg: 1000, oz: 28.35, lb: 453.6, ml: 1, l: 1000 };
  if (per[item.unit]) return Math.round(item.qty * per[item.unit]!);
  if ((item.unit === "item" || item.unit === "can") && unitGrams) return Math.round(item.qty * unitGrams);
  if (item.unit === "dozen" && unitGrams) return Math.round(item.qty * 12 * unitGrams);
  return null;
}

export const fmtQty = (qty: number | null, unit: Unit | null) => (qty === null ? "amount not set" : `${qty}${unit ? ` ${unit}` : ""}`);
