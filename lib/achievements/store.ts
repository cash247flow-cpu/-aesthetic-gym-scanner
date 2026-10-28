// Achievements on this device: recomputed from the recorded data each time (so they're always
// consistent with it), with each award's first-seen time and "seen" flag kept by its stable id.
// Everything stays in this browser — nothing is sent anywhere.

import { detectAll, lockedMilestones, type Achievement, type EngineInput, type Locked } from "@/lib/achievements/detect";
import { loadWorkouts } from "@/lib/achievements/workoutRecords";
import { HABITS, isDone, loadHabitLogs } from "@/lib/habits";
import { loadEntries, loadGoal } from "@/lib/bodyLog";
import { loadHistory } from "@/lib/wins";

export type StoredAchievement = Achievement & { userRef: string; createdAt: number; seen: boolean };
type Meta = Record<string, { createdAt: number; seen: boolean }>;

const META_KEY = "ags:achievements";
const PROFILE_KEY = "ags:profile:id";

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

/** A random id for this device's local profile (there are no accounts). */
export function localProfileRef(): string {
  let id = "";
  try {
    id = localStorage.getItem(PROFILE_KEY) ?? "";
  } catch {
    /* ignore */
  }
  if (!id) {
    id = `local-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    write(PROFILE_KEY, id);
  }
  return id;
}

export function engineInput(): EngineInput {
  const logs = loadHabitLogs();
  const perfectDays = Object.fromEntries(Object.entries(logs).map(([d, log]) => [d, HABITS.every((h) => isDone(log, h))]));
  return {
    workouts: loadWorkouts(),
    history: loadHistory(),
    perfectDays,
    body: loadEntries().map((e) => ({ id: e.id, date: e.date, weightLb: e.weightLb, bodyFatPct: e.bodyFatPct })),
    goal: loadGoal(),
  };
}

/**
 * Recompute from the recorded data and save. Returns every earned achievement and the ones
 * that are new since the last sync. Awards whose data was edited away are dropped.
 */
export function syncAchievements(now = Date.now()): { all: StoredAchievement[]; fresh: StoredAchievement[]; locked: Locked[] } {
  const input = engineInput();
  const detected = detectAll(input);
  const meta = read<Meta>(META_KEY, {});
  const userRef = localProfileRef();
  const nextMeta: Meta = {};
  const fresh: StoredAchievement[] = [];
  const all = detected.map((a) => {
    const m = meta[a.id] ?? { createdAt: now, seen: false };
    nextMeta[a.id] = m;
    const stored = { ...a, userRef, createdAt: m.createdAt, seen: m.seen };
    if (!meta[a.id]) fresh.push(stored);
    return stored;
  });
  write(META_KEY, nextMeta);
  return { all, fresh, locked: lockedMilestones(input, new Set(detected.map((a) => a.id))) };
}

export function markSeen(ids: string[]) {
  const meta = read<Meta>(META_KEY, {});
  for (const id of ids) if (meta[id]) meta[id] = { ...meta[id], seen: true };
  write(META_KEY, meta);
}
