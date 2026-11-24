// Antagonist supersets: an optional mode that pairs exercises for opposing muscles and alternates
// their sets (A1 set, A2 set, then rest). Only where the plan already has both muscles on the same
// day: Legs (quads/hams isolation, outer/inner hips) and Pump (chest/rear delts). The heavy Hack
// Squat and Romanian Deadlift stay straight sets (the owner's choice). Pairs are matched by slot,
// so a swapped exercise keeps its pair. Progressive overload is unchanged: it works per exercise.
import type { PlannedExercise } from "@/lib/plan";

const KEY = "ags:superset";

/** Pairs of programmed slots (the plan's own exercise names), first one done first. */
export const ANTAGONIST_PAIRS: [string, string][] = [
  ["Leg Extension", "Seated Leg Curls"],
  ["Hip Abduction", "Hip Adduction"],
  ["Machine Chest Press", "Reverse Pec Deck"],
];

/** Rest after the first exercise of a pair (just the move across) and after the pair. */
export const TRANSITION_REST = "15–30";
export const PAIR_REST = "75–120";

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
 * the second the rest after the pair. Both exercises must be on the list, next to each other;
 * anything else is left as a straight set. Swap options keep their slot's pairing.
 */
export function withSupersets(exercises: PlannedExercise[]): PlannedExercise[] {
  const out: PlannedExercise[] = exercises.map((e) => ({ ...e }));
  let group = 0;
  for (let i = 0; i < out.length - 1; i++) {
    const pair = ANTAGONIST_PAIRS.find(([a, b]) => slotOf(out[i]) === a && slotOf(out[i + 1]) === b);
    if (!pair) continue;
    const letter = String.fromCharCode(65 + group++);
    const [first, second] = [out[i], out[i + 1]];
    out[i] = { ...first, restSeconds: TRANSITION_REST, superset: { group: letter, order: 1, partner: second.name } };
    out[i + 1] = { ...second, restSeconds: PAIR_REST, superset: { group: letter, order: 2, partner: first.name } };
    i++;
  }
  return out;
}
