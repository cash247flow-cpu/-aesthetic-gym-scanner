// What the user confirmed they ate, with portions. A suggestion is never logged by itself:
// an entry is only written when the user confirms the foods and grams. Re-confirming the same
// suggestion on the same day is refused (duplicate), and every entry can be edited or undone.

import { add, ZERO, type NetCarbsBasis, type Per100 } from "./foods";
import { KEYS, cleanText, localDate, newId, num, readJson, writeJson, type KV } from "./store";

export type Source = "estimate" | "label" | "cronometer";

/** Which reference data computed an entry. Entries without it predate the FDC-sourced reference (2026-11-01). */
export const REF_VERSION = "fdc-sr-legacy@2026-11-01";

export type LoggedFood = {
  name: string;
  grams: number;
  totals: Per100; // carbs are NET carbs; fiber null = not reported by the source
  source: Source;
  fdcId?: number; // reference food used, if any
  weighed?: string; // e.g. "cooked weight"
  netCarbsBasis?: NetCarbsBasis;
  refVersion?: string;
};
export type LogEntry = {
  id: string;
  date: string; // local YYYY-MM-DD
  at: number;
  title: string;
  sourceKey: string; // the suggestion it came from (or "manual:<id>") — used for duplicate checks
  foods: LoggedFood[];
  totals: Per100;
  source: Source | "mixed";
};

const per = (v: unknown): Per100 | null => {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const kcal = num(r.kcal, 0, 10000);
  const protein = num(r.protein, 0, 1000);
  const carbs = num(r.carbs, 0, 1000);
  const fat = num(r.fat, 0, 1000);
  // Missing fiber stays missing (null); it isn't turned into 0.
  const fiber = r.fiber === null || r.fiber === undefined ? null : num(r.fiber, 0, 1000);
  if (r.fiber != null && fiber === null) return null;
  return kcal === null || protein === null || carbs === null || fat === null ? null : { kcal, protein, carbs, fat, fiber };
};

const SOURCES: Source[] = ["estimate", "label", "cronometer"];

function parseEntry(v: unknown): LogEntry | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return null;
  const foods = Array.isArray(r.foods)
    ? r.foods
        .map((f) => {
          const x = f as Record<string, unknown>;
          const totals = per(x?.totals);
          const grams = num(x?.grams, 0, 5000);
          const name = cleanText(x?.name, 60);
          if (!totals || grams === null || !name) return null;
          const food: LoggedFood = { name, grams, totals, source: SOURCES.includes(x.source as Source) ? (x.source as Source) : "estimate" };
          if (typeof x.fdcId === "number" && Number.isInteger(x.fdcId)) food.fdcId = x.fdcId;
          if (typeof x.weighed === "string") food.weighed = cleanText(x.weighed, 40);
          if (x.netCarbsBasis === "carbs-minus-fiber" || x.netCarbsBasis === "fiber-not-reported-total-used") food.netCarbsBasis = x.netCarbsBasis;
          if (typeof x.refVersion === "string") food.refVersion = cleanText(x.refVersion, 40);
          return food;
        })
        .filter((x): x is LoggedFood => !!x)
    : [];
  const totals = per(r.totals);
  if (!foods.length || !totals) return null;
  return {
    id: r.id.slice(0, 64),
    date: r.date,
    at: typeof r.at === "number" ? r.at : 0,
    title: cleanText(r.title, 80) || "Meal",
    sourceKey: cleanText(r.sourceKey, 120),
    foods,
    totals,
    source: r.source === "mixed" || SOURCES.includes(r.source as Source) ? (r.source as LogEntry["source"]) : "estimate",
  };
}

export const parseLog = (raw: unknown): LogEntry[] => (Array.isArray(raw) ? raw.map(parseEntry).filter((x): x is LogEntry => !!x).slice(-2000) : []);
export const loadLog = (kv?: KV | null) => readJson(KEYS.log, parseLog, kv);
export const saveLog = (log: LogEntry[], kv?: KV | null) => writeJson(KEYS.log, log.length ? log : null, kv);

export const sumFoods = (foods: LoggedFood[]) => foods.reduce((t, f) => add(t, f.totals), ZERO);
export const sourceOf = (foods: { source: Source }[]): LogEntry["source"] => {
  const s = new Set(foods.map((f) => f.source));
  return s.size === 1 ? [...s][0] : "mixed";
};

export type LogResult = { ok: true; log: LogEntry[]; entry: LogEntry } | { ok: false; reason: "duplicate"; existing: LogEntry } | { ok: false; reason: "empty" };

/** Adds a confirmed meal. Refuses a second entry for the same suggestion on the same day. */
export function logMeal(
  log: LogEntry[],
  input: { title: string; sourceKey: string; foods: LoggedFood[] },
  now = new Date(),
): LogResult {
  const foods = input.foods.filter((f) => f.grams > 0);
  if (!foods.length) return { ok: false, reason: "empty" };
  const date = localDate(now);
  const existing = log.find((e) => e.date === date && e.sourceKey === input.sourceKey);
  if (existing) return { ok: false, reason: "duplicate", existing };
  const entry: LogEntry = {
    id: newId(),
    date,
    at: now.getTime(),
    title: cleanText(input.title, 80) || "Meal",
    sourceKey: cleanText(input.sourceKey, 120),
    foods,
    totals: sumFoods(foods),
    source: sourceOf(foods),
  };
  return { ok: true, log: [...log, entry], entry };
}

/** Replaces an entry's foods (a correction); totals are recomputed. */
export function correctEntry(log: LogEntry[], id: string, foods: LoggedFood[]): LogEntry[] {
  const kept = foods.filter((f) => f.grams > 0);
  if (!kept.length) return log.filter((e) => e.id !== id);
  return log.map((e) => (e.id === id ? { ...e, foods: kept, totals: sumFoods(kept), source: sourceOf(kept) } : e));
}

export const undoEntry = (log: LogEntry[], id: string) => log.filter((e) => e.id !== id);

export type Intake = {
  totals: Per100;
  basis: "cronometer" | "log";
  entries: LogEntry[];
  uncounted: string[]; // plan meals ticked as eaten that have no nutrition values
  note: string | null;
};

/**
 * Today's confirmed intake. If the user imported today's Cronometer totals, those are used on
 * their own (adding this app's entries on top would count the same food twice). Otherwise it is
 * the meals confirmed here plus plan meals ticked as eaten that carry Cronometer recipe values.
 */
export function todayIntake(opts: {
  date: string;
  log: LogEntry[];
  cronometerToday: { kcal: number | null; protein: number | null; netCarbs: number | null; carbs: number | null; fat: number | null } | null;
  planMealsEaten: { title: string; nutrition: { kcal: number | null; protein: number | null; netCarbs: number | null; fat: number | null; fiber: number | null } | null }[];
}): Intake {
  const entries = opts.log.filter((e) => e.date === opts.date);
  const c = opts.cronometerToday;
  if (c && c.kcal !== null) {
    return {
      totals: { kcal: c.kcal, protein: c.protein ?? 0, carbs: c.netCarbs ?? c.carbs ?? 0, fat: c.fat ?? 0, fiber: null },
      basis: "cronometer",
      entries,
      uncounted: [],
      note: [
        entries.length ? "Using today's Cronometer import. Meals confirmed here aren't added on top, so nothing is counted twice." : "Using today's Cronometer import.",
        c.netCarbs === null && c.carbs !== null ? "The import had no net-carb column, so total carbs are used (an upper bound)." : "",
        c.protein === null || c.fat === null ? "Some macros were missing from the import and are counted as 0." : "",
      ].filter(Boolean).join(" "),
    };
  }
  let totals = entries.reduce((t, e) => add(t, e.totals), ZERO);
  const uncounted: string[] = [];
  const partial: string[] = [];
  for (const m of opts.planMealsEaten) {
    const n = m.nutrition;
    if (n && n.kcal !== null) {
      // Missing macros on an imported recipe are counted as 0 and named below — not hidden.
      if (n.protein === null || n.netCarbs === null || n.fat === null) partial.push(m.title);
      totals = add(totals, { kcal: n.kcal, protein: n.protein ?? 0, carbs: n.netCarbs ?? 0, fat: n.fat ?? 0, fiber: n.fiber });
    } else uncounted.push(m.title);
  }
  const notes = [
    uncounted.length ? `Ticked as eaten but without nutrition values, so not counted: ${uncounted.join(", ")}. Log them here or add their Cronometer recipe in the Meal plan.` : "",
    partial.length ? `Some macros were missing for ${partial.join(", ")} and are counted as 0.` : "",
  ].filter(Boolean);
  return { totals, basis: "log", entries, uncounted, note: notes.length ? notes.join(" ") : null };
}

export type Remaining = { kcal: number; protein: number; carbs: number; fat: number };
export const remainingOf = (target: Remaining, eaten: Per100): Remaining => ({
  kcal: Math.round(target.kcal - eaten.kcal),
  protein: Math.round(target.protein - eaten.protein),
  carbs: Math.round(target.carbs - eaten.carbs),
  fat: Math.round(target.fat - eaten.fat),
});
