// Missed workouts and make-ups. Each week (Sunday–Saturday) stands on its own: a training day
// that passed with nothing logged is "missed", and can be made up any later day of the same week.
// Past days are judged by the schedule they had at the time (snapshotted the first time the app
// sees them), so editing the week later doesn't rewrite history. Counting starts the day this
// feature was installed.

import { loadCardioPlan, MACHINE_LABEL } from "@/components/CardioCard";
import { addDays, todayStr } from "@/lib/habits";
import type { SessionKey } from "@/lib/plan";
import { SESSIONS } from "@/lib/programs";
import { loadWeek, type DayPlan } from "@/lib/schedule";
import { loadHistory, type HistoryEntry } from "@/lib/wins";

export type ItemKind = "lift" | "abs" | "forearms" | "cardio";
export type ItemStatus = "done" | "madeUp" | "missed" | "skipped" | "upcoming";
export type DayItem = { key: string; date: string; kind: ItemKind; label: string; session?: SessionKey; status: ItemStatus };
export type MakeupFor = { date: string; label: string }; // label like "Mon · Chest"
export type DayStatus = { date: string; items: DayItem[]; trained: boolean };
type Snapshot = DayPlan & { cardio: string | null }; // cardio label, null when the cardio plan was off

const SNAP_KEY = "ags:schedule:days";
const SINCE_KEY = "ags:missed:since";
const SKIP_KEY = "ags:missed:skipped";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const weekStart = (date: string) => addDays(date, -new Date(date + "T12:00").getDay());
const dayOfWeek = (date: string) => new Date(date + "T12:00").getDay();
export const dayName = (date: string) => new Date(date + "T12:00").toLocaleDateString(undefined, { weekday: "short" });

const AB_NAMES = new Set(
  SESSIONS.legs.exercises.filter((e) => e.abs).flatMap((e) => [e.name, ...(e.substitutes ?? []).map((s) => s.name)]),
);
const hasAbs = (h: HistoryEntry) => (h.exercises ?? []).some((n) => AB_NAMES.has(n));

/** Freeze each past day's plan the first time it's seen; today always follows the current week. */
function snapshots(today: string, since: string): Record<string, Snapshot> {
  const snaps = read<Record<string, Snapshot>>(SNAP_KEY, {});
  const week = loadWeek();
  const cardio = loadCardioPlan();
  const cardioLabel = cardio ? `${MACHINE_LABEL[cardio.machine]} ${cardio.minutes} min` : null;
  let changed = false;
  for (let d = weekStart(today) < since ? since : weekStart(today); d <= today; d = addDays(d, 1)) {
    if (snaps[d] && d !== today) continue;
    const plan = week[dayOfWeek(d)];
    snaps[d] = { ...plan, cardio: plan.choice === "rest" ? "Cardio Day" : cardioLabel };
    changed = true;
  }
  if (changed) write(SNAP_KEY, snaps);
  return snaps;
}

function itemsFor(date: string, snap: Snapshot): Omit<DayItem, "status">[] {
  const items: Omit<DayItem, "status">[] = [];
  if (snap.choice !== "rest") items.push({ key: `${date}:lift`, date, kind: "lift", label: snap.name, session: snap.choice });
  if (snap.abs && snap.choice !== "legs") items.push({ key: `${date}:abs`, date, kind: "abs", label: "Abs", session: "abs" });
  if (snap.forearms && snap.choice === "rest")
    items.push({ key: `${date}:forearms`, date, kind: "forearms", label: "Forearms", session: "forearms" });
  if (snap.cardio) items.push({ key: `${date}:cardio`, date, kind: "cardio", label: snap.cardio });
  return items;
}

const absOnly = (h: HistoryEntry) => !!h.exercises?.length && h.exercises.every((n) => AB_NAMES.has(n));
const FOREARM_NAMES = new Set(
  SESSIONS.pull.exercises
    .filter((e) => e.aestheticKey === "Forearms")
    .flatMap((e) => [e.name, ...(e.substitutes ?? []).map((x) => x.name)]),
);
const hasForearms = (h: HistoryEntry) => (h.exercises ?? []).some((n) => FOREARM_NAMES.has(n));
const counts = (kind: ItemKind, h: HistoryEntry) =>
  kind === "lift" ? h.sets > 0 && !absOnly(h) : kind === "abs" ? hasAbs(h) : kind === "forearms" ? hasForearms(h) : h.cardioMin > 0;

/** This week, Sunday–Saturday, with each day's planned items and how they went. */
export function weekStatus(today = todayStr()): DayStatus[] {
  return rangeStatus(weekStart(today), 7, today);
}

/**
 * Any run of days (e.g. a weekly review period) with each day's planned items and how they went.
 * Days before tracking started, or never seen by the app, have no planned items (unknown).
 */
export function rangeStatus(start: string, days: number, today = todayStr()): DayStatus[] {
  let since = read<string | null>(SINCE_KEY, null);
  if (!since) {
    since = today;
    write(SINCE_KEY, JSON.stringify(today));
  }
  const snaps = snapshots(today, since);
  const history = loadHistory();
  const skipped = new Set(read<string[]>(SKIP_KEY, []));

  return Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i);
    const own = history.filter((h) => h.date === date && !h.makeupFor);
    const makeups = history.filter((h) => h.makeupFor === date);
    const trained = history.some((h) => h.date === date && (h.sets > 0 || h.cardioMin > 0));
    const snap = snaps[date];
    const items: DayItem[] =
      !snap || date < since
        ? []
        : itemsFor(date, snap).map((it) => {
            const status: ItemStatus = own.some((h) => counts(it.kind, h))
              ? "done"
              : makeups.some((h) => counts(it.kind, h))
                ? "madeUp"
                : date >= today
                  ? "upcoming"
                  : skipped.has(it.key)
                    ? "skipped"
                    : "missed";
            return { ...it, status };
          });
    return { date, items, trained };
  });
}

/** Missed items this week that can still be made up (skipped ones are left off). */
export const missedThisWeek = (days: DayStatus[]) => days.flatMap((d) => d.items.filter((i) => i.status === "missed"));

export function skipMissed(key: string) {
  const skipped = new Set(read<string[]>(SKIP_KEY, []));
  skipped.add(key);
  write(SKIP_KEY, [...skipped]);
}

export function weekCounts(days: DayStatus[]) {
  const all = days.flatMap((d) => d.items);
  const n = (s: ItemStatus) => all.filter((i) => i.status === s).length;
  return { done: n("done"), madeUp: n("madeUp"), missed: n("missed") + n("skipped") };
}
