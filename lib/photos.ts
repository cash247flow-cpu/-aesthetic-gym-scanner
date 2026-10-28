// Visual Evolution: progress photos. The images live in this phone's IndexedDB (same private
// store as scale photos — never uploaded); only small descriptions are kept in localStorage.
// Photos are stored as taken (just downscaled), so body proportions are never altered.

import { deleteFile, newId, putFile, type BodyEntry } from "@/lib/bodyLog";
import { addDays } from "@/lib/habits";

export type PhotoView = "front" | "side" | "back" | "other";
export const VIEWS: { key: PhotoView; label: string }[] = [
  { key: "front", label: "Front" },
  { key: "side", label: "Side" },
  { key: "back", label: "Back" },
  { key: "other", label: "Other" },
];
export type PhotoMeta = {
  id: string;
  date: string; // capture date chosen by the user, YYYY-MM-DD
  view: PhotoView;
  fileId: string; // blob in IndexedDB
  w: number;
  h: number;
  note?: string; // private, never drawn on shared images
  addedAt: number;
};

const KEY = "ags:photos";

const byDate = (a: PhotoMeta, b: PhotoMeta) => a.date.localeCompare(b.date) || a.addedAt - b.addedAt;

export function loadPhotos(): PhotoMeta[] {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? "[]") as PhotoMeta[]).sort(byDate);
  } catch {
    return [];
  }
}

function savePhotos(list: PhotoMeta[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...list].sort(byDate)));
  } catch {
    /* ignore */
  }
}

/** Store an image (already downscaled) and its description. */
export async function addPhoto(blob: Blob, meta: { date: string; view: PhotoView; w: number; h: number; note?: string }): Promise<PhotoMeta> {
  const fileId = await putFile(blob);
  const photo: PhotoMeta = { id: newId(), fileId, addedAt: Date.now(), ...meta, note: meta.note?.trim() || undefined };
  savePhotos([...loadPhotos(), photo]);
  return photo;
}

export function updatePhoto(id: string, patch: Partial<Pick<PhotoMeta, "date" | "view" | "note">>) {
  savePhotos(loadPhotos().map((p) => (p.id === id ? { ...p, ...patch, note: (patch.note ?? p.note)?.trim() || undefined } : p)));
}

/** Swap the image but keep its date, view and note. */
export async function replacePhoto(id: string, blob: Blob, w: number, h: number) {
  const old = loadPhotos().find((p) => p.id === id);
  if (!old) return;
  const fileId = await putFile(blob);
  savePhotos(loadPhotos().map((p) => (p.id === id ? { ...p, fileId, w, h } : p)));
  await deleteFile(old.fileId);
}

export async function removePhoto(id: string) {
  const old = loadPhotos().find((p) => p.id === id);
  savePhotos(loadPhotos().filter((p) => p.id !== id));
  if (old) await deleteFile(old.fileId);
}

// ─── Pure helpers (tested) ──────────────────────────────────────────────

const days = (a: string, b: string) => Math.round((Date.parse(b + "T12:00") - Date.parse(a + "T12:00")) / 86_400_000);
export const daysBetween = days;

/** Photos grouped into dated sessions (same capture date), oldest first. */
export function sessions(photos: PhotoMeta[]): { date: string; photos: PhotoMeta[] }[] {
  const map = new Map<string, PhotoMeta[]>();
  for (const p of [...photos].sort(byDate)) map.set(p.date, [...(map.get(p.date) ?? []), p]);
  return [...map.entries()].map(([date, list]) => ({ date, photos: list }));
}

/** Week number of a date counted from the first photo (week 1 = first 7 days). */
export const weekNumber = (first: string, date: string) => Math.floor(days(first, date) / 7) + 1;

export type ComparePreset = "previous" | "w4" | "w8" | "w12";
export const PRESETS: { key: ComparePreset; label: string; week?: number }[] = [
  { key: "previous", label: "This week vs last" },
  { key: "w4", label: "Week 1 vs 4", week: 4 },
  { key: "w8", label: "Week 1 vs 8", week: 8 },
  { key: "w12", label: "Week 1 vs 12", week: 12 },
];

/**
 * Two photos of the same view to compare, oldest first, or null if there aren't two that fit.
 * "previous": the latest photo vs the latest one at least 5 days earlier.
 * Week N: the first photo vs the photo nearest the start of week N (within that week).
 */
export function pickComparison(photos: PhotoMeta[], view: PhotoView, preset: ComparePreset): [PhotoMeta, PhotoMeta] | null {
  const list = photos.filter((p) => p.view === view).sort(byDate);
  if (list.length < 2) return null;
  if (preset === "previous") {
    const after = list[list.length - 1];
    const before = [...list].reverse().find((p) => days(p.date, after.date) >= 5);
    return before ? [before, after] : null;
  }
  const week = PRESETS.find((p) => p.key === preset)!.week!;
  const first = list[0];
  const from = addDays(first.date, (week - 1) * 7);
  const to = addDays(from, 6);
  const inWeek = list.filter((p) => p.date >= from && p.date <= to);
  return inWeek.length ? [first, inWeek[0]] : null;
}

/**
 * The body entry recorded closest to a photo's date (within maxDays), so an overlay can say
 * which day the number is really from instead of implying it was measured with the photo.
 */
export function closestEntry(entries: BodyEntry[], date: string, has: (e: BodyEntry) => boolean, maxDays = 7) {
  let best: { entry: BodyEntry; offset: number } | null = null;
  for (const e of entries) {
    if (!has(e)) continue;
    const offset = days(date, e.date);
    if (Math.abs(offset) > maxDays) continue;
    if (!best || Math.abs(offset) < Math.abs(best.offset) || (Math.abs(offset) === Math.abs(best.offset) && offset < best.offset)) best = { entry: e, offset };
  }
  return best;
}

/** "same day", "2 days before the photo", "1 day after the photo". */
export function offsetLabel(offset: number) {
  if (offset === 0) return "same day";
  const n = Math.abs(offset);
  return `${n} day${n === 1 ? "" : "s"} ${offset < 0 ? "before" : "after"} the photo`;
}

export function durationLabel(a: string, b: string) {
  const d = Math.abs(days(a, b));
  if (d < 14) return `${d} day${d === 1 ? "" : "s"}`;
  const w = Math.round(d / 7);
  return `${w} weeks`;
}

export type Near = { value: number; date: string; offset: number };
export type NearMeasurements = { weightLb: Near | null; waistIn: Near | null; bodyFatPct: Near | null; muscleLb: Near | null };

/** Recorded measurements nearest a photo's date (within a week), each with the day it was taken. */
export function measurementsNear(entries: BodyEntry[], date: string): NearMeasurements {
  const pick = (get: (e: BodyEntry) => number | undefined): Near | null => {
    const c = closestEntry(entries, date, (e) => get(e) != null);
    return c ? { value: get(c.entry)!, date: c.entry.date, offset: c.offset } : null;
  };
  return { weightLb: pick((e) => e.weightLb), waistIn: pick((e) => e.waistIn), bodyFatPct: pick((e) => e.bodyFatPct), muscleLb: pick((e) => e.muscleLb) };
}
