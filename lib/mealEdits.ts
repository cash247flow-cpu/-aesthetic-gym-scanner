// Your own version of each meal in the plan. The built-in plan stays as the default; an edit
// replaces a meal's name and food list (the meal slot — breakfast, lunch, dinner — and its time
// stay fixed). Breakfast and lunch are the same in both phases, so one edit covers both; dinner
// differs between phases, so it is edited per phase. Each edit keeps the version it replaced,
// so it can be undone, and a meal can always be reset to the plan's default.
//
// Stored on this phone only (included in backups). The per-day "eaten" ticks are keyed by meal
// slot, not content, so editing a meal never changes what was ticked.

import type { Food, FoodKind, Meal, MealId, MealPhase } from "@/lib/meals";
import { validNutrition, type MealNutrition } from "@/lib/cronometerMeals";

export const MEAL_EDITS_KEY = "ags:meals:custom";
export const LIMITS = { title: 80, foods: 15, foodText: 120 } as const;
const KINDS: FoodKind[] = ["P", "F", "C", "note"];

/** A meal's name and foods, plus (optionally) nutrition totals imported from a Cronometer recipe. */
export type MealContent = { title: string; foods: Food[]; nutrition?: MealNutrition };
export type MealEdit = MealContent & { savedAt: number; previous: MealContent | null };
export type MealEdits = Partial<Record<string, MealEdit>>;

/** Storage slot for a meal: breakfast and lunch are shared by both phases, dinner is per phase. */
export const editKey = (phase: MealPhase, id: MealId) => (id === "dinner" ? `dinner:${phase}` : id);

const content = (m: MealContent): MealContent => ({
  title: m.title,
  foods: m.foods.map((f) => ({ kind: f.kind, text: f.text })),
  ...(m.nutrition ? { nutrition: { ...m.nutrition } } : {}),
});
export const sameContent = (a: MealContent, b: MealContent) => JSON.stringify(content(a)) === JSON.stringify(content(b));

/** Tidies a draft and returns what's wrong with it, if anything. Blank food rows are dropped. */
export function checkDraft(draft: MealContent): { ok: true; value: MealContent } | { ok: false; error: string } {
  const title = draft.title.trim().replace(/\s+/g, " ");
  const foods = draft.foods.map((f) => ({ kind: f.kind, text: f.text.trim().replace(/\s+/g, " ") })).filter((f) => f.text !== "");
  if (!title) return { ok: false, error: "Give the meal a name." };
  if (title.length > LIMITS.title) return { ok: false, error: `Keep the name under ${LIMITS.title} characters.` };
  if (!foods.length) return { ok: false, error: "Add at least one food." };
  if (foods.length > LIMITS.foods) return { ok: false, error: `Up to ${LIMITS.foods} foods per meal.` };
  if (foods.some((f) => f.text.length > LIMITS.foodText)) return { ok: false, error: `Keep each food under ${LIMITS.foodText} characters.` };
  if (foods.some((f) => !KINDS.includes(f.kind))) return { ok: false, error: "Pick a type for each food." };
  if (draft.nutrition && !validNutrition(draft.nutrition)) return { ok: false, error: "The Cronometer values couldn't be read — import the file again." };
  return { ok: true, value: { title, foods, ...(draft.nutrition ? { nutrition: draft.nutrition } : {}) } };
}

const validContent = (v: unknown): v is MealContent => {
  if (!v || typeof v !== "object") return false;
  const c = v as MealContent;
  return typeof c.title === "string" && Array.isArray(c.foods) && checkDraft(c).ok;
};

/** Reads stored edits, ignoring anything malformed (it falls back to the plan's default). */
export function parseEdits(raw: unknown): MealEdits {
  if (!raw || typeof raw !== "object") return {};
  const out: MealEdits = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^(breakfast|lunch|dinner:(current|phase2))$/.test(k) || !validContent(v)) continue;
    const e = v as MealEdit;
    out[k] = { ...content(e), savedAt: Number(e.savedAt) || 0, previous: validContent(e.previous) ? content(e.previous) : null };
  }
  return out;
}

export function loadMealEdits(): MealEdits {
  try {
    return parseEdits(JSON.parse(localStorage.getItem(MEAL_EDITS_KEY) ?? "{}"));
  } catch {
    return {};
  }
}

export function saveMealEdits(edits: MealEdits) {
  try {
    if (Object.keys(edits).length) localStorage.setItem(MEAL_EDITS_KEY, JSON.stringify(edits));
    else localStorage.removeItem(MEAL_EDITS_KEY);
  } catch {
    /* ignore */
  }
}

/** The plan's meals with your edits applied; `edited` marks meals that differ from the default. */
export function applyEdits(phase: MealPhase, defaults: Meal[], edits: MealEdits): (Meal & { nutrition?: MealNutrition; edited: boolean; canUndo: boolean })[] {
  return defaults.map((m) => {
    const e = edits[editKey(phase, m.id)];
    const shown = e ? { ...m, ...content(e) } : m;
    return { ...shown, edited: !sameContent(shown, m), canUndo: !!e?.previous };
  });
}

/** Saves new content for a meal, remembering what it replaced. Pure. No-op if nothing changed. */
export function editMeal(edits: MealEdits, phase: MealPhase, base: Meal, next: MealContent, now = Date.now()): MealEdits {
  const key = editKey(phase, base.id);
  const current = edits[key] ? content(edits[key]!) : content(base);
  if (sameContent(current, next)) return edits;
  return { ...edits, [key]: { ...content(next), savedAt: now, previous: current } };
}

/** Goes back to the version before the last save (or reset). Pure. */
export function undoMeal(edits: MealEdits, phase: MealPhase, base: Meal): MealEdits {
  const key = editKey(phase, base.id);
  const e = edits[key];
  if (!e?.previous) return edits;
  const rest = { ...edits };
  delete rest[key];
  return sameContent(e.previous, base) ? rest : { ...rest, [key]: { ...e.previous, savedAt: e.savedAt, previous: null } };
}

/** Back to the plan's default — itself undoable once. Pure. */
export const resetMeal = (edits: MealEdits, phase: MealPhase, base: Meal, now = Date.now()) => editMeal(edits, phase, base, content(base), now);
