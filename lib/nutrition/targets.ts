// The coach only works from targets the user has confirmed. The plan ships default macros per
// phase; those count as confirmed once the user either edits their targets in the Meal plan
// (the existing setup) or explicitly confirms the shown numbers here. Nothing is computed from
// a body-fat goal — that's context, not a prescription.

import { kcalOf, type Macros, type MealPhase, type Targets } from "@/lib/meals";
import { KEYS, readJson, writeJson, type KV } from "./store";

const CUSTOM_TARGETS_KEY = "ags:meals:targets"; // written by the Meal plan's "Edit my targets"

export type Confirmed = Partial<Record<MealPhase, number>>; // phase → confirmedAt

const parseOk = (raw: unknown): Confirmed => {
  if (!raw || typeof raw !== "object") return {};
  const out: Confirmed = {};
  for (const p of ["current", "phase2"] as MealPhase[]) {
    const v = (raw as Record<string, unknown>)[p];
    if (typeof v === "number" && v > 0) out[p] = v;
  }
  return out;
};

export const loadConfirmed = (kv?: KV | null) => readJson(KEYS.targetsOk, parseOk, kv);

export function confirmTargets(phase: MealPhase, now = Date.now(), kv?: KV | null) {
  const next = { ...loadConfirmed(kv), [phase]: now };
  writeJson(KEYS.targetsOk, next, kv);
  return next;
}

/** True if the user set their own targets in the Meal plan (any phase) — that is a confirmation. */
export function hasCustomTargets(kv?: KV | null): boolean {
  try {
    const store = kv === undefined ? (typeof localStorage === "undefined" ? null : localStorage) : kv;
    return !!store?.getItem(CUSTOM_TARGETS_KEY);
  } catch {
    return false;
  }
}

export type DayTarget = Macros & { kcal: number };

/** The confirmed targets for a phase, or null when the user still needs to confirm them. */
export function confirmedTarget(phase: MealPhase, targets: Targets, confirmed: Confirmed, custom: boolean): DayTarget | null {
  if (!confirmed[phase] && !custom) return null;
  const m = targets[phase];
  return { ...m, kcal: kcalOf(m) };
}
