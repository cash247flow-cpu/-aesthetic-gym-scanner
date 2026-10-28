// The workout in progress: its plan (so it can be reopened without a new photo) and its timer.
// The timer is stored as timestamps, so it keeps counting while the phone is locked or the app
// is closed, and pausing freezes it. One workout is active at a time; it lasts until it's ended
// or the day is over.

import type { MakeupFor } from "@/lib/missed";
import type { PlanResult, SessionKey } from "@/lib/plan";
import { todayStr } from "@/lib/habits";

export type ActiveWorkout = {
  date: string;
  session: SessionKey;
  withAbs: boolean;
  standard: boolean;
  plan: PlanResult;
  makeup?: MakeupFor;
  elapsedMs: number; // time banked before the current running stretch
  runningSince: number | null; // set while the timer runs
  started: boolean;
};

const KEY = "ags:active-workout";

export function loadActive(): ActiveWorkout | null {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) ?? "null") as ActiveWorkout | null;
    // A workout left open from an earlier day is over; its logged sets were already saved.
    if (!a || a.date !== todayStr()) return null;
    return a;
  } catch {
    return null;
  }
}

export function saveActive(a: ActiveWorkout | null) {
  try {
    if (a) localStorage.setItem(KEY, JSON.stringify(a));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export const elapsedMs = (a: Pick<ActiveWorkout, "elapsedMs" | "runningSince">, now = Date.now()) =>
  a.elapsedMs + (a.runningSince ? now - a.runningSince : 0);

export const startTimer = (a: ActiveWorkout, now = Date.now()): ActiveWorkout =>
  a.runningSince ? a : { ...a, started: true, runningSince: now };

export const pauseTimer = (a: ActiveWorkout, now = Date.now()): ActiveWorkout =>
  a.runningSince ? { ...a, elapsedMs: elapsedMs(a, now), runningSince: null } : a;

/** 1:02:05 or 32:10 */
export function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Same workout = same day, session and make-up target. */
export const sameWorkout = (a: ActiveWorkout | null, session: SessionKey, withAbs: boolean, makeup?: MakeupFor | null) =>
  !!a && a.session === session && a.withAbs === withAbs && (a.makeup?.date ?? null) === (makeup?.date ?? null);
