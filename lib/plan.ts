import {
  AESTHETIC_RANK,
  LEG_AESTHETIC,
  SESSIONS,
  type AestheticMap,
  type Exercise,
} from "@/lib/programs";
import { normalizeEquipment } from "@/lib/equipment";

// Sessions assembled from existing program exercises — nothing new is invented.
const COMBOS = {
  pump: {
    label: "Chest + Rear Delts + Biceps",
    note: "Compare with last week's pump day.",
    picks: [
      ["push", "Incline Dumbbell Press"],
      ["push", "High-to-Low Cable Fly"],
      ["push", "Machine Chest Press"],
      ["pull", "Reverse Pec Deck"],
      ["pull", "Spider Curl"],
      ["pull", "Incline Dumbbell Curl"],
      ["pull", "Cable Hammer Curl"],
    ] as const,
  },
};

export type SessionKey = keyof typeof SESSIONS | keyof typeof COMBOS;

export function getProgram(key: SessionKey): { label: string; note: string; exercises: Exercise[] } {
  if (key in SESSIONS) return SESSIONS[key as keyof typeof SESSIONS];
  const combo = COMBOS[key as keyof typeof COMBOS];
  const exercises = combo.picks.map(([from, name]) => {
    const ex = SESSIONS[from].exercises.find((e) => e.name === name);
    if (!ex) throw new Error(`Combo ${key} references missing exercise ${from}/${name}`);
    return ex;
  });
  return { label: combo.label, note: combo.note, exercises };
}

export type PlannedExercise = {
  name: string;
  sets: string;
  reps: string;
  restSeconds: string;
  cue: string;
  badge: string;
  reason: string;
  swappedFrom?: string;
  abs?: boolean;
};

export type PlanResult = {
  sessionLabel: string;
  note: string;
  equipment: string[];
  exercises: PlannedExercise[];
  counts: { leg: number; abs: number; total: number };
  missingNote?: string;
};

export function isSessionKey(value: unknown): value is SessionKey {
  return typeof value === "string" && (value in SESSIONS || value in COMBOS);
}

function resolveAesthetic(
  aestheticKey: string,
  aestheticMap: AestheticMap,
  abs: boolean | undefined,
): { badge: string; reason: string } {
  if (aestheticMap === "upper") {
    const a = AESTHETIC_RANK[aestheticKey];
    if (a) return { badge: `#${a.rank} Aesthetic`, reason: a.reason };
  } else if (aestheticMap === "legs") {
    const a = LEG_AESTHETIC[aestheticKey];
    if (a) return { badge: abs ? a.label : `Legs · ${a.label}`, reason: a.reason };
  }
  console.warn(`[plan] Missing aesthetic lookup for "${aestheticKey}" (${aestheticMap})`);
  return { badge: "—", reason: "" };
}

export function buildPlan(session: SessionKey, rawEquipment: unknown): PlanResult {
  const program = getProgram(session);
  const equipment = normalizeEquipment(rawEquipment);
  const have = new Set(equipment);
  const hasAll = (needed: string[]) => needed.every((e) => have.has(e));

  const exercises: PlannedExercise[] = [];
  const dropped: string[] = [];
  const duplicates: string[] = [];
  // Never repeat a movement: a substitute already used by an earlier slot is skipped.
  const used = new Set<string>();
  const usable = (c: { name: string; equipmentNeeded: string[] }) => hasAll(c.equipmentNeeded) && !used.has(c.name);

  for (const original of program.exercises) {
    // Sets/reps/rest come from the programmed slot; a swap brings its own cue when it has one.
    let pick: { name: string; cue?: string; aestheticKey: string; aestheticMap: AestheticMap; abs?: boolean } | null = null;
    let swappedFrom: string | undefined;

    if (usable(original)) {
      pick = original;
    } else {
      const sub = original.substitutes?.find(usable);
      if (sub) {
        pick = sub;
        swappedFrom = original.name;
      }
    }

    // No match → the slot stays empty. Never invent or borrow from another muscle group.
    if (!pick) {
      const candidates = [original, ...(original.substitutes ?? [])];
      if (candidates.some((c) => hasAll(c.equipmentNeeded))) duplicates.push(original.name);
      else dropped.push(original.name);
      continue;
    }
    used.add(pick.name);

    const abs = pick.abs ?? original.abs;
    const { badge, reason } = resolveAesthetic(pick.aestheticKey, pick.aestheticMap, abs);

    exercises.push({
      name: pick.name,
      sets: original.sets,
      reps: original.reps,
      restSeconds: original.restSeconds,
      cue: pick.cue ?? original.cue,
      badge,
      reason,
      ...(swappedFrom ? { swappedFrom } : {}),
      ...(abs ? { abs: true } : {}),
    });
  }

  const absCount = exercises.filter((e) => e.abs).length;

  let missingNote: string | undefined;
  const parts: string[] = [];
  if (dropped.length > 0) {
    parts.push(
      `This gym is missing equipment for ${dropped.length} exercise(s); remaining slots are shown below.`,
      `Couldn't fill: ${dropped.join(", ")}.`,
    );
    if (session === "legs" && dropped.includes("Hack Squat")) {
      parts.push("No hack squat, leg press or barbell squat setup found — the main quad slot is left empty.");
    }
  }
  if (duplicates.length > 0) {
    parts.push(`Skipped ${duplicates.join(", ")}: the only swap available is already in this session.`);
  }
  if (parts.length > 0) missingNote = parts.join(" ");

  return {
    sessionLabel: program.label,
    note: program.note,
    equipment,
    exercises,
    counts: { leg: exercises.length - absCount, abs: absCount, total: exercises.length },
    ...(missingNote ? { missingNote } : {}),
  };
}
