// Accountability for consequential plan changes (PACSS "S" and recovery).
//
// Today the only plan values a person changes that drive coaching are the daily macro targets.
// Every change is recorded with what it was before, what it became, when, and what prompted it,
// so it can be explained and undone. Only numbers are kept — no notes, photos or food logs.
//
// Authority: changes are made by the user (typing and saving). The weekly coach may only SUGGEST
// reviewing targets; it never calls applyChange. Undo restores the previous values only if the
// targets are still what this change set them to — it never overwrites a later edit.

import type { MealPhase, Macros, Targets } from "@/lib/meals";

export type ChangeOrigin = "you" | "weekly-review";
export type PlanChange = {
  id: string;
  at: number; // ms epoch
  kind: "macro-targets";
  phase: MealPhase;
  before: Macros;
  after: Macros;
  origin: ChangeOrigin;
  undoneAt?: number;
};

const KEY = "ags:plan:changes";
const MAX = 50;

export const ORIGIN_LABEL: Record<ChangeOrigin, string> = {
  you: "changed by you",
  "weekly-review": "changed by you after a weekly-review suggestion",
};

const same = (a: Macros, b: Macros) => a.carbs === b.carbs && a.protein === b.protein && a.fat === b.fat;

export function loadChanges(): PlanChange[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]") as PlanChange[];
    return Array.isArray(v) ? v.filter((c) => c && c.kind === "macro-targets") : [];
  } catch {
    return [];
  }
}

function saveChanges(list: PlanChange[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    /* ignore */
  }
}

/** Pure: the targets after a change, plus the record of it (null when nothing actually changed). */
export function applyChange(
  targets: Targets,
  phase: MealPhase,
  after: Macros,
  origin: ChangeOrigin,
  now = Date.now(),
): { targets: Targets; change: PlanChange | null } {
  const before = targets[phase];
  if (same(before, after)) return { targets, change: null };
  const change: PlanChange = { id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`, at: now, kind: "macro-targets", phase, before, after, origin };
  return { targets: { ...targets, [phase]: after }, change };
}

/** Pure: undoing a change, refused when the targets have changed since (so a later edit is never lost). */
export function undoChange(targets: Targets, change: PlanChange): { ok: true; targets: Targets } | { ok: false; reason: string } {
  if (change.undoneAt) return { ok: false, reason: "That change was already undone." };
  if (!same(targets[change.phase], change.after)) return { ok: false, reason: "Your targets have changed since then, so this can't be undone automatically — edit them instead." };
  return { ok: true, targets: { ...targets, [change.phase]: change.before } };
}

export function recordChange(change: PlanChange) {
  saveChanges([...loadChanges(), change]);
}

export function markUndone(id: string, now = Date.now()) {
  saveChanges(loadChanges().map((c) => (c.id === id ? { ...c, undoneAt: now } : c)));
}

/** The newest change for a phase that hasn't been undone. */
export const lastChange = (list: PlanChange[], phase: MealPhase) => [...list].reverse().find((c) => c.phase === phase && !c.undoneAt) ?? null;
