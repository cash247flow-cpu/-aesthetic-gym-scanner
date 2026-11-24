"use client";

import { useCallback, useMemo, useState } from "react";
import { BodyFigures, muscleLabel } from "@/components/MuscleMap";
import { ExerciseGuide, hasGuide } from "@/components/ExerciseGuide";
import { AccentLast, TITLE } from "@/components/ui";
import { MUSCLES, exercisesFor, type IndexEntry } from "@/lib/exerciseIndex";

const NONE = new Set<string>();

/**
 * Exercises by muscle: tap a muscle on the figure (or its name below it) to see every exercise
 * in the program that trains it, with the days it's on and its "How to". Read-only: it doesn't
 * change the plan and stores nothing.
 */
export function MuscleExplorer({ onBack }: { onBack: () => void }) {
  const [muscle, setMuscle] = useState<string | null>(null);
  const [guide, setGuide] = useState<string | null>(null);
  const closeGuide = useCallback(() => setGuide(null), []);
  const list = useMemo(() => (muscle ? exercisesFor(muscle) : null), [muscle]);
  const selected = useMemo(() => (muscle ? new Set([muscle]) : NONE), [muscle]);

  return (
    <section className="mt-2">
      <button type="button" onClick={onBack} className="text-sm text-zinc-400">
        ← Back
      </button>
      <h1 className={`${TITLE} mt-2`}>
        <AccentLast text="Exercises by muscle" />
      </h1>
      <p className="mt-1 text-sm text-zinc-400">Tap a muscle to see the exercises in your program that train it.</p>

      <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
        <BodyFigures
          primary={selected}
          secondary={NONE}
          selected={muscle}
          onPick={setMuscle}
          label={muscle ? `Body map, ${muscleLabel(muscle)} selected` : "Body map: tap a muscle"}
          className="mx-auto block w-full max-w-[22rem] touch-manipulation"
        />
        <ul aria-label="Muscles" className="mt-3 flex flex-wrap justify-center gap-1.5">
          {MUSCLES.map((m) => (
            <li key={m}>
              <button
                type="button"
                aria-pressed={m === muscle}
                onClick={() => setMuscle(m)}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition active:scale-95 ${
                  m === muscle ? "border-lime-400 bg-lime-400 text-zinc-950" : "border-zinc-700 text-zinc-300 hover:border-lime-400"
                }`}
              >
                {muscleLabel(m)}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {muscle && list && (
        <div aria-live="polite" className="mt-4">
          <h2 className="text-lg font-bold">{muscleLabel(muscle)}</h2>
          {list.main.length > 0 ? (
            <ul aria-label={`Exercises for ${muscleLabel(muscle)}`} className="mt-2 grid grid-cols-1 gap-2">
              {list.main.map((e) => (
                <ExerciseRow key={e.name} entry={e} onGuide={setGuide} />
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-zinc-400">
              {list.helping.length > 0
                ? "No exercise in your program targets this muscle directly. These ones work it as a helper:"
                : "Your program doesn't train this muscle."}
            </p>
          )}

          {list.helping.length > 0 && (
            <details open={list.main.length === 0} className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-300">
                Also works it as a helper ({list.helping.length})
              </summary>
              <ul aria-label={`Helper exercises for ${muscleLabel(muscle)}`} className="mt-2 grid grid-cols-1 gap-2">
                {list.helping.map((e) => (
                  <ExerciseRow key={e.name} entry={e} onGuide={setGuide} compact />
                ))}
              </ul>
            </details>
          )}

          <p className="mt-3 text-xs text-zinc-500">
            Swap options show up under ⇄ Swap in a workout when the main exercise&apos;s machine is taken or missing.
          </p>
        </div>
      )}

      {guide && <ExerciseGuide exercise={guide} onClose={closeGuide} />}
    </section>
  );
}

function ExerciseRow({ entry, onGuide, compact = false }: { entry: IndexEntry; onGuide: (name: string) => void; compact?: boolean }) {
  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{entry.name}</p>
          <p className="mt-0.5 text-xs text-zinc-400">
            {entry.days.join(" · ")}
            {entry.swapFor ? <span className="text-zinc-500"> · swap for {entry.swapFor}</span> : <span className="text-lime-300/80"> · in the plan</span>}
          </p>
        </div>
        {hasGuide(entry.name) && (
          <button
            type="button"
            onClick={() => onGuide(entry.name)}
            aria-label={`How to do ${entry.name}`}
            className="shrink-0 rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-lime-400 hover:text-lime-300 active:scale-95"
          >
            ▶ How to
          </button>
        )}
      </div>
      {!compact && <p className="mt-1.5 text-sm text-zinc-300">{entry.cue}</p>}
    </li>
  );
}
