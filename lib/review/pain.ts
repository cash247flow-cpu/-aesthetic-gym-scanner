// Safety signal shared outside the weekly review screen: did the user's latest weekly check-in
// report pain or a possible injury? While it does (for at most PAIN_HOLD_DAYS after it was
// reported), progressive-overload targets stop increasing load. The tick is stored the moment
// it changes, even before the review is saved. A cautious default, not a medical rule: the user
// can still type any numbers.

import { addDays, todayStr } from "@/lib/habits";

export const PAIN_HOLD_DAYS = 14;
const KEY = "ags:safety:pain";
type Stored = Record<string, { start: string; end: string; checkIn?: { pain?: boolean } }>;
type Flag = { on: string; pain: boolean };

function read<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
}

/** Called when the user ticks or unticks "Pain or a possible injury". */
export function setPainReport(pain: boolean, today = todayStr()) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ on: today, pain } satisfies Flag));
  } catch {
    /* ignore */
  }
}

export function recentPainReport(reviews: Stored | null = read<Stored>("ags:reviews"), flag: Flag | null = read<Flag>(KEY), today = todayStr()): boolean {
  // Latest signal wins: the live tick (dated when it changed) or the newest saved check-in.
  const saved = Object.values(reviews ?? {})
    .filter((r) => r && typeof r.end === "string" && r.checkIn)
    .sort((a, b) => b.end.localeCompare(a.end))[0];
  const candidates: Flag[] = [];
  if (saved) candidates.push({ on: saved.end, pain: !!saved.checkIn?.pain });
  if (flag && typeof flag.on === "string") candidates.push({ on: flag.on, pain: !!flag.pain });
  const latest = candidates.sort((a, b) => b.on.localeCompare(a.on))[0];
  return !!latest?.pain && addDays(latest.on, PAIN_HOLD_DAYS) >= today;
}
