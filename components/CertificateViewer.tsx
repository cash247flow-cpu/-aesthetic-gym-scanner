"use client";

import { useEffect, useState } from "react";
import { loadUnit } from "@/components/SetLogger";
import type { StoredAchievement } from "@/lib/achievements/store";
import { FORMATS, canvasToBlob, renderCertificate, type CertFormat, type RenderReport } from "@/lib/achievements/certificate";
import { DEFAULT_PREFS, loadPrefs, referralUrl, savePrefs, type SharePrefs } from "@/lib/achievements/sharePrefs";

const fileName = (a: StoredAchievement, format: CertFormat) =>
  `aesthetiq-${(a.exerciseName ?? a.title).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${a.date}-${format}.png`;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Full-screen certificate: live preview of the exact image, privacy choices, save and share. */
export function CertificateViewer({ achievement: a, onClose }: { achievement: StoredAchievement; onClose: () => void }) {
  const [format, setFormat] = useState<CertFormat>("story");
  const [prefs, setPrefs] = useState<SharePrefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState<{ url: string; report: RenderReport; canvas: HTMLCanvasElement } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const qrUrl = referralUrl();
  const body = a.family === "transformation";
  const hasExercise = !!a.exerciseName;

  useEffect(() => {
    setPrefs(loadPrefs());
    setReady(true);
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Re-render the certificate whenever the content choices or format change.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const name = prefs.showName && prefs.name.trim() ? prefs.name.trim().slice(0, 40) : null;
    renderCertificate(
      a,
      {
        unit: loadUnit(),
        name,
        showExercise: prefs.showExercise,
        showPerformance: prefs.showPerformance,
        showDate: prefs.showDate,
        showMeasurements: body && prefs.showMeasurements,
        coach: prefs.showCoach && prefs.coach.trim() ? prefs.coach.trim().slice(0, 40) : null,
        qr: prefs.showQr && qrUrl ? { url: qrUrl, caption: "Join AESTHETIQ" } : null,
      },
      format,
    )
      .then(({ canvas, report }) => {
        if (cancelled) return;
        setPreview((old) => {
          if (old) URL.revokeObjectURL(old.url);
          return null;
        });
        canvas.toBlob((b) => {
          if (!cancelled && b) setPreview({ url: URL.createObjectURL(b), report, canvas });
        }, "image/png");
      })
      .catch(() => !cancelled && setStatus("Couldn't draw the certificate. Check your connection and try again."));
    return () => {
      cancelled = true;
    };
  }, [a, prefs, format, ready, body, qrUrl]);

  function update(patch: Partial<SharePrefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(next);
  }

  async function save() {
    if (!preview) return;
    download(await canvasToBlob(preview.canvas), fileName(a, format));
    setStatus("Saved to your downloads.");
  }

  async function share() {
    if (!preview) return;
    const blob = await canvasToBlob(preview.canvas);
    const file = new File([blob], fileName(a, format), { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: `${a.title} — AESTHETIQ` });
        setStatus("Shared.");
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          download(blob, file.name);
          setStatus("Sharing isn't available here, so the image was saved instead.");
        }
      }
    } else {
      download(blob, file.name);
      setStatus("This browser can't share images directly, so it was saved to your downloads — share it from there.");
    }
  }

  const toggle = (key: keyof SharePrefs, label: string, hint?: string) => (
    <label className="flex items-start gap-2.5 py-1.5">
      <input
        type="checkbox"
        checked={!!prefs[key]}
        onChange={(e) => update({ [key]: e.target.checked } as Partial<SharePrefs>)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-lime-400"
      />
      <span className="text-sm">
        {label}
        {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
      </span>
    </label>
  );

  return (
    <div role="dialog" aria-modal="true" aria-label={`Certificate: ${a.title}`} className="fixed inset-0 z-[70] overflow-y-auto bg-black">
      <div className="mx-auto w-full max-w-md px-4 pb-12">
        <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 bg-black/95 px-4 py-3 backdrop-blur">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">Certificate</p>
            <p className="truncate font-semibold">{a.exerciseName ? `${a.title} · ${a.exerciseName}` : a.title}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-zinc-800 text-lg">
            ×
          </button>
        </div>

        <div role="group" aria-label="Image size" className="mt-1 grid grid-cols-3 gap-1 rounded-xl bg-zinc-900 p-1">
          {(Object.keys(FORMATS) as CertFormat[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              aria-pressed={format === f}
              className={`h-10 rounded-lg text-xs font-semibold leading-tight transition ${format === f ? "bg-zinc-100 text-zinc-900" : "text-zinc-400"}`}
            >
              {f === "story" ? "Story" : f === "portrait" ? "Portrait" : "Square"}
              <span className="block text-[10px] font-normal opacity-70">{FORMATS[f].w}×{FORMATS[f].h}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.url} alt={`${a.title} certificate preview`} className="block w-full" />
          ) : (
            <div className="grid place-items-center text-sm text-zinc-500" style={{ aspectRatio: `${FORMATS[format].w} / ${FORMATS[format].h}` }}>
              Drawing your certificate…
            </div>
          )}
        </div>
        <p className="mt-1.5 text-center text-[11px] text-zinc-500">This preview is exactly the image that will be saved or shared.</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={save} disabled={!preview} className="h-12 rounded-xl bg-zinc-800 font-semibold text-zinc-100 disabled:opacity-40">
            ⬇ Save image
          </button>
          <button
            type="button"
            onClick={share}
            disabled={!preview}
            className="h-12 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-200 font-semibold text-zinc-950 disabled:opacity-40"
          >
            ↗ Share
          </button>
        </div>
        {status && (
          <p role="status" className="mt-2 text-center text-sm text-lime-300">
            {status}
          </p>
        )}

        <section aria-label="What's on this certificate" className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5">
          <p className="font-semibold">What&apos;s on this certificate</p>
          <p className="mt-0.5 text-xs text-zinc-400">Only what you tick appears. Changes update the preview.</p>
          <div className="mt-2">
            {toggle("showName", "Your name")}
            {prefs.showName && (
              <input
                value={prefs.name}
                onChange={(e) => update({ name: e.target.value.slice(0, 40) })}
                placeholder="Name to show (left off if empty)"
                aria-label="Display name"
                className="mb-1 ml-7 h-10 w-[calc(100%-1.75rem)] rounded-lg bg-zinc-800 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            )}
            {hasExercise && toggle("showExercise", "Exercise")}
            {!body && toggle("showPerformance", "Performance numbers", "Weights, reps and totals")}
            {toggle("showDate", "Date earned")}
            {body && toggle("showMeasurements", "Body measurements", "Off unless you choose it — this certificate only.")}
            {toggle("showCoach", "Coach branding")}
            {prefs.showCoach && (
              <input
                value={prefs.coach}
                onChange={(e) => update({ coach: e.target.value.slice(0, 40) })}
                placeholder="Coach or gym name"
                aria-label="Coach name"
                className="mb-1 ml-7 h-10 w-[calc(100%-1.75rem)] rounded-lg bg-zinc-800 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            )}
            {qrUrl && toggle("showQr", "Referral QR code", `Links to ${new URL(qrUrl).host}`)}
          </div>
        </section>

        <section className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3.5 text-xs text-zinc-400">
          <p>
            <span className="font-semibold text-zinc-200">🔒 Private achievement.</span> Awards are stored only on this phone.
          </p>
          <p className="mt-1">
            <span className="font-semibold text-zinc-200">⬇ Saved or shared image.</span> A picture you create and send yourself —
            nothing is uploaded or posted for you.
          </p>
          <p className="mt-1">
            <span className="font-semibold text-zinc-200">🌐 Public achievement page.</span> Not available: the app has no public
            server, so nothing about you is ever online.
          </p>
        </section>
      </div>
    </div>
  );
}
