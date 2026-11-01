// Units and plausibility checks shared by logging, records and the body tracker.
//
// Accuracy rules (PACSS "A"):
//  - A number is only meaningful with its unit. Set logs remember the unit they were typed in
//    (older logs without one are read in the current unit, as before).
//  - Values outside the ranges below are treated as probable typos: they stay in the log exactly
//    as typed, but never count toward records, certificates or trends. These are input sanity
//    limits (beyond any recorded human performance), not physiological advice.

export type Unit = "lb" | "kg";
export const LB_PER_KG = 2.20462;

export const toLb = (value: number, unit: Unit) => (unit === "kg" ? value * LB_PER_KG : value);
export const fromLb = (lb: number, unit: Unit) => (unit === "kg" ? lb / LB_PER_KG : lb);

/** A typed weight ("62,5", "140") converted between units, rounded to 0.1. Blank or non-numeric text is kept as is. */
export function convertWeightText(text: string, from: Unit, to: Unit): string {
  if (from === to || text.trim() === "") return text;
  const n = Number(text.replace(",", "."));
  if (!Number.isFinite(n)) return text;
  const v = from === "kg" ? n * LB_PER_KG : n / LB_PER_KG;
  return String(Math.round(v * 10) / 10);
}

export function convertRows<R extends { weight: string }>(rows: R[], from: Unit, to: Unit): R[] {
  return from === to ? rows : rows.map((r) => ({ ...r, weight: convertWeightText(r.weight, from, to) }));
}

// ─── Plausibility ───────────────────────────────────────────────────────
/** Heaviest load a logged set may carry to count (≈500 kg, about the heaviest lift ever recorded). */
export const MAX_SET_LB = 1100;
/** Most reps a logged set may have to count. */
export const MAX_SET_REPS = 300;

/** Whether a logged set can count toward records: reps logged, numbers in range. */
export const countableSet = (weightLb: number, reps: number) =>
  Number.isFinite(weightLb) && Number.isFinite(reps) && reps > 0 && reps <= MAX_SET_REPS && weightLb >= 0 && weightLb <= MAX_SET_LB;

/** Body measurements accepted when typed in or read from a photo (stored units: lb, %, in). */
export const BODY_RANGES = {
  weightLb: [50, 700],
  bodyFatPct: [2, 70],
  muscleLb: [20, 300],
  waistIn: [15, 80],
  bmi: [10, 80],
  visceralFat: [1, 60],
  bmr: [500, 5000],
} as const satisfies Record<string, readonly [number, number]>;

export type BodyField = keyof typeof BODY_RANGES;
export const BODY_LABEL: Record<BodyField, string> = {
  weightLb: "Weight",
  bodyFatPct: "Body fat",
  muscleLb: "Muscle",
  waistIn: "Waist",
  bmi: "BMI",
  visceralFat: "Visceral fat",
  bmr: "BMR",
};

/** Fields outside their plausible range (undefined values are fine — nothing was entered). */
export function implausibleBody(values: Partial<Record<BodyField, number | undefined>>): BodyField[] {
  return (Object.keys(BODY_RANGES) as BodyField[]).filter((k) => {
    const v = values[k];
    if (v === undefined) return false;
    const [lo, hi] = BODY_RANGES[k];
    return !Number.isFinite(v) || v < lo || v > hi;
  });
}
