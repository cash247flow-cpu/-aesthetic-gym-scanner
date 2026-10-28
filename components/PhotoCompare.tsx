"use client";

import { useEffect, useState } from "react";
import { getFile, type BodyEntry } from "@/lib/bodyLog";
import { durationLabel, measurementsNear, offsetLabel, type Near, type PhotoMeta } from "@/lib/photos";
import { fmtDate, fmtWeight, type Unit } from "@/lib/achievements/format";

/** Object URL for a stored photo, revoked when the component goes away. */
export function usePhotoUrl(fileId: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!fileId) return;
    let current: string | null = null;
    let cancelled = false;
    getFile(fileId).then((blob) => {
      if (cancelled || !blob) return;
      current = URL.createObjectURL(blob);
      setUrl(current);
    });
    return () => {
      cancelled = true;
      if (current) URL.revokeObjectURL(current);
      setUrl(null);
    };
  }, [fileId]);
  return url;
}

export function PhotoImg({ photo, className, alt }: { photo: PhotoMeta; className?: string; alt?: string }) {
  const url = usePhotoUrl(photo.fileId);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt ?? `${photo.view} photo, ${photo.date}`} className={className} draggable={false} />
  ) : (
    <div className={`${className ?? ""} bg-zinc-900`} aria-hidden />
  );
}

export const fmtWaist = (inches: number, unit: Unit) => (unit === "kg" ? `${Math.round(inches * 2.54 * 10) / 10} cm` : `${Math.round(inches * 10) / 10} in`);

export type Overlay = { date: boolean; weight: boolean; waist: boolean; bodyFat: boolean; muscle: boolean };
export const NO_MEASUREMENTS: Overlay = { date: true, weight: false, waist: false, bodyFat: false, muscle: false };

/** Lines to show under a photo — each recorded value says which day it's from. */
export function overlayLines(entries: BodyEntry[], photo: PhotoMeta, o: Overlay, unit: Unit): string[] {
  const near = measurementsNear(entries, photo.date);
  const when = (n: Near) => (n.offset === 0 ? "" : ` (measured ${fmtDate(n.date)}, ${offsetLabel(n.offset)})`);
  const lines: string[] = [];
  if (o.date) lines.push(fmtDate(photo.date));
  if (o.weight) lines.push(near.weightLb ? `Weight ${fmtWeight(near.weightLb.value, unit)}${when(near.weightLb)}` : "Weight: none recorded within a week");
  if (o.waist) lines.push(near.waistIn ? `Waist ${fmtWaist(near.waistIn.value, unit)}${when(near.waistIn)}` : "Waist: none recorded within a week");
  if (o.bodyFat) lines.push(near.bodyFatPct ? `Body fat ${near.bodyFatPct.value}% (scale estimate)${when(near.bodyFatPct)}` : "Body fat: none recorded within a week");
  if (o.muscle) lines.push(near.muscleLb ? `Muscle ${fmtWeight(near.muscleLb.value, unit)} (scale estimate)${when(near.muscleLb)}` : "Muscle: none recorded within a week");
  return lines;
}

/** Before/after of two photos: a drag slider or side by side. Images keep their proportions. */
export function PhotoCompare({
  before,
  after,
  entries,
  overlay,
  unit,
  prsBetween,
}: {
  before: PhotoMeta;
  after: PhotoMeta;
  entries: BodyEntry[];
  overlay: Overlay;
  unit: Unit;
  prsBetween: number | null;
}) {
  const [mode, setMode] = useState<"slider" | "side">("slider");
  const [pos, setPos] = useState(50);
  const ratio = `${after.w} / ${after.h}`;

  return (
    <div>
      <div role="group" aria-label="Comparison style" className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-900 p-1 text-xs font-semibold">
        {(["slider", "side"] as const).map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`h-9 rounded-lg ${mode === m ? "bg-zinc-100 text-zinc-900" : "text-zinc-400"}`}>
            {m === "slider" ? "Slider" : "Side by side"}
          </button>
        ))}
      </div>

      {mode === "slider" ? (
        <div className="mt-2">
          <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: ratio }}>
            <PhotoImg photo={after} className="absolute inset-0 h-full w-full object-contain" alt={`After, ${after.date}`} />
            <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
              <PhotoImg photo={before} className="absolute inset-0 h-full w-full bg-black object-contain" alt={`Before, ${before.date}`} />
            </div>
            <div aria-hidden className="absolute inset-y-0 w-0.5 bg-amber-200 shadow" style={{ left: `${pos}%` }} />
            <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-200">Before</span>
            <span className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">After</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            aria-label="Before and after slider"
            className="mt-2 w-full accent-amber-300"
          />
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[before, after].map((p, i) => (
            <div key={p.id} className="relative overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "3 / 4" }}>
              <PhotoImg photo={p} className="absolute inset-0 h-full w-full object-contain" />
              <span className={`absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${i ? "text-amber-200" : "text-zinc-200"}`}>
                {i ? "After" : "Before"}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        {[before, after].map((p, i) => (
          <ul key={p.id} aria-label={i ? "After details" : "Before details"} className="grid gap-0.5 text-zinc-300">
            {overlayLines(entries, p, overlay, unit).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        ))}
      </div>
      {overlay.date && <p className="mt-2 text-center text-xs text-zinc-400">{durationLabel(before.date, after.date)} between photos</p>}
      {prsBetween != null && prsBetween > 0 && (
        <p className="mt-1 text-center text-xs text-lime-300">
          {prsBetween} personal record{prsBetween === 1 ? "" : "s"} set between these dates
        </p>
      )}
    </div>
  );
}
