"use client";

import { useState } from "react";
import { loadUnit } from "@/components/SetLogger";
import { WinBadge } from "@/components/WinBadge";
import { formatWeight, loadWins, type BadgeGroup } from "@/lib/wins";
import { Accent, TITLE } from "@/components/ui";
import { TrophyCollection } from "@/components/TrophyCollection";
import { WeeklyWinsEntry } from "@/components/WeeklyWinsShare";

const GROUP_TITLE: Record<BadgeGroup, string> = {
  lift: "Weight lifted",
  workouts: "Workouts",
  prs: "Personal records",
  cardio: "Cardio",
  habits: "Habit streaks (perfect days)",
};

const latestPr = (dates: Partial<Record<string, string>>) =>
  Object.values(dates).reduce<string | undefined>((max, d) => (d && (!max || d > max) ? d : max), undefined);

const shortDate = (d: string) => new Date(d + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** "Your wins": lifetime totals, badge wall, best lifts and workout history — the proof. */
export function WinsView({ onBack }: { onBack: () => void }) {
  const [unit] = useState(loadUnit);
  const [{ totals, badges, history, records }] = useState(() => loadWins(unit));
  const earned = badges.filter((b) => b.earned).length;

  return (
    <section className="mt-2">
      <h1 className={TITLE}>Your <Accent>wins</Accent> 🏆</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {totals.workouts === 0
          ? "Finish your first workout to start collecting badges and PRs."
          : `${earned} of ${badges.length} badges earned. Proof you're getting stronger.`}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Tile value={formatWeight(totals.volumeLb, unit)} label="Total lifted" accent="text-lime-300" />
        <Tile value={String(totals.workouts)} label="Workouts" accent="text-violet-300" />
        <Tile value={String(totals.prs)} label="PRs set" accent="text-amber-300" />
        <Tile value={`${totals.cardioMin} min`} label="Cardio" accent="text-sky-300" />
      </div>

      <WeeklyWinsEntry />

      <TrophyCollection />

      {(Object.keys(GROUP_TITLE) as BadgeGroup[]).map((group) => (
        <section key={group} className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{GROUP_TITLE[group]}</h2>
          <div className="mt-3 grid grid-cols-4 justify-items-center gap-y-3">
            {badges
              .filter((b) => b.group === group)
              .map((b) => (
                <WinBadge key={b.id} badge={b} />
              ))}
          </div>
        </section>
      ))}

      <section className="mt-7">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Best lifts</h2>
        {records.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Your heaviest sets show up here after you finish a workout.</p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-800 rounded-2xl border border-zinc-800 bg-zinc-900">
            {records.map((r) => (
              <li key={r.exercise} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.exercise}</p>
                  {latestPr(r.bestDate) && <p className="text-xs text-zinc-500">Last PR {shortDate(latestPr(r.bestDate)!)}</p>}
                </div>
                <p className="shrink-0 text-right text-sm tabular-nums">
                  {r.best.weight > 0 ? (
                    <>
                      <span className="font-semibold">{formatWeight(r.best.weight, unit)}</span>
                      <br />
                      <span className="text-xs text-zinc-500">best set {formatWeight(r.best.setVolume, unit)}</span>
                    </>
                  ) : (
                    <span className="font-semibold">{r.best.reps} reps</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-7">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Workout history</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No finished workouts yet.</p>
        ) : (
          <ul className="mt-2 grid grid-cols-1 gap-2">
            {history.slice(0, 30).map((h) => (
              <li
                key={`${h.date}-${h.session}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{h.label}</p>
                  <p className="text-xs text-zinc-500">
                    {shortDate(h.date)} · {h.sets} sets{h.cardioMin ? ` · ${h.cardioMin} min cardio` : ""}
                  </p>
                </div>
                <div className="text-right text-sm tabular-nums">
                  {h.volumeLb > 0 && <p className="font-semibold">{formatWeight(h.volumeLb, unit)}</p>}
                  {h.prs > 0 && <p className="text-xs font-semibold text-amber-300">🔥 {h.prs} PR{h.prs === 1 ? "" : "s"}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        type="button"
        onClick={onBack}
        className="mt-7 h-12 w-full rounded-xl bg-zinc-800 text-base font-semibold text-zinc-100 transition hover:bg-zinc-700 active:scale-[0.98]"
      >
        Back
      </button>
    </section>
  );
}

function Tile({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
      <p className={`text-xl font-bold tabular-nums ${accent}`}>{value}</p>
      <p className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</p>
    </div>
  );
}
