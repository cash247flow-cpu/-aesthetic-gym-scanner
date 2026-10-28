"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RestRequest = { id: number; label: string; seconds: number };

const STEP = 15;
const MIN_SECONDS = 5;
const MAX_SECONDS = 15 * 60;

/** Lower bound of a "120–180" style range, used as the default rest length. */
export function defaultRestSeconds(restSeconds: string): number {
  const first = Number(restSeconds.split(/[–-]/)[0]?.trim());
  return Number.isFinite(first) && first > 0 ? first : 90;
}

export function formatClock(total: number): string {
  const s = Math.max(0, Math.ceil(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Browsers only allow audio after a user tap, so the context is created/resumed from the
// "start rest" click and reused for the end-of-rest beeps.
let audioCtx: AudioContext | null = null;
export function unlockAudio() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    if (audioCtx.state === "suspended") void audioCtx.resume();
  } catch {
    audioCtx = null;
  }
}

export function beep() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, now + i * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.4, now + i * 0.3 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.3 + 0.2);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now + i * 0.3);
    osc.stop(now + i * 0.3 + 0.22);
  }
}

type WakeLockSentinelLike = { release: () => Promise<void> };

/** Keep the screen on while `active` (works on https/localhost; silently skipped otherwise). */
export function useWakeLock(active: boolean) {
  const wakeRef = useRef<WakeLockSentinelLike | null>(null);
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> } };
    if (!active || !nav.wakeLock) return;
    let cancelled = false;
    nav.wakeLock
      .request("screen")
      .then((lock) => (cancelled ? void lock.release() : (wakeRef.current = lock)))
      .catch(() => {});
    return () => {
      cancelled = true;
      void wakeRef.current?.release().catch(() => {});
      wakeRef.current = null;
    };
  }, [active]);
}

export type RestState = { label: string; left: number; running: boolean; done: boolean };

export function RestTimer({
  request,
  onClose,
  onState,
}: {
  request: RestRequest;
  onClose: () => void;
  /** Mirrors the countdown (e.g. into the workout timer bar); null once closed. */
  onState?: (state: RestState | null) => void;
}) {
  const [total, setTotal] = useState(request.seconds);
  // Timestamps, not tick counting, so the clock stays right if the phone throttles the tab.
  const [endAt, setEndAt] = useState<number | null>(() => Date.now() + request.seconds * 1000);
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const firedRef = useRef(false);

  const running = endAt !== null;
  const left = running ? Math.max(0, (endAt - now) / 1000) : (pausedLeft ?? 0);
  const done = running && left <= 0;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  useWakeLock(running && !done);

  const shownLeft = Math.ceil(left);
  useEffect(() => {
    onState?.({ label: request.label, left: shownLeft, running, done });
  }, [onState, request.label, shownLeft, running, done]);
  useEffect(() => () => onState?.(null), [onState]);

  useEffect(() => {
    if (!done || firedRef.current) return;
    firedRef.current = true;
    navigator.vibrate?.([300, 150, 300, 150, 300]);
    beep();
  }, [done]);

  const restart = useCallback((seconds: number) => {
    firedRef.current = false;
    setTotal(seconds);
    setPausedLeft(null);
    setNow(Date.now());
    setEndAt(Date.now() + seconds * 1000);
  }, []);

  function adjust(delta: number) {
    unlockAudio();
    const next = Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, left + delta));
    setTotal((t) => Math.max(t + (next - left), next));
    if (running) setEndAt(Date.now() + next * 1000);
    else setPausedLeft(next);
  }

  function togglePause() {
    unlockAudio();
    if (running) {
      setPausedLeft(left);
      setEndAt(null);
    } else {
      setNow(Date.now());
      setEndAt(Date.now() + (pausedLeft ?? 0) * 1000);
      setPausedLeft(null);
    }
  }

  const progress = total > 0 ? Math.min(1, left / total) : 0;

  return (
    <div
      role="timer"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div
        className={`mx-auto w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl shadow-black/60 ${
          done ? "border-lime-400 bg-lime-400 text-zinc-950" : "border-zinc-700 bg-zinc-900/95 backdrop-blur"
        }`}
      >
        <div className="h-1 w-full bg-zinc-800/60">
          <div
            className={`h-full transition-[width] duration-200 ${done ? "bg-zinc-950/30" : "bg-lime-400"}`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className={`truncate text-[11px] font-semibold uppercase tracking-wider ${done ? "text-zinc-900/70" : "text-zinc-500"}`}>
              {done ? "Rest over — next set" : running ? "Resting" : "Paused"} · {request.label}
            </p>
            <p className="text-4xl font-bold tabular-nums leading-tight">{done ? "Go!" : formatClock(left)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close timer"
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg ${
              done ? "bg-zinc-950/10 hover:bg-zinc-950/20" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 px-4 pb-4">
          {done ? (
            <>
              <TimerButton done onClick={() => restart(request.seconds)} className="col-span-2">
                Restart {formatClock(request.seconds)}
              </TimerButton>
              <TimerButton done onClick={onClose}>
                Done
              </TimerButton>
            </>
          ) : (
            <>
              <TimerButton onClick={() => adjust(-STEP)} disabled={left <= MIN_SECONDS}>
                −{STEP}s
              </TimerButton>
              <TimerButton onClick={togglePause} primary>
                {running ? "Pause" : "Resume"}
              </TimerButton>
              <TimerButton onClick={() => adjust(STEP)}>+{STEP}s</TimerButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TimerButton({
  children,
  onClick,
  disabled,
  primary,
  done,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  done?: boolean;
  className?: string;
}) {
  const tone = done
    ? "bg-zinc-950 text-lime-300 hover:bg-zinc-800"
    : primary
      ? "bg-lime-400 text-zinc-950 hover:bg-lime-300"
      : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-11 rounded-xl text-sm font-semibold tabular-nums transition active:scale-95 disabled:opacity-40 ${tone} ${className}`}
    >
      {children}
    </button>
  );
}
