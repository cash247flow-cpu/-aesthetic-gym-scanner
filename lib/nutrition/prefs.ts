// Dietary preferences and allergies. Allergies come from a fixed list so they can be checked
// against foods; "avoid" is free text matched against food names. Nothing here is inferred.

import { ALLERGENS, type Allergen } from "./foods";
import { KEYS, cleanText, readJson, writeJson, type KV } from "./store";

export type PrepLimit = 5 | 15 | 30 | 45;
export const PREP_LIMITS: PrepLimit[] = [5, 15, 30, 45];

export type Prefs = {
  allergies: Allergen[];
  avoid: string[]; // foods the user doesn't eat, e.g. "pork", "mushrooms"
  prepMin: PrepLimit; // default time they're willing to spend
  budget: boolean; // show lower-cost swaps (no prices are claimed)
  savedAt: number;
};

export function parsePrefs(raw: unknown): Prefs | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const allergies = Array.isArray(r.allergies) ? (r.allergies.filter((a) => ALLERGENS.includes(a as Allergen)) as Allergen[]) : [];
  const avoid = Array.isArray(r.avoid) ? r.avoid.map((a) => cleanText(a, 40).toLowerCase()).filter(Boolean).slice(0, 20) : [];
  const prepMin = PREP_LIMITS.includes(r.prepMin as PrepLimit) ? (r.prepMin as PrepLimit) : 15;
  const savedAt = typeof r.savedAt === "number" ? r.savedAt : 0;
  if (!savedAt) return null;
  return { allergies: [...new Set(allergies)], avoid: [...new Set(avoid)], prepMin, budget: r.budget === true, savedAt };
}

export const loadPrefs = (kv?: KV | null) => readJson(KEYS.prefs, parsePrefs, kv);
export const savePrefs = (p: Omit<Prefs, "savedAt">, now = Date.now(), kv?: KV | null) => {
  const clean = parsePrefs({ ...p, savedAt: now })!;
  writeJson(KEYS.prefs, clean, kv);
  return clean;
};

/** Splits "pork, mushrooms; olives" into tidy entries. */
export const parseAvoidList = (text: string) =>
  text
    .split(/[,;\n]/)
    .map((x) => cleanText(x, 40).toLowerCase())
    .filter(Boolean)
    .slice(0, 20);
