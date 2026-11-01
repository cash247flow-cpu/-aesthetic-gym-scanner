// Every set of every completed workout, so achievements are computed from what was actually
// logged (the per-exercise set log only keeps the latest and previous session). Written at the
// existing finish / auto-save point; saving the same workout again replaces it, never doubles it.

export type SetRecord = { weightLb: number; reps: number };
/**
 * `unitUnknown`: the sets were typed before units were recorded and the user hasn't said which
 * unit they were. `raw` keeps them exactly as typed; `sets` is empty, so they never count toward
 * records, volume or awards.
 */
export type ExerciseSets = { name: string; sets: SetRecord[]; unitUnknown?: true; raw?: { weight: string; reps: number }[] };
export type WorkoutRecord = {
  id: string; // date|session|make-up date — stable for the same workout
  date: string;
  session: string;
  makeupFor?: string;
  exercises: ExerciseSets[];
  savedAt: number;
};

const KEY = "ags:workouts";
const MAX = 1000;

export const workoutId = (date: string, session: string, makeupFor?: string) => `${date}|${session}|${makeupFor ?? ""}`;

export function loadWorkouts(): WorkoutRecord[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]") as WorkoutRecord[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Insert or replace (by id) one workout's sets. A workout with no sets is removed. */
export function saveWorkoutRecord(record: WorkoutRecord) {
  const others = loadWorkouts().filter((w) => w.id !== record.id);
  const next = record.exercises.length ? [...others, record] : others; // exercises may hold raw-only (unit unknown) entries
  next.sort((a, b) => a.date.localeCompare(b.date) || a.savedAt - b.savedAt);
  try {
    localStorage.setItem(KEY, JSON.stringify(next.slice(-MAX)));
  } catch {
    /* ignore */
  }
}
