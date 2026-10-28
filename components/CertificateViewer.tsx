"use client";

import { useEffect, useState } from "react";
import { loadUnit } from "@/components/SetLogger";
import { ArtifactShare, OptionToggle, TEXT_INPUT } from "@/components/ArtifactShare";
import type { StoredAchievement } from "@/lib/achievements/store";
import { renderCertificate, type CertFormat } from "@/lib/achievements/certificate";
import { DEFAULT_PREFS, loadPrefs, referralLink, savePrefs, type SharePrefs } from "@/lib/achievements/sharePrefs";

/** Full-screen certificate: live preview of the exact image, privacy choices, save and share. */
export function CertificateViewer({ achievement: a, onClose }: { achievement: StoredAchievement; onClose: () => void }) {
  const [prefs, setPrefs] = useState<SharePrefs | null>(null);
  const body = a.family === "transformation";
  const hasExercise = !!a.exerciseName;

  useEffect(() => setPrefs(loadPrefs()), []);
  const p = prefs ?? DEFAULT_PREFS;
  const coach = p.showCoach && p.coach.trim() ? p.coach.trim().slice(0, 40) : null;
  const qrUrl = referralLink(undefined, undefined, coach);

  function update(patch: Partial<SharePrefs>) {
    const next = { ...p, ...patch };
    setPrefs(next);
    savePrefs(next);
  }

  const render = (format: CertFormat) =>
    renderCertificate(
      a,
      {
        unit: loadUnit(),
        name: p.showName && p.name.trim() ? p.name.trim().slice(0, 40) : null,
        showExercise: p.showExercise,
        showPerformance: p.showPerformance,
        showDate: p.showDate,
        showMeasurements: body && p.showMeasurements,
        coach,
        qr: p.showQr && qrUrl ? { url: qrUrl, caption: "Join AESTHETIQ" } : null,
      },
      format,
    );

  return (
    <ArtifactShare
      title={a.exerciseName ? `${a.title} · ${a.exerciseName}` : a.title}
      subtitle="Certificate"
      kind="certificate"
      fileBase={`aesthetiq-${(a.exerciseName ?? a.title).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${a.date}`}
      render={render}
      renderKey={prefs ? JSON.stringify(p) : ""}
      coach={coach}
      onClose={onClose}
    >
      <section aria-label="What's on this certificate" className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5">
        <p className="font-semibold">What&apos;s on this certificate</p>
        <p className="mt-0.5 text-xs text-zinc-400">Only what you tick appears. Changes update the preview.</p>
        <div className="mt-2">
          <OptionToggle checked={p.showName} onChange={(v) => update({ showName: v })} label="Your name" />
          {p.showName && (
            <input
              value={p.name}
              onChange={(e) => update({ name: e.target.value.slice(0, 40) })}
              placeholder="Name to show (left off if empty)"
              aria-label="Display name"
              className={TEXT_INPUT}
            />
          )}
          {hasExercise && <OptionToggle checked={p.showExercise} onChange={(v) => update({ showExercise: v })} label="Exercise" />}
          {!body && <OptionToggle checked={p.showPerformance} onChange={(v) => update({ showPerformance: v })} label="Performance numbers" hint="Weights, reps and totals" />}
          <OptionToggle checked={p.showDate} onChange={(v) => update({ showDate: v })} label="Date earned" />
          {body && (
            <OptionToggle
              checked={p.showMeasurements}
              onChange={(v) => update({ showMeasurements: v })}
              label="Body measurements"
              hint="Off unless you choose it — this certificate only."
            />
          )}
          <OptionToggle checked={p.showCoach} onChange={(v) => update({ showCoach: v })} label="Coach branding" />
          {p.showCoach && (
            <input value={p.coach} onChange={(e) => update({ coach: e.target.value.slice(0, 40) })} placeholder="Coach or gym name" aria-label="Coach name" className={TEXT_INPUT} />
          )}
          {qrUrl && <OptionToggle checked={p.showQr} onChange={(v) => update({ showQr: v })} label="Referral QR code" hint={`Links to ${new URL(qrUrl).host}`} />}
        </div>
      </section>
    </ArtifactShare>
  );
}
