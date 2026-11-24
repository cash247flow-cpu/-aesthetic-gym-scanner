// Every exercise in the program (main picks and their swaps), grouped by the muscles it works,
// for the "Exercises by muscle" screen. Built from lib/programs.ts and lib/muscles.ts only:
// nothing new is invented here.
import { getProgram, type SessionKey } from "@/lib/plan";
import { targetsOf, type Muscle } from "@/lib/muscles";

/** Display order: roughly top to bottom, front then back. */
export const MUSCLES: Muscle[] = [
  "shoulders", "chest", "biceps", "forearms", "abdominals", "quadriceps", "abductors", "adductors",
  "traps", "triceps", "lats", "middle back", "lower back", "glutes", "hamstrings", "calves",
];

const DAYS: [SessionKey, string][] = [
  ["push", "Push"], ["pull", "Pull"], ["legs", "Legs"], ["pump", "Pump"], ["abs", "Abs"], ["forearms", "Forearms"],
];

export type IndexEntry = {
  name: string;
  cue: string;
  /** Days it appears on, e.g. ["Pull", "Pump"]. */
  days: string[];
  /** Set when it is a swap option: the main exercise it can replace. */
  swapFor?: string;
  primary: string[];
  secondary: string[];
};

let cache: IndexEntry[] | null = null;

/** Main exercises first (in program order), then swap options. Each name appears once. */
export function exerciseIndex(): IndexEntry[] {
  if (cache) return cache;
  const byName = new Map<string, IndexEntry>();
  const add = (name: string, cue: string, day: string, swapFor?: string) => {
    const hit = byName.get(name);
    if (hit) {
      if (!hit.days.includes(day)) hit.days.push(day);
      return;
    }
    const t = targetsOf(name);
    byName.set(name, { name, cue, days: [day], swapFor, primary: t?.primaryMuscles ?? [], secondary: t?.secondaryMuscles ?? [] });
  };
  for (const [key, day] of DAYS) for (const ex of getProgram(key).exercises) add(ex.name, ex.cue, day);
  for (const [key, day] of DAYS)
    for (const ex of getProgram(key).exercises) for (const sub of ex.substitutes ?? []) add(sub.name, sub.cue ?? ex.cue, day, ex.name);
  cache = [...byName.values()];
  return cache;
}

/** Exercises that mainly train a muscle, and ones where it only helps. */
export function exercisesFor(muscle: string): { main: IndexEntry[]; helping: IndexEntry[] } {
  const all = exerciseIndex();
  return {
    main: all.filter((e) => e.primary.includes(muscle)),
    helping: all.filter((e) => !e.primary.includes(muscle) && e.secondary.includes(muscle)),
  };
}
