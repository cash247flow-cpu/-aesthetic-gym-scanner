"use client";

import { useEffect, useState } from "react";
import { elapsedMs, formatDuration, type ActiveWorkout } from "@/lib/activeWorkout";
import { formatClock, type RestState } from "@/components/RestTimer";

/** Whole-workout timer: Start, then Pause/Resume, and End (finishes the workout). */
export function WorkoutTimer({
  active,
  onStart,
  onPause,
  onEnd,
  rest,
}: {
  active: ActiveWorkout;
  rest?: RestState | null; // the rest countdown, mirrored so it's visible at the top too
  onStart: () => void;
  onPause: () => void;
  onEnd: () => void;
}) {
  const running = !!active.runningSince;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const state = running ? "running" : active.started ? "paused" : "ready";
  const pill = "h-10 rounded-full px-4 text-sm font-semibold transition active:scale-95";

  return (
    <div
      role="timer"
      aria-label={`Workout timer ${formatDuration(elapsedMs(active, now))} ${state}`}
      className={`sticky top-2 z-30 mt-4 flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 shadow-lg shadow-black/60 backdrop-blur ${
        state === "running" ? "border-lime-400/50 bg-zinc-950/90" : state === "paused" ? "border-amber-400/50 bg-zinc-950/90" : "border-zinc-800 bg-zinc-900/95"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          {state === "running" ? "Workout time" : state === "paused" ? "⏸ Paused" : "Workout timer"}
        </span>
        <span className={`block text-2xl font-bold tabular-nums ${state === "paused" ? "text-amber-200" : ""}`}>
          {formatDuration(elapsedMs(active, now))}
        </span>
        {rest && (
          <span className={`block text-xs font-semibold tabular-nums ${rest.done ? "text-lime-300" : "text-sky-300"}`}>
            {rest.done ? "Rest over — next set!" : `Rest ${formatClock(rest.left)}${rest.running ? "" : " (paused)"}`}
          </span>
        )}
      </span>
      {state === "ready" && (
        <button type="button" onClick={onStart} className={`${pill} bg-gradient-to-r from-lime-400 to-emerald-300 text-zinc-950`}>
          ▶ Start
        </button>
      )}
      {state === "running" && (
        <button type="button" onClick={onPause} className={`${pill} border border-amber-400/60 text-amber-200`}>
          ❚❚ Pause
        </button>
      )}
      {state === "paused" && (
        <button type="button" onClick={onStart} className={`${pill} bg-gradient-to-r from-lime-400 to-emerald-300 text-zinc-950`}>
          ▶ Resume
        </button>
      )}
      {state !== "ready" && (
        <button type="button" onClick={onEnd} className={`${pill} border border-zinc-600 text-zinc-200`}>
          ■ End
        </button>
      )}
    </div>
  );
}
