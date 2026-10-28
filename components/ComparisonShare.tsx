"use client";

import { useEffect, useState } from "react";
import { loadUnit } from "@/components/SetLogger";
import { ArtifactShare, OptionToggle, TEXT_INPUT } from "@/components/ArtifactShare";
import { fmtWaist } from "@/components/PhotoCompare";
import { renderComparison, type CompareRow } from "@/lib/achievements/cards";
import type { CertFormat } from "@/lib/achievements/certificate";
import type { Tier } from "@/lib/achievements/config";
import { fmtDate, fmtWeight } from "@/lib/achievements/format";
import { DEFAULT_PREFS, loadPrefs, referralLink, savePrefs, type SharePrefs } from "@/lib/achievements/sharePrefs";
import { getFile, type BodyEntry } from "@/lib/bodyLog";
import { VIEWS, durationLabel, measurementsNear, offsetLabel, type Near, type PhotoMeta } from "@/lib/photos";

type Rows = { weight: boolean; waist: boolean; bodyFat: boolean; muscle: boolean; strength: boolean };

async function loadImg(fileId: string): Promise<HTMLImageElement | null> {
  const blob = await getFile(fileId);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

/**
 * Format B — Transformation Comparison: two of the user's own photos (or measurements only),
 * nothing altered. The user must confirm the exact photos and numbers before saving or sharing.
 */
export function ComparisonShare({
  before,
  after,
  entries,
  prsBetween,
  onClose,
}: {
  before: { date: string; photo: PhotoMeta | null };
  after: { date: string; photo: PhotoMeta | null };
  entries: BodyEntry[];
  prsBetween: number;
  onClose: () => void;
}) {
  const unit = loadUnit();
  const photos = !!(before.photo && after.photo);
  const [imgs, setImgs] = useState<[HTMLImageElement | null, HTMLImageElement | null]>([null, null]);
  const [usePhotos, setUsePhotos] = useState(photos);
  const [rows, setRows] = useState<Rows>({ weight: !photos, waist: !photos, bodyFat: false, muscle: false, strength: false });
  const [tier, setTier] = useState<Tier>("gold");
  const [showDates, setShowDates] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [prefs, setPrefs] = useState<SharePrefs | null>(null);
  useEffect(() => setPrefs(loadPrefs()), []);
  const p = prefs ?? DEFAULT_PREFS;
  const coach = p.showCoach && p.coach.trim() ? p.coach.trim().slice(0, 40) : null;
  const qrUrl = referralLink(undefined, undefined, coach);

  useEffect(() => {
    if (!before.photo || !after.photo) return;
    let cancelled = false;
    let loaded: (HTMLImageElement | null)[] = [];
    Promise.all([loadImg(before.photo.fileId), loadImg(after.photo.fileId)]).then((pair) => {
      loaded = pair;
      if (!cancelled) setImgs(pair);
    });
    return () => {
      cancelled = true;
      loaded.forEach((i) => i && URL.revokeObjectURL(i.src));
    };
  }, [before.photo, after.photo]);

  const nb = measurementsNear(entries, before.date);
  const na = measurementsNear(entries, after.date);
  const notes: string[] = [];
  const row = (label: string, b: Near | null, a: Near | null, f: (v: number) => string): CompareRow | null => {
    if (!b || !a) return null;
    for (const [n, side] of [
      [b, "before"],
      [a, "after"],
    ] as const)
      if (n.offset !== 0)
        notes.push(`${label} ${side}: measured ${fmtDate(n.date)} (${usePhotos && photos ? offsetLabel(n.offset) : offsetLabel(n.offset).replace("the photo", "that date")})`);
    return { label, before: f(b.value), after: f(a.value) };
  };
  const table: CompareRow[] = [];
  const add = (r: CompareRow | null) => r && table.push(r);
  if (rows.weight) add(row("Weight", nb.weightLb, na.weightLb, (v) => fmtWeight(v, unit)));
  if (rows.waist) add(row("Waist", nb.waistIn, na.waistIn, (v) => fmtWaist(v, unit)));
  if (rows.bodyFat) add(row("Body fat (scale est.)", nb.bodyFatPct, na.bodyFatPct, (v) => `${v}%`));
  if (rows.muscle) add(row("Muscle (scale est.)", nb.muscleLb, na.muscleLb, (v) => fmtWeight(v, unit)));
  const available = { weight: !!(nb.weightLb && na.weightLb), waist: !!(nb.waistIn && na.waistIn), bodyFat: !!(nb.bodyFatPct && na.bodyFatPct), muscle: !!(nb.muscleLb && na.muscleLb) };

  const view = before.photo ? VIEWS.find((v) => v.key === before.photo!.view)?.label + " view" : null;
  const showPhotos = usePhotos && photos;
  const render = (format: CertFormat) =>
    renderComparison(
      {
        before: { img: showPhotos ? imgs[0] : null, date: showDates ? fmtDate(before.date) : "", label: "Before" },
        after: { img: showPhotos ? imgs[1] : null, date: showDates ? fmtDate(after.date) : "", label: "After" },
        duration: durationLabel(before.date, after.date),
        view: showPhotos ? view : null,
        rows: table,
        notes,
        strength: rows.strength && prsBetween > 0 ? `${prsBetween} personal record${prsBetween === 1 ? "" : "s"} along the way` : null,
        tier,
      },
      {
        name: p.showName && p.name.trim() ? p.name.trim().slice(0, 40) : null,
        coach,
        qr: p.showQr && qrUrl ? { url: qrUrl, caption: "Join AESTHETIQ" } : null,
      },
      format,
    );

  const nothing = !showPhotos && table.length === 0;
  const update = (patch: Partial<SharePrefs>) => {
    const next = { ...p, ...patch };
    setPrefs(next);
    savePrefs(next);
  };
  const set = (patch: Partial<Rows>) => {
    setRows((r) => ({ ...r, ...patch }));
    setConfirmed(false);
  };

  return (
    <ArtifactShare
      title="Transformation Comparison"
      subtitle={durationLabel(before.date, after.date)}
      kind="comparison"
      fileBase={`aesthetiq-comparison-${before.date}-${after.date}`}
      render={render}
      renderKey={JSON.stringify([rows, tier, showDates, usePhotos, !!imgs[0], !!imgs[1], prefs ? p : null])}
      blocked={nothing ? "Choose photos or at least one measurement to show." : confirmed ? null : "Tick the confirmation below before saving or sharing."}
      coach={coach}
      onClose={onClose}
    >
      <section aria-label="What's on this comparison" className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5">
        <p className="font-semibold">What&apos;s on this image</p>
        <p className="mt-0.5 text-xs text-zinc-400">Photos are shown exactly as taken — only resized to fit. Numbers come from your records.</p>
        <div className="mt-2">
          {photos && <OptionToggle checked={usePhotos} onChange={(v) => (setUsePhotos(v), setConfirmed(false))} label="Show the two photos" hint="Untick for a measurements-only version" />}
          <OptionToggle checked={showDates} onChange={setShowDates} label="Dates" />
          <OptionToggle checked={rows.weight} disabled={!available.weight} onChange={(v) => set({ weight: v })} label="Weight" hint={available.weight ? undefined : "Not recorded within a week of both dates"} />
          <OptionToggle checked={rows.waist} disabled={!available.waist} onChange={(v) => set({ waist: v })} label="Waist" hint={available.waist ? undefined : "Not recorded within a week of both dates"} />
          <OptionToggle checked={rows.bodyFat} disabled={!available.bodyFat} onChange={(v) => set({ bodyFat: v })} label="Body fat (scale estimate)" />
          <OptionToggle checked={rows.muscle} disabled={!available.muscle} onChange={(v) => set({ muscle: v })} label="Muscle (scale estimate)" />
          <OptionToggle checked={rows.strength} disabled={prsBetween === 0} onChange={(v) => set({ strength: v })} label="Personal records between the dates" hint={prsBetween ? `${prsBetween} recorded` : "None recorded"} />
          <div role="group" aria-label="Accent" className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-zinc-800 p-1 text-xs font-semibold">
            {(["gold", "platinum", "silver"] as Tier[]).map((t) => (
              <button key={t} type="button" aria-pressed={tier === t} onClick={() => setTier(t)} className={`h-9 rounded-lg capitalize ${tier === t ? "bg-zinc-100 text-zinc-900" : "text-zinc-400"}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="mt-2 border-t border-zinc-800 pt-2">
            <OptionToggle checked={p.showName} onChange={(v) => update({ showName: v })} label="Your name" />
            {p.showName && (
              <input value={p.name} onChange={(e) => update({ name: e.target.value.slice(0, 40) })} placeholder="Name to show (left off if empty)" aria-label="Display name" className={TEXT_INPUT} />
            )}
            <OptionToggle checked={p.showCoach} onChange={(v) => update({ showCoach: v })} label="Coach branding" />
            {p.showCoach && (
              <input value={p.coach} onChange={(e) => update({ coach: e.target.value.slice(0, 40) })} placeholder="Coach or gym name" aria-label="Coach name" className={TEXT_INPUT} />
            )}
            {qrUrl && <OptionToggle checked={p.showQr} onChange={(v) => update({ showQr: v })} label="Referral QR code" hint={`Links to ${new URL(qrUrl).host}`} />}
          </div>
        </div>
        <label className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-300/40 bg-amber-300/5 p-2.5">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-amber-300" aria-label="Confirm photos and numbers" />
          <span className="text-sm">I&apos;ve checked the preview: these exact {showPhotos ? "photos and " : ""}numbers may appear on this image.</span>
        </label>
      </section>
    </ArtifactShare>
  );
}
