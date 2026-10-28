"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AccentLast, TITLE } from "@/components/ui";
import { loadUnit } from "@/components/SetLogger";
import { NO_MEASUREMENTS, PhotoCompare, PhotoImg, type Overlay } from "@/components/PhotoCompare";
import { ComparisonShare } from "@/components/ComparisonShare";
import { getFile, loadEntries, type BodyEntry } from "@/lib/bodyLog";
import { shrinkImage } from "@/lib/image";
import { todayStr } from "@/lib/habits";
import { syncAchievements } from "@/lib/achievements/store";
import { fmtDate } from "@/lib/achievements/format";
import {
  PRESETS,
  VIEWS,
  addPhoto,
  loadPhotos,
  pickComparison,
  removePhoto,
  replacePhoto,
  sessions,
  updatePhoto,
  weekNumber,
  type ComparePreset,
  type PhotoMeta,
  type PhotoView,
} from "@/lib/photos";

const PR_TYPES = new Set(["weight-pr", "rep-pr", "volume-pr", "bodyweight-pr"]);

async function prepare(file: File) {
  const blob = await shrinkImage(file, 1600, 0.88);
  const bmp = await createImageBitmap(blob);
  const size = { w: bmp.width, h: bmp.height };
  bmp.close();
  return { blob, ...size };
}

/** Visual Evolution — private progress photos with a timeline and before/after comparisons. */
export function VisualEvolution({ onBack, onBody }: { onBack: () => void; onBody: () => void }) {
  const [photos, setPhotos] = useState<PhotoMeta[]>([]);
  const [entries, setEntries] = useState<BodyEntry[]>([]);
  const [prDates, setPrDates] = useState<string[]>([]);
  const [date, setDate] = useState(todayStr());
  const [view, setView] = useState<PhotoView>("front");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tips, setTips] = useState(false);
  const [cmpView, setCmpView] = useState<PhotoView>("front");
  const [preset, setPreset] = useState<ComparePreset | "custom">("previous");
  const [custom, setCustom] = useState<[string, string]>(["", ""]);
  const [overlay, setOverlay] = useState<Overlay>(NO_MEASUREMENTS);
  const [open, setOpen] = useState<PhotoMeta | null>(null);
  const [sharing, setSharing] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const unit = loadUnit();

  const refresh = () => setPhotos(loadPhotos());
  useEffect(() => {
    refresh();
    setEntries(loadEntries());
    setPrDates(syncAchievements().all.filter((a) => PR_TYPES.has(a.type)).map((a) => a.date));
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { blob, w, h } = await prepare(file);
      await addPhoto(blob, { date: date || todayStr(), view, w, h, note });
      setNote("");
      refresh();
      // Move on to the next missing view for the same session.
      const have = new Set(loadPhotos().filter((p) => p.date === date).map((p) => p.view));
      const next = (["front", "side", "back"] as PhotoView[]).find((v) => !have.has(v));
      if (next) setView(next);
    } catch {
      setError("Couldn't save that photo — this phone may be out of storage, or the image format isn't supported.");
    } finally {
      setBusy(false);
    }
  }

  const ofView = photos.filter((p) => p.view === cmpView);
  const pair = useMemo<[PhotoMeta, PhotoMeta] | null>(() => {
    if (preset !== "custom") return pickComparison(photos, cmpView, preset);
    const a = ofView.find((p) => p.id === custom[0]);
    const b = ofView.find((p) => p.id === custom[1]);
    if (!a || !b || a.id === b.id) return null;
    return a.date <= b.date ? [a, b] : [b, a];
  }, [photos, cmpView, preset, custom, ofView]);
  const prsBetween = pair ? prDates.filter((d) => d > pair[0].date && d <= pair[1].date).length : 0;
  const today = new Set(photos.filter((p) => p.date === date).map((p) => p.view));
  const first = photos[0]?.date;
  const timeline = sessions(photos).reverse();

  return (
    <section className="mt-2">
      <button type="button" onClick={onBack} className="text-sm text-zinc-400">
        ← Back
      </button>
      <h1 className={`${TITLE} mt-2`}>
        <AccentLast text="Visual evolution" />
      </h1>
      <p className="mt-1 text-sm text-zinc-400">Private progress photos — stored only on this phone, never uploaded.</p>

      {/* Capture */}
      <section aria-label="Add progress photos" className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">Add photos</p>
          <button type="button" onClick={() => setTips((t) => !t)} aria-expanded={tips} className="text-xs font-semibold text-amber-300">
            {tips ? "Hide tips" : "Photo tips"}
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-400">
          For more useful comparisons, try to use the same lighting, camera angle, distance, posture, and clothing.
        </p>
        {tips && (
          <ul className="mt-2 grid list-disc gap-1 pl-5 text-xs text-zinc-300">
            <li>Same spot, same light — e.g. the bathroom mirror, morning, before eating.</li>
            <li>Phone at chest height, held straight, same distance each time (mark the floor).</li>
            <li>Relaxed stance, arms slightly away from the body, same clothing.</li>
            <li>Take front, side and back in one go; once a week is plenty.</li>
            <li>Keep the whole body in frame with a little space above the head and below the feet.</li>
          </ul>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-xs text-zinc-400">
            Photo date
            <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} className="mt-1 h-10 w-full rounded-lg bg-zinc-800 px-2 text-sm text-zinc-100" />
          </label>
          <label className="text-xs text-zinc-400">
            Private note (optional)
            <input value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="e.g. after leg day" className="mt-1 h-10 w-full rounded-lg bg-zinc-800 px-2 text-sm text-zinc-100 placeholder:text-zinc-600" />
          </label>
        </div>
        <div role="group" aria-label="Camera view" className="mt-2 grid grid-cols-4 gap-1 rounded-xl bg-zinc-800 p-1 text-xs font-semibold">
          {VIEWS.map((v) => (
            <button key={v.key} type="button" aria-pressed={view === v.key} onClick={() => setView(v.key)} className={`h-9 rounded-lg ${view === v.key ? "bg-zinc-100 text-zinc-900" : "text-zinc-300"}`}>
              {v.label}
              {today.has(v.key) && " ✓"}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-zinc-500">
          This session: {(["front", "side", "back"] as PhotoView[]).map((v) => `${VIEWS.find((x) => x.key === v)!.label} ${today.has(v) ? "✓" : "—"}`).join(" · ")}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => camera.current?.click()} className="h-11 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-200 text-sm font-semibold text-zinc-950 disabled:opacity-50">
            📷 Take photo
          </button>
          <button type="button" disabled={busy} onClick={() => upload.current?.click()} className="h-11 rounded-xl bg-zinc-800 text-sm font-semibold text-zinc-100 disabled:opacity-50">
            🖼 Upload
          </button>
        </div>
        <input ref={camera} type="file" accept="image/*" capture="user" onChange={onFile} className="sr-only" aria-label="Take a progress photo" tabIndex={-1} />
        <input ref={upload} type="file" accept="image/*" onChange={onFile} className="sr-only" aria-label="Upload a progress photo" tabIndex={-1} />
        {busy && <p className="mt-2 text-xs text-zinc-400">Saving…</p>}
        {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
      </section>

      {/* Compare */}
      {photos.length > 0 && (
        <section aria-label="Compare photos" className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5">
          <p className="font-semibold">Compare</p>
          <div role="group" aria-label="Compare view" className="mt-2 grid grid-cols-4 gap-1 rounded-xl bg-zinc-800 p-1 text-xs font-semibold">
            {VIEWS.map((v) => (
              <button key={v.key} type="button" aria-pressed={cmpView === v.key} onClick={() => setCmpView(v.key)} className={`h-9 rounded-lg ${cmpView === v.key ? "bg-zinc-100 text-zinc-900" : "text-zinc-300"}`}>
                {v.label}
              </button>
            ))}
          </div>
          <div className="-mx-3.5 mt-2 flex gap-1.5 overflow-x-auto px-3.5 pb-1 [scrollbar-width:none]">
            {[...PRESETS.map((p) => ({ key: p.key as ComparePreset | "custom", label: p.label })), { key: "custom" as const, label: "Custom dates" }].map((p) => (
              <button key={p.key} type="button" aria-pressed={preset === p.key} onClick={() => setPreset(p.key)} className={`h-8 shrink-0 rounded-full px-3 text-xs font-semibold ${preset === p.key ? "bg-amber-300 text-zinc-950" : "border border-zinc-700 text-zinc-300"}`}>
                {p.label}
              </button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["Before", "After"] as const).map((label, i) => (
                <label key={label} className="text-xs text-zinc-400">
                  {label}
                  <select
                    value={custom[i]}
                    onChange={(e) => setCustom((c) => (i ? [c[0], e.target.value] : [e.target.value, c[1]]))}
                    className="mt-1 h-10 w-full rounded-lg bg-zinc-800 px-2 text-sm text-zinc-100"
                  >
                    <option value="">Choose…</option>
                    {ofView.map((p) => (
                      <option key={p.id} value={p.id}>
                        {fmtDate(p.date)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}

          {pair ? (
            <div className="mt-3">
              <PhotoCompare before={pair[0]} after={pair[1]} entries={entries} overlay={overlay} unit={unit} prsBetween={prsBetween} />
              <details className="mt-3 rounded-xl bg-zinc-800/60 p-2.5 text-sm">
                <summary className="cursor-pointer font-semibold">Show measurements</summary>
                <p className="mt-1 text-xs text-zinc-400">From your Body tracker. If nothing was measured on the photo day, the nearest record within a week is shown with its own date.</p>
                {(
                  [
                    ["date", "Dates and time between"],
                    ["weight", "Weight"],
                    ["waist", "Waist"],
                    ["bodyFat", "Body fat (scale estimate)"],
                    ["muscle", "Muscle (scale estimate)"],
                  ] as [keyof Overlay, string][]
                ).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2.5 py-1">
                    <input type="checkbox" checked={overlay[k]} onChange={(e) => setOverlay((o) => ({ ...o, [k]: e.target.checked }))} className="h-5 w-5 accent-lime-400" />
                    {label}
                  </label>
                ))}
                <button type="button" onClick={() => setOverlay({ date: false, weight: false, waist: false, bodyFat: false, muscle: false })} className="mt-1 text-xs font-semibold text-zinc-400">
                  Hide all
                </button>
              </details>
              <button type="button" onClick={() => setSharing(true)} className="mt-3 h-11 w-full rounded-xl bg-gradient-to-r from-amber-300 to-yellow-200 text-sm font-semibold text-zinc-950">
                ✦ Create comparison image
              </button>
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-zinc-700 p-3 text-sm text-zinc-400">
              {ofView.length < 2
                ? `Add at least two ${VIEWS.find((v) => v.key === cmpView)!.label.toLowerCase()} photos on different days to compare.`
                : preset === "custom"
                  ? "Choose two different photos."
                  : preset === "previous"
                    ? "No earlier photo at least 5 days before your latest one."
                    : `No ${VIEWS.find((v) => v.key === cmpView)!.label.toLowerCase()} photo in week ${PRESETS.find((p) => p.key === preset)!.week} yet (counted from your first photo).`}
            </p>
          )}
        </section>
      )}

      {/* Timeline */}
      <section aria-label="Photo timeline" className="mt-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Timeline</h2>
        {timeline.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-400">
            No photos yet. Take a front, side and back photo today — then once a week — and this becomes your visual record.
          </p>
        ) : (
          <ol className="mt-2 grid gap-3">
            {timeline.map((s) => (
              <li key={s.date}>
                <p className="text-sm font-semibold">
                  Week {weekNumber(first!, s.date)} <span className="font-normal text-zinc-400">· {fmtDate(s.date)}</span>
                </p>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {s.photos.map((p) => (
                    <button key={p.id} type="button" onClick={() => setOpen(p)} aria-label={`Open ${p.view} photo from ${p.date}`} className="relative overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "3 / 4" }}>
                      <PhotoImg photo={p} className="absolute inset-0 h-full w-full object-cover" />
                      <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] font-semibold capitalize">{p.view}</span>
                      {p.note && <span aria-hidden className="absolute right-1 top-1 text-[10px]">📝</span>}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <button type="button" onClick={onBody} className="mt-5 w-full text-center text-sm font-semibold text-zinc-400">
        Log weight or waist in Body tracker →
      </button>

      {open && (
        <PhotoDetail
          photo={open}
          onClose={() => setOpen(null)}
          onChanged={() => {
            refresh();
            setOpen(loadPhotos().find((p) => p.id === open.id) ?? null);
          }}
        />
      )}
      {sharing && pair && (
        <ComparisonShare
          before={{ date: pair[0].date, photo: pair[0] }}
          after={{ date: pair[1].date, photo: pair[1] }}
          entries={entries}
          prsBetween={prsBetween}
          onClose={() => setSharing(false)}
        />
      )}
    </section>
  );
}

/** One photo: view, edit date / view / note, replace, save a copy, delete. */
function PhotoDetail({ photo, onClose, onChanged }: { photo: PhotoMeta; onClose: () => void; onChanged: () => void }) {
  const [note, setNote] = useState(photo.note ?? "");
  const replace = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  async function saveCopy() {
    const blob = await getFile(photo.fileId);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `progress-${photo.date}-${photo.view}.jpg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`${photo.view} photo, ${photo.date}`} className="fixed inset-0 z-[60] overflow-y-auto bg-black">
      <div className="mx-auto w-full max-w-md px-4 pb-10">
        <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between bg-black/95 px-4 py-3">
          <p className="font-semibold capitalize">
            {photo.view} · {fmtDate(photo.date)}
          </p>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-zinc-800 text-lg">
            ×
          </button>
        </div>
        <div className="overflow-hidden rounded-xl bg-zinc-950" style={{ aspectRatio: `${photo.w} / ${photo.h}` }}>
          <PhotoImg photo={photo} className="h-full w-full object-contain" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-xs text-zinc-400">
            Date
            <input
              type="date"
              value={photo.date}
              max={todayStr()}
              onChange={(e) => e.target.value && (updatePhoto(photo.id, { date: e.target.value }), onChanged())}
              className="mt-1 h-10 w-full rounded-lg bg-zinc-800 px-2 text-sm text-zinc-100"
            />
          </label>
          <label className="text-xs text-zinc-400">
            View
            <select value={photo.view} onChange={(e) => (updatePhoto(photo.id, { view: e.target.value as PhotoView }), onChanged())} className="mt-1 h-10 w-full rounded-lg bg-zinc-800 px-2 text-sm text-zinc-100">
              {VIEWS.map((v) => (
                <option key={v.key} value={v.key}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-2 block text-xs text-zinc-400">
          Private note
          <input
            value={note}
            maxLength={120}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => (updatePhoto(photo.id, { note }), onChanged())}
            className="mt-1 h-10 w-full rounded-lg bg-zinc-800 px-2 text-sm text-zinc-100"
          />
        </label>
        <p className="mt-1 text-[11px] text-zinc-500">Notes are never put on shared images.</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm font-semibold">
          <button type="button" onClick={() => replace.current?.click()} className="h-11 rounded-xl bg-zinc-800">
            Replace
          </button>
          <button type="button" onClick={saveCopy} className="h-11 rounded-xl bg-zinc-800">
            Save copy
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm("Delete this photo from this phone? This can't be undone.")) return;
              await removePhoto(photo.id);
              onChanged();
              onClose();
            }}
            className="h-11 rounded-xl bg-red-500/15 text-red-200"
          >
            Delete
          </button>
        </div>
        <input
          ref={replace}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-label="Replacement photo"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const { blob, w, h } = await prepare(file);
            await replacePhoto(photo.id, blob, w, h);
            onChanged();
          }}
        />
      </div>
    </div>
  );
}
