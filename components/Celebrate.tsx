"use client";

import { useEffect, useState } from "react";
import { NewAwards } from "@/components/NewAwards";
import { syncAchievements, type StoredAchievement } from "@/lib/achievements/store";
import type { Unit } from "@/components/SetLogger";
import { WinBadge } from "@/components/WinBadge";
import { PR_LABEL, formatWeight, fromLb, type PR, type Summary } from "@/lib/wins";

function formatPr(pr: PR, unit: Unit) {
  if (pr.kind === "reps") return { value: `${pr.value} reps`, delta: `${pr.value - pr.previous}` };
  const delta = Math.round(fromLb(pr.value, unit) - fromLb(pr.previous, unit));
  return { value: formatWeight(pr.value, unit), delta: `${delta.toLocaleString()} ${unit}` };
}

/** Full-screen "you did it" summary shown when a workout is finished. */
export function Celebrate({
  summary,
  unit,
  onClose,
  onSeeAll,
}: {
  summary: Summary;
  unit: Unit;
  onClose: () => void;
  onSeeAll?: () => void;
}) {
  // Awards earned by this workout (trophies are recomputed from the saved sets).
  const [awards, setAwards] = useState<StoredAchievement[]>([]);
  useEffect(() => {
    // Recorded in the last few seconds = earned by this workout (safe if the effect runs twice).
    const since = Date.now() - 10_000;
    setAwards(syncAchievements().all.filter((a) => !a.seen && a.createdAt >= since));
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    if (summary.prs.length || summary.newBadges.length) navigator.vibrate?.([80, 60, 80, 60, 200]);
    return () => {
      document.body.style.overflow = "";
    };
  }, [summary]);

  const byExercise = summary.prs.reduce<Record<string, PR[]>>((acc, pr) => {
    (acc[pr.exercise] ??= []).push(pr);
    return acc;
  }, {});
  const change =
    summary.prevVolumeLb && summary.volumeLb > 0
      ? Math.round(((summary.volumeLb - summary.prevVolumeLb) / summary.prevVolumeLb) * 100)
      : null;
  const hero = summary.newBadges.slice(-2);

  return (
    <div role="dialog" aria-modal="true" aria-label="Workout summary" className="fixed inset-0 z-[60] overflow-y-auto bg-zinc-950">
      <div className="mx-auto w-full max-w-md px-4 pb-10">
        <div className="relative -mx-4 overflow-hidden bg-gradient-to-b from-lime-400/25 via-lime-400/5 to-transparent px-4 pb-6 pt-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lime-300">
            {summary.label} · {new Date(summary.date + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </p>
          {hero.length > 0 ? (
            <div className="mt-5 flex items-end justify-center gap-3">
              {hero.map((b) => (
                <WinBadge key={b.id} badge={b} size="lg" isNew />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-6xl" aria-hidden>
              {summary.prs.length ? "🔥" : "💪"}
            </p>
          )}
          <h2 className="mt-5 text-3xl font-bold tracking-tight">
            {summary.empty ? "Nothing logged yet" : "Congratulations!"}
          </h2>
          <p className="mt-1 text-lg text-zinc-300">
            {summary.empty ? (
              "Tick some sets (or finish cardio) and come back."
            ) : summary.volumeLb > 0 ? (
              <>
                You lifted <span className="font-bold text-lime-300">{formatWeight(summary.volumeLb, unit)}</span>
              </>
            ) : (
              <>
                You did <span className="font-bold text-sky-300">{summary.cardioMin} min</span> of cardio
              </>
            )}
          </p>
          {!summary.empty && (summary.steps || summary.floors) ? (
            <p className="mt-1 text-sm text-zinc-400">
              👟{" "}
              {[summary.steps && `${summary.steps.toLocaleString()} steps`, summary.floors && `${summary.floors} floors`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          {!summary.empty && summary.durationMin ? (
            <p className="mt-1 text-sm text-zinc-400">
              ⏱ Workout time <span className="font-semibold text-zinc-200">{summary.durationMin} min</span>
            </p>
          ) : null}
          {change !== null && (
            <p className={`mt-1 text-sm font-semibold ${change >= 0 ? "text-lime-300" : "text-zinc-400"}`}>
              {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% vs your last {summary.label}
            </p>
          )}
        </div>

        {!summary.empty && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat value={summary.exercises} label="Exercises" />
            <Stat value={summary.sets} label="Sets" />
            <Stat value={summary.cardioMin} label="Cardio min" />
          </div>
        )}

        {summary.prs.length > 0 && (
          <section className="mt-5">
            <div className="flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3">
              <span className="text-3xl" aria-hidden>
                🔥
              </span>
              <p className="text-sm text-amber-100">
                You set <span className="font-bold">{summary.prs.length} new personal record{summary.prs.length === 1 ? "" : "s"}</span>{" "}
                (PRs)
              </p>
            </div>
            <ul className="mt-3 grid gap-3">
              {Object.entries(byExercise).map(([exercise, prs]) => (
                <li key={exercise} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                  <p className="font-semibold">{exercise}</p>
                  <dl className="mt-2 grid gap-1.5 text-sm">
                    {prs.map((pr) => {
                      const f = formatPr(pr, unit);
                      return (
                        <div key={pr.kind} className="flex items-baseline justify-between gap-3">
                          <dt className="text-zinc-400">{PR_LABEL[pr.kind]}</dt>
                          <dd className="whitespace-nowrap tabular-nums">
                            <span className="font-semibold">{f.value}</span>{" "}
                            <span className="text-lime-400">▲ {f.delta}</span>
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </li>
              ))}
            </ul>
          </section>
        )}

        <NewAwards awards={awards} />

        {summary.newBadges.length > 0 && (
          <section className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Badges unlocked</h3>
            <div className="mt-3 flex flex-wrap gap-3">
              {summary.newBadges.map((b) => (
                <WinBadge key={b.id} badge={b} isNew />
              ))}
            </div>
          </section>
        )}

        {!summary.empty && summary.prs.length === 0 && (
          <p className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
            No new PRs this time — every working set to failure still counts. Beat a number from the
            Previous column next session to light this up.
          </p>
        )}

        <p className="mt-5 text-center text-sm text-zinc-500">
          Lifetime: {formatWeight(summary.totals.volumeLb, unit)} lifted · {summary.totals.workouts} workout
          {summary.totals.workouts === 1 ? "" : "s"} · {summary.totals.prs} PRs
        </p>

        <div className="mt-5 grid gap-2">
          {onSeeAll && (
            <button
              type="button"
              onClick={onSeeAll}
              className="h-12 rounded-xl bg-zinc-800 text-base font-semibold text-zinc-100 transition hover:bg-zinc-700 active:scale-[0.98]"
            >
              🏆 See all your wins
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-xl bg-lime-400 text-base font-semibold text-zinc-950 transition hover:bg-lime-300 active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 py-3">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</p>
    </div>
  );
}
