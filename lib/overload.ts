// Progressive overload by double progression: once every working set reaches the top of the
// rep range, add weight and drop back to the bottom of the range; until then, keep the weight
// and add a rep per set. "Failure" sets just aim for one more rep. Targets only prefill the
// set boxes — every value stays editable.

import type { Row, Unit } from "@/components/SetLogger";

const KEY = "ags:overload";
// Weight jumps: big multi-joint lifts (and heavy shrugs/calves) take 5 lb; isolation work takes
// 2.5 lb, since +5 lb on a lateral raise or curl is a much bigger relative jump.
const STEP: Record<"compound" | "isolation", Record<Unit, number>> = {
  compound: { lb: 5, kg: 2.5 },
  isolation: { lb: 2.5, kg: 1.25 },
};
const COMPOUND = new Set([
  // presses
  "Incline Dumbbell Press", "Incline Smith Machine Press", "Flat Dumbbell Press", "Dumbbell Overhead Press", "Machine Chest Press", "Dips",
  // pulls
  "Wide-Grip Lat Pulldown", "Neutral-Grip Pulldown", "Half-Kneeling One-Arm Cable Pulldown", "Unilateral Pulldown", "Pull-Up",
  "Chest-Supported T-Bar Row", "Chest-Supported Dumbbell Row (Helms Row)", "Meadows Row", "Single-Arm Dumbbell Row",
  "Wide-Grip Cable Row", "Seated Cable Row",
  // legs
  "Hack Squat", "Leg Press", "Barbell Squat", "Goblet Squat", "Romanian Deadlift", "Dumbbell RDL", "Dumbbell Split Squat",
  // heavy single-joint lifts that load like compounds
  "Shrugs", "Barbell Shrugs", "Smith Machine Shrug", "Standing Calf Raise", "Standing Barbell Calf Raise", "Standing Dumbbell Calf Raise",
]);
export const stepFor = (exercise: string, unit: Unit) => STEP[COMPOUND.has(exercise) ? "compound" : "isolation"][unit];

export function loadOverload(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function saveOverload(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* ignore */
  }
}

export type Plan = { targets: { weight: string; reps: string }[]; note: string } | null;

const num = (s: string) => Number(s.replace(",", "."));
const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** "8–12" → [8, 12], "10" → [10, 10], "failure" → null */
function range(reps: string): [number, number] | null {
  const nums = reps.split(/[–-]/).map((n) => Number(n.trim())).filter((n) => Number.isFinite(n) && n > 0);
  return nums.length ? [nums[0], nums[nums.length - 1]] : null;
}

/** Targets for `count` sets from last session's sets, or null when there's nothing to go on. */
export function overloadPlan(prev: Row[], reps: string, unit: Unit, count: number, exercise = ""): Plan {
  const step = stepFor(exercise, unit);
  const last = prev.filter((r) => Number.isFinite(num(r.reps)) && num(r.reps) > 0);
  if (!last.length || count < 1) return null;
  const pick = (i: number) => last[Math.min(i, last.length - 1)];
  const r = range(reps);
  const hasWeight = last.some((s) => num(s.weight) > 0);

  if (!r) {
    return {
      targets: Array.from({ length: count }, (_, i) => ({ weight: pick(i).weight, reps: String(num(pick(i).reps) + 1) })),
      note: "Beat last time: one more rep on each set.",
    };
  }

  const [lo, hi] = r;
  if (hasWeight && last.every((s) => num(s.reps) >= hi)) {
    return {
      targets: Array.from({ length: count }, (_, i) => {
        const w = num(pick(i).weight);
        return { weight: w > 0 ? fmt(w + step) : pick(i).weight, reps: String(lo) };
      }),
      note: `Add weight: +${step} ${unit} — you hit ${hi} reps on every set last time. Start at ${lo} reps.`,
    };
  }

  if (!hasWeight && last.every((s) => num(s.reps) >= hi)) {
    return {
      targets: Array.from({ length: count }, (_, i) => ({ weight: "", reps: String(num(pick(i).reps) + 1) })),
      note: "Top of the range at bodyweight: go for +1 rep, or add weight (vest or dumbbell) and type it in.",
    };
  }

  return {
    targets: Array.from({ length: count }, (_, i) => ({
      weight: pick(i).weight,
      reps: String(Math.min(hi, num(pick(i).reps) + 1)),
    })),
    note: hasWeight
      ? `Same weight, +1 rep per set. Reach ${hi} reps on every set to earn a weight increase.`
      : "One more rep on each set than last time.",
  };
}
