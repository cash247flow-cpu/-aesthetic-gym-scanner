// Which muscles a workout hits, for the muscle map. Muscle names follow free-exercise-db
// (lib/exercise-guide.json); exercises without a guide entry are listed here by hand.
import guideData from "@/lib/exercise-guide.json";

export type Muscle =
  | "abdominals" | "abductors" | "adductors" | "biceps" | "calves" | "chest" | "forearms" | "glutes"
  | "hamstrings" | "lats" | "lower back" | "middle back" | "quadriceps" | "shoulders" | "traps" | "triceps";

type Targets = { primaryMuscles: string[]; secondaryMuscles: string[] };
const GUIDE = guideData as Record<string, Targets>;

const BY_HAND: Record<string, Targets> = {
  "Chest-Supported Lateral Raise": { primaryMuscles: ["shoulders"], secondaryMuscles: [] },
  "Machine Lateral Raise": { primaryMuscles: ["shoulders"], secondaryMuscles: [] },
  "Cable Lateral Raise": { primaryMuscles: ["shoulders"], secondaryMuscles: [] },
  "Smith Machine Shrug": { primaryMuscles: ["traps"], secondaryMuscles: [] },
  "Cable Hip Abduction": { primaryMuscles: ["abductors"], secondaryMuscles: ["glutes"] },
  "Side-Lying Hip Abduction": { primaryMuscles: ["abductors"], secondaryMuscles: ["glutes"] },
  "Assisted Lat Pulldown Crunch": { primaryMuscles: ["abdominals"], secondaryMuscles: [] },
  "Lat Pulldown Cable Crunch (Face-Away)": { primaryMuscles: ["abdominals"], secondaryMuscles: [] },
  "Standing Cable Crunch (Facing Away)": { primaryMuscles: ["abdominals"], secondaryMuscles: [] },
  "Kneeling Cable Crunch (Facing Away)": { primaryMuscles: ["abdominals"], secondaryMuscles: [] },
  "Garhammer Raise": { primaryMuscles: ["abdominals"], secondaryMuscles: [] },
};

export function targetsOf(exercise: string): Targets | undefined {
  return BY_HAND[exercise] ?? GUIDE[exercise];
}

/** Primary muscles of any exercise win over secondary ones. */
export function musclesFor(exercises: string[]): { primary: Set<string>; secondary: Set<string> } {
  const primary = new Set<string>();
  const secondary = new Set<string>();
  for (const name of exercises) {
    const t = targetsOf(name);
    t?.primaryMuscles.forEach((m) => primary.add(m));
    t?.secondaryMuscles.forEach((m) => secondary.add(m));
  }
  primary.forEach((m) => secondary.delete(m));
  return { primary, secondary };
}
