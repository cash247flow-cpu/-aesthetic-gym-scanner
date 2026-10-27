// Swap choices remembered between workouts: programmed exercise (the slot in lib/programs.ts) →
// the listed alternative picked with the Swap button. Applied only when that gym has the equipment.

const KEY = "ags:swaps";

export type SavedSwaps = Record<string, string>;

export function loadSwaps(): SavedSwaps {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as SavedSwaps) : {};
  } catch {
    return {};
  }
}

export function saveSwaps(swaps: SavedSwaps) {
  try {
    localStorage.setItem(KEY, JSON.stringify(swaps));
  } catch {
    /* ignore */
  }
}
