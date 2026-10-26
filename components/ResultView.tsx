"use client";

import { Fragment, useState } from "react";
import type { PlannedExercise, PlanResult } from "@/lib/plan";
import { CANONICAL_EQUIPMENT } from "@/lib/equipment";
import { RestTimer, defaultRestSeconds, unlockAudio, type RestRequest } from "@/components/RestTimer";

export function formatRest(restSeconds: string): string {
  const nums = restSeconds.split(/[–-]/).map((n) => Number(n.trim()));
  if (nums.every((n) => Number.isFinite(n) && n >= 120 && n % 60 === 0)) {
    return `Rest ${nums.map((n) => n / 60).join("–")} min`;
  }
  return `Rest ${restSeconds}s`;
}

const plural = (n: number) => (n === 1 ? "exercise" : "exercises");

export function ResultView({
  plan,
  onReset,
  onEquipmentChange,
}: {
  plan: PlanResult;
  onReset: () => void;
  onEquipmentChange: (equipment: string[]) => Promise<void>;
}) {
  const isLegs = plan.counts.abs > 0 || plan.sessionLabel === "Legs & Abs";
  // Divider goes before the first abs card, but only if a non-abs card precedes it.
  const firstAbsIndex = plan.exercises.findIndex((e) => e.abs === true);
  const [rest, setRest] = useState<RestRequest | null>(null);

  function startRest(ex: PlannedExercise) {
    unlockAudio(); // must happen inside the tap so the end-of-rest beep is allowed
    setRest({ id: Date.now(), label: ex.name, seconds: defaultRestSeconds(ex.restSeconds) });
  }

  return (
    <section className={`mt-2 ${rest ? "pb-44" : ""}`}>
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{plan.sessionLabel}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {isLegs
            ? `${plan.counts.leg} leg ${plural(plan.counts.leg)} + ${plan.counts.abs} ab ${plural(plan.counts.abs)} · ${plan.note}`
            : plan.note}
        </p>
      </header>

      <EquipmentEditor equipment={plan.equipment} onChange={onEquipmentChange} />

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
            <ExerciseCard ex={ex} index={i + 1} onStartRest={() => startRest(ex)} />
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

      {rest && <RestTimer key={rest.id} request={rest} onClose={() => setRest(null)} />}
    </section>
  );
}

function EquipmentEditor({
  equipment,
  onChange,
}: {
  equipment: string[];
  onChange: (equipment: string[]) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = CANONICAL_EQUIPMENT.filter((e) => !equipment.includes(e));

  async function update(next: string[]) {
    setBusy(true);
    setError(null);
    try {
      await onChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the plan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Equipment found</h2>
        <span className="text-[11px] text-zinc-500" aria-live="polite">
          {busy ? "Updating…" : "Tap to remove"}
        </span>
      </div>

      <ul className={`mt-2 flex flex-wrap gap-1.5 ${busy ? "opacity-60" : ""}`}>
        {equipment.map((e) => (
          <li key={e}>
            <button
              type="button"
              disabled={busy}
              onClick={() => update(equipment.filter((x) => x !== e))}
              aria-label={`Remove ${e}`}
              className="flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 py-1 pl-2.5 pr-2 text-xs capitalize text-zinc-200 transition hover:border-red-400/60 active:scale-95"
            >
              {e}
              <span aria-hidden className="text-zinc-500">×</span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            disabled={busy}
            onClick={() => setAdding((v) => !v)}
            aria-expanded={adding}
            className="rounded-full border border-dashed border-lime-400/60 px-2.5 py-1 text-xs font-medium text-lime-300 transition hover:bg-lime-400/10 active:scale-95"
          >
            {adding ? "Done" : "+ Add equipment"}
          </button>
        </li>
      </ul>

      {equipment.length === 0 && !adding && (
        <p className="mt-2 text-sm text-zinc-400">Nothing recognizable — add equipment or try a wider shot.</p>
      )}

      {adding && (
        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
          <p className="text-xs text-zinc-400">Gemini missed something? Tap to add it.</p>
          <ul className={`mt-2 flex flex-wrap gap-1.5 ${busy ? "opacity-60" : ""}`}>
            {missing.map((e) => (
              <li key={e}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => update([...equipment, e])}
                  className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs capitalize text-zinc-400 transition hover:border-lime-400 hover:text-zinc-100 active:scale-95"
                >
                  + {e}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}

function ExerciseCard({ ex, index, onStartRest }: { ex: PlannedExercise; index: number; onStartRest: () => void }) {
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
        <button
          type="button"
          onClick={onStartRest}
          aria-label={`Start rest timer for ${ex.name}`}
          className="flex items-center gap-1.5 rounded-full border border-zinc-700 px-2.5 py-1 text-sm text-zinc-300 transition hover:border-lime-400 hover:text-lime-300 active:scale-95"
        >
          <TimerIcon />
          {formatRest(ex.restSeconds)}
        </button>
      </div>

      <p className="mt-3 text-sm text-zinc-200">
        <span className="font-semibold text-zinc-400">Cue · </span>
        {ex.cue}
      </p>
      {ex.reason && <p className="mt-1.5 text-sm italic text-zinc-400">{ex.reason}</p>}
    </li>
  );
}

function TimerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M9 2h6" />
    </svg>
  );
}
