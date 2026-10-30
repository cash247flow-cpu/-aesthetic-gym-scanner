"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { FORMATS, canvasToBlob, type CertFormat, type RenderReport } from "@/lib/achievements/certificate";
import { referralLink } from "@/lib/achievements/sharePrefs";
import { track, type ArtifactKind } from "@/lib/events";

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

/**
 * Full-screen preview → save / share for any AESTHETIQ artifact (certificates, Weekly Wins,
 * comparisons). The preview is the exact PNG that gets saved. Nothing is ever posted for the user.
 */
export function ArtifactShare({
  title,
  subtitle,
  kind,
  fileBase,
  render,
  renderKey,
  blocked,
  coach,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  kind: ArtifactKind;
  fileBase: string;
  render: (format: CertFormat) => Promise<{ canvas: HTMLCanvasElement; report: RenderReport }>;
  /** Changes whenever the content changes, to redraw the preview. */
  renderKey: string;
  /** Save/Share stay disabled with this message until the user confirms (e.g. photo consent). */
  blocked?: string | null;
  coach?: string | null;
  onClose: () => void;
  children?: ReactNode;
}) {
  const [format, setFormat] = useState<CertFormat>("story");
  const [preview, setPreview] = useState<{ url: string; canvas: HTMLCanvasElement; report: RenderReport } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const tracked = useRef(false);
  const link = referralLink(undefined, undefined, coach);
  const renderRef = useRef(render);
  renderRef.current = render;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    renderRef
      .current(format)
      .then(({ canvas, report }) => {
        if (cancelled) return;
        canvas.toBlob((b) => {
          if (cancelled || !b) return;
          setPreview((old) => {
            if (old) URL.revokeObjectURL(old.url);
            return { url: URL.createObjectURL(b), canvas, report };
          });
          if (!tracked.current) {
            tracked.current = true;
            track("artifact_preview", kind);
          }
        }, "image/png");
      })
      .catch(() => !cancelled && setStatus("Couldn't draw the image. Check your connection and try again."));
    return () => {
      cancelled = true;
    };
  }, [format, renderKey, kind]);

  const name = `${fileBase}-${format}.png`;
  const disabled = !preview || !!blocked;

  async function save() {
    if (disabled) return;
    download(await canvasToBlob(preview!.canvas), name);
    track("artifact_saved", kind);
    setStatus("Saved to your downloads.");
  }

  async function share() {
    if (disabled) return;
    const blob = await canvasToBlob(preview!.canvas);
    const file = new File([blob], name, { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    track("share_started", kind);
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: `${title} — AESTHETIQ` });
        track("share_sheet_done", kind);
        setStatus("Share sheet closed. Whatever you chose there is up to you — nothing is posted automatically.");
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          download(blob, name);
          track("share_fallback_saved", kind);
          setStatus("Sharing isn't available here, so the image was saved instead.");
        }
      }
    } else {
      download(blob, name);
      track("share_fallback_saved", kind);
      setStatus("This browser can't share images directly, so it was saved to your downloads — share it from there.");
    }
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      track("referral_link_copied", kind);
      setStatus("Referral link copied.");
    } catch {
      setStatus(`Copy this link: ${link}`);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[70] overflow-y-auto bg-black">
      <div className="mx-auto w-full max-w-md px-4 pb-12">
        <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 bg-black/95 px-4 py-3 backdrop-blur">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">{subtitle ?? "Share"}</p>
            <p className="truncate font-semibold">{title}</p>
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
              <span className="block text-[10px] font-normal opacity-70">
                {FORMATS[f].w}×{FORMATS[f].h}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.url} alt={`${title} preview`} className="block w-full" />
          ) : (
            <div className="grid place-items-center text-sm text-zinc-500" style={{ aspectRatio: `${FORMATS[format].w} / ${FORMATS[format].h}` }}>
              Drawing your image…
            </div>
          )}
        </div>
        <p className="mt-1.5 text-center text-[11px] text-zinc-500">This preview is exactly the image that will be saved or shared.</p>
        {preview?.report.overflow && (
          <p className="mt-1 text-center text-xs text-amber-300">Some content is tight in this size — try Story, or show fewer items.</p>
        )}

        {blocked && <p className="mt-3 rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-center text-sm text-amber-100">{blocked}</p>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={save} disabled={disabled} className="h-12 rounded-xl bg-zinc-800 font-semibold text-zinc-100 disabled:opacity-40">
            ⬇ Save image
          </button>
          <button
            type="button"
            onClick={share}
            disabled={disabled}
            className="h-12 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-200 font-semibold text-zinc-950 disabled:opacity-40"
          >
            ↗ Share
          </button>
        </div>
        {link && (
          <button type="button" onClick={copyLink} className="mt-2 h-11 w-full rounded-xl border border-zinc-700 text-sm font-semibold text-zinc-200">
            🔗 Copy referral link
          </button>
        )}
        {status && (
          <p role="status" className="mt-2 text-center text-sm text-lime-300">
            {status}
          </p>
        )}

        {children}

        <section className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3.5 text-xs text-zinc-400">
          <p>
            <span className="font-semibold text-zinc-200">🔒 Private by default.</span> Your records and progress photos are saved on this phone. Only
            photos you choose to read with AI (scale, report, cardio or gym photos) are sent to Google Gemini — and only after you confirm.
          </p>
          <p className="mt-1">
            <span className="font-semibold text-zinc-200">⬇ Saved or shared image.</span> A picture you create and send yourself — nothing is
            uploaded or posted for you.
          </p>
          <p className="mt-1">
            <span className="font-semibold text-zinc-200">🌐 Public achievement page.</span> Not available: the app has no public server, so
            nothing about you is ever online.
          </p>
        </section>
      </div>
    </div>
  );
}

/** Checkbox row used in the "what's on this image" panels. */
export function OptionToggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-2.5 py-1.5 ${disabled ? "opacity-40" : ""}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-lime-400" />
      <span className="text-sm">
        {label}
        {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
      </span>
    </label>
  );
}

export const TEXT_INPUT =
  "mb-1 ml-7 h-10 w-[calc(100%-1.75rem)] rounded-lg bg-zinc-800 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-300";
