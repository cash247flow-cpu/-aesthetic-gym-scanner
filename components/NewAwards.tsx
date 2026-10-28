"use client";

import { useCallback, useState } from "react";
import { CertificateViewer } from "@/components/CertificateViewer";
import { TIERS } from "@/lib/achievements/config";
import { markSeen, syncAchievements, type StoredAchievement } from "@/lib/achievements/store";

/** Re-checks awards after the user saves something; returns any just earned. */
export function useNewAwards() {
  const [awards, setAwards] = useState<StoredAchievement[]>([]);
  const check = useCallback(() => {
    const { fresh } = syncAchievements();
    if (fresh.length) setAwards((old) => [...fresh, ...old.filter((a) => !fresh.some((f) => f.id === a.id))]);
  }, []);
  const dismiss = useCallback(() => setAwards([]), []);
  return { awards, check, dismiss };
}

/** "New award" banner: each earned award can open its certificate. */
export function NewAwards({ awards, onDismiss }: { awards: StoredAchievement[]; onDismiss?: () => void }) {
  const [open, setOpen] = useState<StoredAchievement | null>(null);
  if (!awards.length) return null;
  const shown = awards.slice(0, 3);

  function view(a: StoredAchievement) {
    markSeen([a.id]);
    setOpen(a);
  }

  return (
    <section role="status" aria-label="New awards" className="mt-4 rounded-2xl border border-amber-300/40 bg-gradient-to-b from-amber-300/15 to-transparent p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-amber-200">
          🏆 New award{awards.length === 1 ? "" : "s"} earned
        </p>
        {onDismiss && (
          <button type="button" onClick={onDismiss} aria-label="Dismiss" className="-m-1 grid h-8 w-8 shrink-0 place-items-center text-zinc-400">
            ×
          </button>
        )}
      </div>
      <ul className="mt-2 grid gap-2">
        {shown.map((a) => (
          <li key={a.id} className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/achievements/emblem-${a.tier}.webp`} alt="" className="h-10 w-14 shrink-0 object-contain" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{a.exerciseName ? `${a.title} · ${a.exerciseName}` : a.title}</span>
              <span className="block truncate text-[11px] uppercase tracking-wide text-zinc-400">
                {a.tier} · {TIERS[a.tier].collection}
              </span>
            </span>
            <button type="button" onClick={() => view(a)} className="h-8 shrink-0 rounded-full bg-amber-300 px-3 text-xs font-semibold text-zinc-950">
              Certificate
            </button>
          </li>
        ))}
      </ul>
      {awards.length > shown.length && (
        <p className="mt-2 text-xs text-zinc-400">+{awards.length - shown.length} more in Progress → Your Wins</p>
      )}
      {open && <CertificateViewer achievement={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
