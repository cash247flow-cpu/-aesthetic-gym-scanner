import { loadRecord, type Row, type Unit } from "@/components/SetLogger";
import { loadLog as loadCardioLog } from "@/components/CardioCard";
import { bestPerfectStreak, loadHabitLogs } from "@/lib/habits";

// Weights are typed in whatever unit the toggle shows; everything stored here is in lb.
const LB_PER_KG = 2.20462;
const HISTORY_KEY = "ags:history";
const prKey = (exercise: string) => `ags:pr:${exercise}`;
const today = () => new Date().toLocaleDateString("en-CA");

export type Best = { weight: number; setVolume: number; reps: number };
export type PRKind = keyof Best;
// best = all-time best including `date`; before = best as it stood before `date`.
// Keeping both makes finishing the same workout twice on one day idempotent.
type PrRecord = { date: string; before: Best | null; best: Best; bestDate: Partial<Record<PRKind, string>> };

export type PR = { exercise: string; kind: PRKind; value: number; previous: number };
export type HistoryEntry = {
  date: string;
  session: string;
  label: string;
  volumeLb: number;
  sets: number;
  prs: number;
  cardioMin: number;
  exercises?: string[]; // ones with logged sets (for the weekly muscle map); older entries lack it
  makeupFor?: string; // date of the missed day this workout made up
  durationMin?: number; // workout timer total (pauses excluded)
};
export type Totals = { volumeLb: number; workouts: number; prs: number; cardioMin: number };
export type BadgeGroup = "lift" | "workouts" | "prs" | "cardio" | "habits";
export type Badge = { id: string; group: BadgeGroup; label: string; sub: string; earned: boolean };
export type Summary = {
  date: string;
  label: string;
  volumeLb: number;
  sets: number;
  exercises: number;
  cardioMin: number;
  prs: PR[];
  prevVolumeLb: number | null;
  newBadges: Badge[];
  totals: Totals;
  empty: boolean;
  durationMin?: number;
};

export const PR_LABEL: Record<PRKind, string> = {
  weight: "Heaviest weight",
  setVolume: "Best set (weight × reps)",
  reps: "Most reps",
};

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

const num = (s: string) => {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Best weight / single-set volume / reps (reps only counted for unweighted sets). */
function bestOf(rows: Row[], unit: Unit): Best | null {
  const sets = rows.filter((r) => r.reps.trim() !== "" || r.weight.trim() !== "");
  if (!sets.length) return null;
  const toLb = unit === "kg" ? LB_PER_KG : 1;
  const best: Best = { weight: 0, setVolume: 0, reps: 0 };
  for (const r of sets) {
    const w = num(r.weight) * toLb;
    const reps = num(r.reps);
    best.weight = Math.max(best.weight, w);
    best.setVolume = Math.max(best.setVolume, w * reps);
    if (w === 0) best.reps = Math.max(best.reps, reps);
  }
  return best;
}

const maxBest = (a: Best | null, b: Best): Best =>
  a ? { weight: Math.max(a.weight, b.weight), setVolume: Math.max(a.setVolume, b.setVolume), reps: Math.max(a.reps, b.reps) } : b;

export function loadHistory(): HistoryEntry[] {
  return read<HistoryEntry[]>(HISTORY_KEY) ?? [];
}

function totalsOf(history: HistoryEntry[]): Totals {
  return history.reduce<Totals>(
    (t, h) => ({
      volumeLb: t.volumeLb + h.volumeLb,
      workouts: t.workouts + 1,
      prs: t.prs + h.prs,
      cardioMin: t.cardioMin + h.cardioMin,
    }),
    { volumeLb: 0, workouts: 0, prs: 0, cardioMin: 0 },
  );
}

/** Show weights in the toggle's unit. */
export function fromLb(lb: number, unit: Unit) {
  return unit === "kg" ? lb / LB_PER_KG : lb;
}

export function formatWeight(lb: number, unit: Unit) {
  return `${Math.round(fromLb(lb, unit)).toLocaleString()} ${unit}`;
}

const compact = (n: number) =>
  n >= 1_000_000 ? `${n / 1_000_000}M` : n >= 1000 ? `${n / 1000}K` : String(n);

const BADGE_TIERS: Record<BadgeGroup, number[]> = {
  lift: [1_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000],
  workouts: [1, 5, 10, 25, 50, 100],
  prs: [1, 5, 10, 25, 50, 100],
  cardio: [30, 60, 300, 600, 1500, 3000],
  habits: [3, 7, 14, 30, 60, 100],
};

/** `habitBest` is the longest run of perfect habit days (all five done). */
export function badgesFor(totals: Totals, unit: Unit, habitBest = bestPerfectStreak(loadHabitLogs())): Badge[] {
  const value: Record<BadgeGroup, number> = {
    lift: fromLb(totals.volumeLb, unit),
    workouts: totals.workouts,
    prs: totals.prs,
    cardio: totals.cardioMin,
    habits: habitBest,
  };
  const sub: Record<BadgeGroup, (n: number) => string> = {
    lift: () => `${unit} lifted`,
    workouts: (n) => (n === 1 ? "Workout" : "Workouts"),
    prs: (n) => (n === 1 ? "First PR" : "PRs"),
    cardio: (n) => (n < 60 ? "Cardio min" : n === 60 ? "Cardio hr" : "Cardio hrs"),
    habits: () => "Day streak",
  };
  // Cardio tiers past an hour read better in hours ("25 hrs", not "1.5K min").
  const label = (group: BadgeGroup, n: number) => (group === "cardio" && n >= 60 ? String(n / 60) : compact(n));
  return (Object.keys(BADGE_TIERS) as BadgeGroup[]).flatMap((group) =>
    BADGE_TIERS[group].map((n) => ({
      id: `${group}-${n}`,
      group,
      label: label(group, n),
      sub: sub[group](n),
      earned: value[group] >= n,
    })),
  );
}

/**
 * Record today's workout: tallies the ticked sets of `exercises`, updates personal
 * records, and writes one history entry per date + session (re-finishing replaces it).
 */
export function finishWorkout(opts: {
  session: string;
  label: string;
  exercises: string[];
  unit: Unit;
  includeCardio: boolean;
  makeupFor?: string;
  durationMin?: number;
}): Summary {
  const { session, label, exercises, unit, includeCardio, makeupFor, durationMin } = opts;
  const t = today();
  const toLb = unit === "kg" ? LB_PER_KG : 1;

  let volumeLb = 0;
  let sets = 0;
  let exercisesDone = 0;
  const doneNames: string[] = [];
  const prs: PR[] = [];
  const prUpdates: [string, PrRecord][] = [];

  for (const exercise of exercises) {
    const rec = loadRecord(exercise);
    if (rec?.date !== t) continue;
    const done = rec.sets.filter((r) => r.done && (r.weight.trim() !== "" || r.reps.trim() !== ""));
    if (!done.length) continue;
    exercisesDone++;
    doneNames.push(exercise);
    sets += done.length;
    volumeLb += done.reduce((v, r) => v + num(r.weight) * toLb * num(r.reps), 0);

    const todayBest = bestOf(done, unit);
    if (!todayBest) continue;
    const stored = read<PrRecord>(prKey(exercise));
    // Before PR tracking existed, the set log's previous session is the best baseline we have.
    const before = stored ? (stored.date === t ? stored.before : stored.best) : bestOf(rec.prevSets, unit);
    const bestDate = { ...(stored?.bestDate ?? {}) };
    if (before) {
      for (const kind of Object.keys(PR_LABEL) as PRKind[]) {
        if (todayBest[kind] > 0 && todayBest[kind] > before[kind]) {
          prs.push({ exercise, kind, value: todayBest[kind], previous: before[kind] });
          bestDate[kind] = t;
        }
      }
    }
    prUpdates.push([exercise, { date: t, before, best: maxBest(before, todayBest), bestDate }]);
  }

  const cardioMin = (includeCardio ? (["treadmill", "stairmaster"] as const) : []).reduce((m, machine) => {
    const log = loadCardioLog(machine);
    return log?.date === t ? m + log.minutes : m;
  }, 0);

  const history = loadHistory();
  const others = history.filter((h) => !(h.date === t && h.session === session && h.makeupFor === makeupFor));
  const empty = sets === 0 && cardioMin === 0;
  const prev = [...others].reverse().find((h) => h.session === session && h.date < t && h.volumeLb > 0);
  const badgesBefore = badgesFor(totalsOf(others), unit);
  const entry: HistoryEntry = {
    date: t,
    session,
    label,
    volumeLb,
    sets,
    prs: prs.length,
    cardioMin,
    exercises: doneNames,
    ...(makeupFor ? { makeupFor } : {}),
    ...(durationMin ? { durationMin } : {}),
  };
  const nextHistory = empty ? history : [...others, entry].slice(-500);
  const totals = totalsOf(nextHistory);

  if (!empty) {
    write(HISTORY_KEY, nextHistory);
    for (const [exercise, record] of prUpdates) write(prKey(exercise), record);
  }

  const newBadges = badgesFor(totals, unit).filter((b, i) => b.earned && !badgesBefore[i].earned);

  return {
    date: t,
    label,
    volumeLb,
    sets,
    exercises: exercisesDone,
    cardioMin,
    prs,
    prevVolumeLb: prev?.volumeLb ?? null,
    newBadges,
    totals,
    empty,
    ...(durationMin ? { durationMin } : {}),
  };
}

export type ExerciseRecord = { exercise: string; best: Best; bestDate: Partial<Record<PRKind, string>> };

/** Everything the "Your wins" page shows. */
export function loadWins(unit: Unit) {
  const history = loadHistory();
  const totals = totalsOf(history);
  const records: ExerciseRecord[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("ags:pr:")) continue;
      const rec = read<PrRecord>(key);
      if (rec) records.push({ exercise: key.slice("ags:pr:".length), best: rec.best, bestDate: rec.bestDate ?? {} });
    }
  } catch {
    /* ignore */
  }
  records.sort((a, b) => b.best.setVolume - a.best.setVolume || a.exercise.localeCompare(b.exercise));
  return { totals, badges: badgesFor(totals, unit), history: [...history].reverse(), records };
}
