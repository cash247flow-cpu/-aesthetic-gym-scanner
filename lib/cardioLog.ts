// Cardio logs, kept per workout so two sessions on the same machine and day never share one.
//
// Each workout (a lifting day with its cardio, or a cardio-only session, including make-ups)
// has an owner id — the same id the workout's history entry uses (`workoutId`). A finished
// cardio is stored under that owner, so:
//   - a second StairMaster session the same day starts fresh instead of showing "done";
//   - finishing it can't overwrite the first session's minutes;
//   - each workout's history entry counts only its own cardio minutes.
// The older single per-machine log (`ags:cardio:log:<machine>`) is still written; it only feeds
// "Last time" and the input placeholders.

export type CardioMachine = "treadmill" | "stairmaster";
export type CardioLog = { date: string; minutes: number; speed: string; incline: string; level: string };
type Store = Record<string, Partial<Record<CardioMachine, CardioLog>>>;

export const MACHINES: CardioMachine[] = ["treadmill", "stairmaster"];
const KEY = "ags:cardio:sessions";
const LEGACY = (m: CardioMachine) => `ags:cardio:log:${m}`;
const KEEP_DAYS = 60;

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
const loadStore = (): Store => {
  const s = read<Store>(KEY);
  return s && typeof s === "object" ? s : {};
};

/** The most recent log on this machine from any workout ("Last time"). */
export const loadLastLog = (machine: CardioMachine): CardioLog | null => read<CardioLog>(LEGACY(machine));

const anyOwnerOn = (store: Store, date: string) =>
  Object.values(store).some((logs) => MACHINES.some((m) => logs?.[m]?.date === date));

/**
 * This workout's cardio log on `machine` for `date`, or null. A log saved by an older version of
 * the app (before per-workout logs) still counts on that day, but only while no workout that day
 * has a log of its own — so it can't be claimed by a second session.
 */
export function loadOwnLog(owner: string, machine: CardioMachine, date: string): CardioLog | null {
  const store = loadStore();
  const own = store[owner]?.[machine];
  if (own) return own.date === date ? own : null;
  if (anyOwnerOn(store, date)) return null;
  const legacy = loadLastLog(machine);
  return legacy?.date === date ? legacy : null;
}

/** Save this workout's log (and the "Last time" log). Logs older than 60 days are dropped. */
export function saveOwnLog(owner: string, machine: CardioMachine, log: CardioLog) {
  const store = loadStore();
  store[owner] = { ...store[owner], [machine]: log };
  const cutoff = new Date(log.date + "T12:00");
  cutoff.setDate(cutoff.getDate() - KEEP_DAYS);
  const oldest = cutoff.toLocaleDateString("en-CA");
  for (const [o, logs] of Object.entries(store)) {
    if (!MACHINES.some((m) => (logs?.[m]?.date ?? "") >= oldest)) delete store[o];
  }
  write(KEY, store);
  write(LEGACY(machine), log);
}

/** Minutes of cardio this workout logged on `date`, across both machines. */
export const ownCardioMinutes = (owner: string, date: string) =>
  MACHINES.reduce((m, machine) => m + (loadOwnLog(owner, machine, date)?.minutes ?? 0), 0);
