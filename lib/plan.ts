import {
  AESTHETIC_RANK,
  LEG_AESTHETIC,
  SESSIONS,
  type AestheticMap,
} from "@/lib/programs";
import { normalizeEquipment } from "@/lib/equipment";

export type SessionKey = keyof typeof SESSIONS;

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
  return typeof value === "string" && value in SESSIONS;
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
  const program = SESSIONS[session];
  const equipment = normalizeEquipment(rawEquipment);
  const have = new Set(equipment);
  const hasAll = (needed: string[]) => needed.every((e) => have.has(e));

  const exercises: PlannedExercise[] = [];
  const dropped: string[] = [];

  for (const original of program.exercises) {
    // Sets/reps/rest/cue always come from the programmed slot; the movement may be swapped.
    let pick: { name: string; aestheticKey: string; aestheticMap: AestheticMap; abs?: boolean } | null = null;
    let swappedFrom: string | undefined;

    if (hasAll(original.equipmentNeeded)) {
      pick = original;
    } else {
      const sub = original.substitutes?.find((s) => hasAll(s.equipmentNeeded));
      if (sub) {
        pick = sub;
        swappedFrom = original.name;
      }
    }

    // No match → the slot stays empty. Never invent or borrow from another muscle group.
    if (!pick) {
      dropped.push(original.name);
      continue;
    }

    const abs = pick.abs ?? original.abs;
    const { badge, reason } = resolveAesthetic(pick.aestheticKey, pick.aestheticMap, abs);

    exercises.push({
      name: pick.name,
      sets: original.sets,
      reps: original.reps,
      restSeconds: original.restSeconds,
      cue: original.cue,
      badge,
      reason,
      ...(swappedFrom ? { swappedFrom } : {}),
      ...(abs ? { abs: true } : {}),
    });
  }

  const absCount = exercises.filter((e) => e.abs).length;

  let missingNote: string | undefined;
  if (dropped.length > 0) {
    const parts = [
      `This gym is missing equipment for ${dropped.length} exercise(s); remaining slots are shown below.`,
      `Couldn't fill: ${dropped.join(", ")}.`,
    ];
    if (session === "legs" && dropped.includes("Hack Squat")) {
      parts.push("No hack squat, leg press or barbell squat setup found — the main quad slot is left empty.");
    }
    missingNote = parts.join(" ");
  }

  return {
    sessionLabel: program.label,
    note: program.note,
    equipment,
    exercises,
    counts: { leg: exercises.length - absCount, abs: absCount, total: exercises.length },
    ...(missingNote ? { missingNote } : {}),
  };
}
