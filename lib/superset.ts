// Supersets: an optional mode that pairs two exercises and alternates their sets (A1 set, A2 set,
// then rest). Two kinds:
//  - antagonist: opposing muscles (quads/hams, outer/inner hips, chest/rear delts, forearm
//    flexors/extensors); 75–120 s after the pair.
//  - non-competing: muscles that don't overlap much, as the Antagonist week's diagram pairs them
//    (chest with biceps, back with triceps); 60–90 s after the pair.
// Both: 15–30 s to move from the first exercise to the second. The heavy Hack Squat and Romanian
// Deadlift stay straight sets (the owner's choice). Pairs are matched by slot, so a swapped
// exercise keeps its pair. Progressive overload is unchanged: it works per exercise.
import type { PlannedExercise } from "@/lib/plan";

const KEY = "ags:superset";

export type PairKind = "antagonist" | "non-competing";
export type Pair = { first: string; second: string; kind: PairKind };

/** Rest after the first exercise of a pair (just the move across). */
export const TRANSITION_REST = "15–30";
/** Rest after the pair, by kind. */
export const PAIR_REST: Record<PairKind, string> = { antagonist: "75–120", "non-competing": "60–90" };

const p = (first: string, second: string, kind: PairKind): Pair => ({ first, second, kind });

/** Pairs of programmed slots (the plan's own exercise names), first one done first. */
export const SUPERSET_PAIRS: Pair[] = [
  // Legs
  p("Leg Extension", "Seated Leg Curls", "antagonist"),
  p("Hip Abduction", "Hip Adduction", "antagonist"),
  // Pump
  p("Machine Chest Press", "Reverse Pec Deck", "antagonist"),
  // Forearm finish (Pull, Back + Triceps, Forearms)
  p("Wrist Curl", "Reverse Curl", "antagonist"),
  // Chest + Biceps + Shoulders
  p("Incline Dumbbell Press", "Spider Curl", "non-competing"),
  p("Machine Chest Press", "Incline Dumbbell Curl", "non-competing"),
  p("High-to-Low Cable Fly", "Cable Hammer Curl", "non-competing"),
  // Back + Triceps
  p("Wide-Grip Lat Pulldown", "Cable Rope Pushdown", "non-competing"),
  p("Chest-Supported T-Bar Row", "EZ-Bar Skullcrusher", "non-competing"),
];

export function loadSuperset(): boolean {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

export function saveSuperset(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Storage unavailable: the switch lasts until the screen closes.
  }
}

const slotOf = (ex: PlannedExercise) => ex.swappedFrom ?? ex.name;

/**
 * Tags paired exercises (A, B…) and sets their rest: the first of a pair gets a short transition,
 * the second the rest after the pair for its kind. Both exercises must be on the list, next to each
 * other; anything else is left as a straight set. Swap options keep their slot's pairing.
 */
export function withSupersets(exercises: PlannedExercise[]): PlannedExercise[] {
  const out: PlannedExercise[] = exercises.map((e) => ({ ...e }));
  let group = 0;
  for (let i = 0; i < out.length - 1; i++) {
    const pair = SUPERSET_PAIRS.find((x) => slotOf(out[i]) === x.first && slotOf(out[i + 1]) === x.second);
    if (!pair) continue;
    const letter = String.fromCharCode(65 + group++);
    const [first, second] = [out[i], out[i + 1]];
    out[i] = { ...first, restSeconds: TRANSITION_REST, superset: { group: letter, order: 1, partner: second.name, kind: pair.kind } };
    out[i + 1] = { ...second, restSeconds: PAIR_REST[pair.kind], superset: { group: letter, order: 2, partner: first.name, kind: pair.kind } };
    i++;
  }
  return out;
}
