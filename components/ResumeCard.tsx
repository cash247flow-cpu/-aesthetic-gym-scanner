"use client";

import { useEffect, useState } from "react";
import { elapsedMs, formatDuration, loadActive, type ActiveWorkout } from "@/lib/activeWorkout";
import { ArrowCircle } from "@/components/ui";

/** Home-screen card for today's unfinished workout (paused or still running): tap to resume. */
export function ResumeCard({ onResume }: { onResume: (a: ActiveWorkout) => void }) {
  const [workout, setWorkout] = useState<ActiveWorkout | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => setWorkout(loadActive()), []);
  const running = !!workout?.runningSince;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!workout?.started) return null;

  return (
    <button
      type="button"
      onClick={() => onResume(workout)}
      className={`mt-4 flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.98] ${
        running ? "border-lime-400/60 bg-lime-400/5" : "border-amber-400/60 bg-amber-400/5"
      }`}
    >
      <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-zinc-900 text-lg">
        {running ? "⏱" : "⏸"}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[11px] font-semibold uppercase tracking-wider ${running ? "text-lime-300" : "text-amber-300"}`}>
          {running ? "Workout in progress" : "Workout paused"}
        </span>
        <span className="block truncate font-semibold">
          {workout.plan.sessionLabel} · <span className="tabular-nums">{formatDuration(elapsedMs(workout, now))}</span>
        </span>
        <span className="block text-xs text-zinc-400">Tap to resume where you left off</span>
      </span>
      <ArrowCircle dark={false} />
    </button>
  );
}
