"use client";

import { useEffect, useState } from "react";
import { loadUnit } from "@/components/SetLogger";
import { CertificateViewer } from "@/components/CertificateViewer";
import { FAMILIES, TIERS, type Family, type Tier } from "@/lib/achievements/config";
import type { Locked } from "@/lib/achievements/detect";
import { fmtDate, fmtWeight, summaryLine, TYPE_LABEL } from "@/lib/achievements/format";
import { markSeen, syncAchievements, type StoredAchievement } from "@/lib/achievements/store";

const TIER_STYLE: Record<Tier, string> = {
  silver: "from-zinc-200 to-zinc-400 text-zinc-900",
  gold: "from-amber-200 to-yellow-500 text-zinc-950",
  platinum: "from-sky-50 to-slate-300 text-zinc-900",
};
const FAMILY_FILTERS: (Family | "all")[] = ["all", "conqueror", "transformation", "discipline"];
const FAMILY_SHORT: Record<Family, string> = { conqueror: "Conqueror", transformation: "Transformation", discipline: "Discipline" };

/** "My Trophy Collection": earned awards (open the certificate) and locked milestones. */
export function TrophyCollection() {
  const [data, setData] = useState<{ all: StoredAchievement[]; locked: Locked[] } | null>(null);
  const [filter, setFilter] = useState<Family | "all">("all");
  const [open, setOpen] = useState<StoredAchievement | null>(null);
  const [showAll, setShowAll] = useState(false);
  const unit = typeof window === "undefined" ? "lb" : loadUnit();

  useEffect(() => {
    const result = syncAchievements();
    setData(result);
    // Shown once as "NEW", then marked seen (deferred so a re-run of this effect still sees them as new).
    const timer = setTimeout(() => markSeen(result.all.filter((a) => !a.seen).map((a) => a.id)), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!data) return <div className="mt-6 h-24" aria-hidden />;
  const earned = data.all.filter((a) => filter === "all" || a.family === filter);
  const shown = showAll ? earned : earned.slice(0, 8);
  const locked = data.locked.filter((l) => filter === "all" || l.family === filter);

  return (
    <section aria-label="My trophy collection" className="mt-6">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">My Trophy Collection</h2>
        <span className="text-xs text-zinc-500">{data.all.length} earned</span>
      </div>

      <div role="group" aria-label="Achievement family" className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {FAMILY_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`h-8 shrink-0 rounded-full px-3 text-xs font-semibold transition ${
              filter === f ? "bg-amber-300 text-zinc-950" : "border border-zinc-700 text-zinc-300"
            }`}
          >
            {f === "all" ? "All" : FAMILY_SHORT[f]}
          </button>
        ))}
      </div>

      {earned.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-400">
          No trophies here yet. Finish a workout with logged sets — your first record on each exercise earns one.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-2">
          {shown.map((a) => (
            <li key={a.id} className="flex gap-3 rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-black p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/achievements/emblem-${a.tier}.webp`} alt="" className="h-16 w-20 shrink-0 object-contain" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {FAMILIES[a.family].series}
                  {!a.seen && <span className="rounded bg-lime-400 px-1 text-[9px] text-zinc-950">NEW</span>}
                </p>
                <p className="truncate font-semibold">{a.title}</p>
                <p className="truncate text-xs text-zinc-300">{summaryLine(a, unit)}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-zinc-500">
                  <span className={`rounded-full bg-gradient-to-r px-1.5 py-px text-[10px] font-bold uppercase ${TIER_STYLE[a.tier]}`}>
                    {a.tier}
                  </span>
                  <span>{TYPE_LABEL[a.type]}</span>
                  <span>{fmtDate(a.date)}</span>
                </p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => setOpen(a)} className="h-8 rounded-full bg-amber-300 px-3 text-xs font-semibold text-zinc-950">
                    View certificate
                  </button>
                  <button type="button" onClick={() => setOpen(a)} aria-label={`Share ${a.title}`} className="h-8 rounded-full border border-zinc-600 px-3 text-xs font-semibold text-zinc-200">
                    ↗ Share
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {earned.length > shown.length && (
        <button type="button" onClick={() => setShowAll(true)} className="mt-2 w-full text-center text-xs font-semibold text-zinc-400">
          Show all {earned.length}
        </button>
      )}

      {locked.length > 0 && (
        <>
          <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Locked — keep going</h3>
          <ul className="mt-2 grid grid-cols-1 gap-1.5">
            {locked.map((l) => (
              <li key={l.id} aria-label={`${l.title}, locked`} className="flex items-center gap-3 rounded-xl border border-dashed border-zinc-800 px-3 py-2 opacity-70">
                <span aria-hidden className="text-lg grayscale">🔒</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-zinc-300">{l.title}</span>
                  <span className="block truncate text-[10px] uppercase tracking-wide text-zinc-500">
                    {l.tier} · {TIERS[l.tier].collection}
                  </span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <span className="block h-full rounded-full bg-zinc-500" style={{ width: `${Math.min(100, (l.progress / l.target) * 100)}%` }} />
                  </span>
                  <span className="mt-0.5 block text-[11px] text-zinc-500">
                    {l.unit === "lb lifted" ? `${fmtWeight(l.progress, unit)} of ${fmtWeight(l.target, unit)} lifted` : `${l.progress} of ${l.target} ${l.unit}`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {open && <CertificateViewer achievement={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
