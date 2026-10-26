import { Fragment } from "react";
import type { PlannedExercise, PlanResult } from "@/lib/plan";

export function formatRest(restSeconds: string): string {
  const nums = restSeconds.split(/[–-]/).map((n) => Number(n.trim()));
  if (nums.every((n) => Number.isFinite(n) && n >= 120 && n % 60 === 0)) {
    return `Rest ${nums.map((n) => n / 60).join("–")} min`;
  }
  return `Rest ${restSeconds}s`;
}

const plural = (n: number) => (n === 1 ? "exercise" : "exercises");

export function ResultView({ plan, onReset }: { plan: PlanResult; onReset: () => void }) {
  const isLegs = plan.counts.abs > 0 || plan.sessionLabel === "Legs & Abs";
  // Divider goes before the first abs card, but only if a non-abs card precedes it.
  const firstAbsIndex = plan.exercises.findIndex((e) => e.abs === true);

  return (
    <section className="mt-2">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{plan.sessionLabel}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {isLegs
            ? `${plan.counts.leg} leg ${plural(plan.counts.leg)} + ${plan.counts.abs} ab ${plural(plan.counts.abs)} · ${plan.note}`
            : plan.note}
        </p>
      </header>

      <div className="mt-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Equipment found</h2>
        {plan.equipment.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {plan.equipment.map((e) => (
              <li key={e} className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs capitalize text-zinc-300">
                {e}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-zinc-400">Nothing recognizable — try a wider shot.</p>
        )}
      </div>

      {plan.missingNote && (
        <div role="status" className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-3 text-sm text-amber-200">
          {plan.missingNote}
        </div>
      )}

      <ol className="mt-5 grid gap-3">
        {plan.exercises.map((ex, i) => (
          <Fragment key={`${ex.name}-${i}`}>
            {isLegs && i === firstAbsIndex && i > 0 && (
              <li aria-hidden className="flex items-center gap-3 pt-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <span className="h-px flex-1 bg-zinc-800" />
                Abs
                <span className="h-px flex-1 bg-zinc-800" />
              </li>
            )}
            <ExerciseCard ex={ex} index={i + 1} />
          </Fragment>
        ))}
      </ol>

      <p className="mt-6 text-center text-sm text-zinc-400">
        Working sets to true failure. Keep these exercises ~8 weeks.
      </p>

      <button
        type="button"
        onClick={onReset}
        className="mt-4 h-12 w-full rounded-xl bg-lime-400 text-base font-semibold text-zinc-950 transition hover:bg-lime-300 active:scale-[0.98]"
      >
        Scan another gym
      </button>
    </section>
  );
}

function ExerciseCard({ ex, index }: { ex: PlannedExercise; index: number }) {
  return (
    <li className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-zinc-500">{String(index).padStart(2, "0")}</p>
          <h3 className="text-lg font-semibold leading-tight">{ex.name}</h3>
          {ex.swappedFrom && <p className="mt-0.5 text-xs text-zinc-500">Swapped from {ex.swappedFrom}</p>}
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-lime-400/15 px-2.5 py-1 text-xs font-semibold text-lime-300">
          {ex.badge}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-2xl font-bold tabular-nums">
          {ex.sets} × {ex.reps}
        </span>
        <span className="text-sm text-zinc-400">{formatRest(ex.restSeconds)}</span>
      </div>

      <p className="mt-3 text-sm text-zinc-200">
        <span className="font-semibold text-zinc-400">Cue · </span>
        {ex.cue}
      </p>
      {ex.reason && <p className="mt-1.5 text-sm italic text-zinc-400">{ex.reason}</p>}
    </li>
  );
}
