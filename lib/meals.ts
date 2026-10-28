// The training plan's daily nutrition, listed in its PFC eating order.

export type MealPhase = "current" | "phase2";
export type MealId = "breakfast" | "lunch" | "dinner";
export type FoodKind = "P" | "F" | "C" | "note";
export type Food = { kind: FoodKind; text: string };
export type Meal = { id: MealId; title: string; when: string; foods: Food[] };
// carbs are net carbs (total minus fiber), as Cronometer is set to track them.
export type Macros = { carbs: number; protein: number; fat: number };

export const PHASES: Record<MealPhase, { label: string; macros: Macros }> = {
  current: { label: "Current", macros: { carbs: 70, protein: 155, fat: 60 } },
  phase2: { label: "Phase 2", macros: { carbs: 120, protein: 155, fat: 60 } },
};

/** kcal from the macro targets (4/4/9 per gram) — the plan itself lists only grams. */
export const kcalOf = (m: Macros) => m.carbs * 4 + m.protein * 4 + m.fat * 9;

const BREAKFAST: Meal = {
  id: "breakfast",
  title: "Egg Omelet & Sardines w/ Fruit",
  when: "Post-workout breakfast",
  foods: [
    { kind: "P", text: "3 whole eggs" },
    { kind: "P", text: "1 Chicken of the Sea sardines (drained)" },
    { kind: "F", text: "Omelet veg: spinach, mushrooms, peppers, onions" },
    { kind: "C", text: "100 g strawberries — last" },
  ],
};

const LUNCH: Meal = {
  id: "lunch",
  title: "Salmon Rice Bowl w/ Lentils & Fruit",
  when: "Lunch — best time for psyllium",
  foods: [
    { kind: "P", text: "180 g wild-caught Atlantic salmon" },
    { kind: "F", text: "2–3 cups vegetables: cucumber, tomato, spinach" },
    { kind: "F", text: "300 g cauliflower rice" },
    { kind: "note", text: "1 labeled serving of psyllium in ≥ 8 oz (240 mL) water — drink right away" },
    { kind: "C", text: "75 g Pereg black lentils" },
    { kind: "C", text: "200 g blackberries" },
  ],
};

const DINNER_CURRENT: Meal = {
  id: "dinner",
  title: "Fish Avocado Rice Bowl w/ Lentils & Fruit",
  when: "Dinner",
  foods: [
    { kind: "P", text: "170 g tilapia" },
    { kind: "F", text: "2–3 cups vegetables: cucumber, tomato, spinach" },
    { kind: "F", text: "180 g cauliflower rice" },
    { kind: "F", text: "½ avocado" },
    { kind: "C", text: "75 g Pereg black lentils" },
    { kind: "C", text: "150 g strawberries" },
  ],
};

// Phase 2 swaps dinner's cauliflower rice for a starchy carb.
const DINNER_PHASE2: Meal = {
  ...DINNER_CURRENT,
  foods: [
    { kind: "P", text: "170 g tilapia" },
    { kind: "F", text: "2–3 cups vegetables: cucumber, tomato, spinach" },
    { kind: "F", text: "½ avocado" },
    { kind: "C", text: "75 g Pereg black lentils" },
    { kind: "C", text: "180 g white rice (or 250 g white potatoes, or 330 g sweet potatoes)" },
    { kind: "C", text: "150 g strawberries" },
  ],
};

export const MEALS: Record<MealPhase, Meal[]> = {
  current: [BREAKFAST, LUNCH, DINNER_CURRENT],
  phase2: [BREAKFAST, LUNCH, DINNER_PHASE2],
};

// ─── Personal macro targets ─────────────────────────────────────────────
// The plan's numbers are only defaults: each person sets their own per phase.
const TARGETS_KEY = "ags:meals:targets";
export type Targets = Record<MealPhase, Macros>;
export const DEFAULT_TARGETS: Targets = { current: PHASES.current.macros, phase2: PHASES.phase2.macros };

const validMacros = (m: unknown): m is Macros =>
  !!m &&
  typeof m === "object" &&
  (["carbs", "protein", "fat"] as const).every((k) => {
    const v = (m as Record<string, unknown>)[k];
    return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1000;
  });

export function loadTargets(): Targets {
  try {
    const saved = JSON.parse(localStorage.getItem(TARGETS_KEY) ?? "{}") as Partial<Record<MealPhase, unknown>>;
    return {
      current: validMacros(saved.current) ? saved.current : DEFAULT_TARGETS.current,
      phase2: validMacros(saved.phase2) ? saved.phase2 : DEFAULT_TARGETS.phase2,
    };
  } catch {
    return DEFAULT_TARGETS;
  }
}

export function saveTargets(targets: Targets | null) {
  try {
    if (targets) localStorage.setItem(TARGETS_KEY, JSON.stringify(targets));
    else localStorage.removeItem(TARGETS_KEY);
  } catch {
    /* ignore */
  }
}

export const sameMacros = (a: Macros, b: Macros) => a.carbs === b.carbs && a.protein === b.protein && a.fat === b.fat;

// ─── Per-day "eaten" ticks and the chosen phase ────────────────────────
const EATEN_KEY = "ags:meals";
const PHASE_KEY = "ags:meals:phase";

type EatenLog = Record<string, Partial<Record<MealId, boolean>>>;

export function loadEaten(): EatenLog {
  try {
    return JSON.parse(localStorage.getItem(EATEN_KEY) ?? "{}") as EatenLog;
  } catch {
    return {};
  }
}

export function saveEaten(log: EatenLog) {
  try {
    localStorage.setItem(EATEN_KEY, JSON.stringify(log));
  } catch {
    /* ignore */
  }
}

export function loadPhase(): MealPhase {
  try {
    return localStorage.getItem(PHASE_KEY) === "phase2" ? "phase2" : "current";
  } catch {
    return "current";
  }
}

export function savePhase(phase: MealPhase) {
  try {
    localStorage.setItem(PHASE_KEY, phase);
  } catch {
    /* ignore */
  }
}
