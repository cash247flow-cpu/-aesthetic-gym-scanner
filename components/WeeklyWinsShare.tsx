"use client";

import { useEffect, useMemo, useState } from "react";
import { loadUnit } from "@/components/SetLogger";
import { ArtifactShare, OptionToggle, TEXT_INPUT } from "@/components/ArtifactShare";
import { renderWeeklyWins } from "@/lib/achievements/cards";
import type { CertFormat } from "@/lib/achievements/certificate";
import { DEFAULT_PREFS, loadPrefs, referralLink, savePrefs, type SharePrefs } from "@/lib/achievements/sharePrefs";
import type { WeekMetrics } from "@/lib/review/metrics";
import { lastCompleted, periodFor, periodLabel, type Period } from "@/lib/review/period";
import { liveReview, loadReviews, loadStartDay } from "@/lib/review/store";
import { todayStr } from "@/lib/habits";
import { defaultWins, winCandidates, type WinKey } from "@/lib/review/winsCard";

const MAX = 4;

/** Format A — the Weekly Wins card, built from one week's recorded numbers. */
export function WeeklyWinsShare({ metrics, onClose }: { metrics: WeekMetrics; onClose: () => void }) {
  const unit = loadUnit();
  const candidates = useMemo(() => winCandidates(metrics, unit), [metrics, unit]);
  const [chosen, setChosen] = useState<WinKey[]>(() => defaultWins(candidates));
  const [prefs, setPrefs] = useState<SharePrefs | null>(null);
  const [showPeriod, setShowPeriod] = useState(true);
  useEffect(() => setPrefs(loadPrefs()), []);
  const p = prefs ?? DEFAULT_PREFS;
  const coach = p.showCoach && p.coach.trim() ? p.coach.trim().slice(0, 40) : null;
  const qrUrl = referralLink(undefined, undefined, coach);

  function update(patch: Partial<SharePrefs>) {
    const next = { ...p, ...patch };
    setPrefs(next);
    savePrefs(next);
  }
  function toggle(key: WinKey, on: boolean) {
    setChosen((c) => (on ? [...c, key].slice(0, MAX) : c.filter((k) => k !== key)));
  }

  const selected = candidates.filter((c) => chosen.includes(c.key));
  const render = (format: CertFormat) =>
    renderWeeklyWins(
      selected,
      showPeriod ? periodLabel(metrics.period) : null,
      {
        name: p.showName && p.name.trim() ? p.name.trim().slice(0, 40) : null,
        coach,
        qr: p.showQr && qrUrl ? { url: qrUrl, caption: "Join AESTHETIQ" } : null,
      },
      format,
    );

  return (
    <ArtifactShare
      title="Weekly Wins"
      subtitle={periodLabel(metrics.period)}
      kind="weekly-wins"
      fileBase={`aesthetiq-weekly-wins-${metrics.period.start}`}
      render={render}
      renderKey={JSON.stringify([chosen, showPeriod, prefs ? p : null])}
      blocked={selected.length ? null : "Pick at least one win to show."}
      coach={coach}
      onClose={onClose}
    >
      <section aria-label="What's on this card" className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5">
        <p className="font-semibold">Your wins ({selected.length}/{MAX})</p>
        <p className="mt-0.5 text-xs text-zinc-400">Only this week&apos;s recorded numbers are offered. Body numbers are off unless you add them.</p>
        <div className="mt-2">
          {candidates.length === 0 && <p className="py-2 text-sm text-zinc-400">Nothing recorded this week yet — log a workout, habits or a weigh-in first.</p>}
          {candidates.map((c) => (
            <OptionToggle
              key={c.key}
              checked={chosen.includes(c.key)}
              disabled={!chosen.includes(c.key) && chosen.length >= MAX}
              onChange={(v) => toggle(c.key, v)}
              label={`${c.label}: ${c.value}`}
              hint={c.body ? "Body measurement — private unless you tick it" : c.sub}
            />
          ))}
        </div>
        <div className="mt-2 border-t border-zinc-800 pt-2">
          <OptionToggle checked={showPeriod} onChange={setShowPeriod} label="Dates of the week" />
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
      </section>
    </ArtifactShare>
  );
}

/** Your Wins entry point: share last week's (or this week's) Weekly Wins card. */
export function WeeklyWinsEntry() {
  const [open, setOpen] = useState<WeekMetrics | null>(null);
  const [periods, setPeriods] = useState<{ last: Period; current: Period } | null>(null);
  useEffect(() => {
    const d = loadStartDay();
    const t = todayStr();
    setPeriods({ last: lastCompleted(t, d), current: periodFor(t, d) });
  }, []);
  if (!periods) return null;
  const pick = (p: Period) => {
    // A saved review's numbers are what the user signed off on; otherwise use today's data.
    const rec = loadReviews()[p.start];
    setOpen(rec ? rec.versions[rec.versions.length - 1].metrics : liveReview(p, null).metrics);
  };
  return (
    <section aria-label="Weekly Wins" className="mt-6 rounded-2xl border border-amber-300/30 bg-gradient-to-b from-amber-300/10 to-transparent p-3.5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Weekly Wins</p>
      <p className="mt-1 text-sm text-zinc-300">The scale isn&apos;t the whole story — share the week&apos;s real numbers.</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => pick(periods.last)} className="h-10 rounded-xl bg-amber-300 text-xs font-semibold text-zinc-950">
          Last week
        </button>
        <button type="button" onClick={() => pick(periods.current)} className="h-10 rounded-xl border border-zinc-600 text-xs font-semibold text-zinc-200">
          This week so far
        </button>
      </div>
      {open && <WeeklyWinsShare metrics={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
