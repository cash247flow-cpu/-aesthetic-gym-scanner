"use client";

import { useEffect, useRef, useState } from "react";
import { beep, formatClock, unlockAudio, useWakeLock } from "@/components/RestTimer";
import type { Unit } from "@/components/SetLogger";

export type CardioMachine = "treadmill" | "stairmaster";
export type CardioPosition = "before" | "after";
export type CardioPlan = { position: CardioPosition; machine: CardioMachine; minutes: number; level?: string };

// The training plan's cardio: 40 minutes on the StairMaster at level 7, after lifting.
export const DEFAULT_CARDIO: CardioPlan = { position: "after", machine: "stairmaster", minutes: 40, level: "7" };
// v2: earlier builds stored "no cardio" as a missing key; now it's on by default.
const PLAN_KEY = "ags:cardio:v2";
const OFF = "off";

export type CardioLog = { date: string; minutes: number; speed: string; incline: string; level: string };

export const MACHINE_LABEL: Record<CardioMachine, string> = { treadmill: "Treadmill", stairmaster: "StairMaster" };
const PRESETS = [10, 15, 20, 30, 40];
const MIN_MINUTES = 1;
const MAX_MINUTES = 90;
const today = () => new Date().toLocaleDateString("en-CA");

// Same storage rules as the set log: never let localStorage errors break the page.
/** Cardio added to lifting days: the plan's default until changed, null once removed. */
export function loadCardioPlan(): CardioPlan | null {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (raw === null) return DEFAULT_CARDIO;
    const parsed = JSON.parse(raw) as CardioPlan | typeof OFF;
    return parsed === OFF ? null : { ...DEFAULT_CARDIO, ...parsed };
  } catch {
    return DEFAULT_CARDIO;
  }
}

export function saveCardioPlan(plan: CardioPlan | null) {
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan ?? OFF));
  } catch {
    /* ignore */
  }
}

export function loadLog(machine: CardioMachine): CardioLog | null {
  try {
    const raw = localStorage.getItem(`ags:cardio:log:${machine}`);
    return raw ? (JSON.parse(raw) as CardioLog) : null;
  } catch {
    return null;
  }
}

function saveLog(machine: CardioMachine, log: CardioLog) {
  try {
    localStorage.setItem(`ags:cardio:log:${machine}`, JSON.stringify(log));
  } catch {
    /* ignore */
  }
}

export function CardioCard({
  plan,
  unit,
  onChange,
  onRemove,
  onDone,
  onFinishedChange,
  standalone = false,
}: {
  plan: CardioPlan;
  unit: Unit;
  onChange: (plan: CardioPlan) => void;
  onRemove: () => void;
  /** Called once when the cardio is finished (timer ran out or "Finish" tapped). */
  onDone: () => void;
  onFinishedChange: (finished: boolean) => void;
  /** Cardio-only day: no before/after lifting, nothing to move or remove. */
  standalone?: boolean;
}) {
  const { machine, minutes, position } = plan;
  const speedUnit = unit === "kg" ? "km/h" : "mph";

  const [last, setLast] = useState<CardioLog | null>(() => loadLog(machine));
  const [todayLog, setTodayLog] = useState(() => {
    const l = loadLog(machine);
    return l?.date === today() ? l : null;
  });
  const [speed, setSpeed] = useState(todayLog?.speed ?? "");
  const [incline, setIncline] = useState(todayLog?.incline ?? "");
  // StairMaster level starts at the plan's target (level 7) until something is logged.
  const targetLevelRef = useRef(plan.level ?? "");
  targetLevelRef.current = plan.level ?? "";
  const [level, setLevel] = useState(todayLog?.level ?? targetLevelRef.current);

  // Timer: timestamps rather than tick counting, like the rest timer.
  const [endAt, setEndAt] = useState<number | null>(null);
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [finished, setFinished] = useState(todayLog !== null);
  const firedRef = useRef(false);

  const running = endAt !== null;
  const started = running || pausedLeft !== null;
  const left = running ? Math.max(0, (endAt - now) / 1000) : (pausedLeft ?? minutes * 60);
  const timeUp = running && left <= 0;

  useWakeLock(running && !timeUp);

  useEffect(() => {
    onFinishedChange(finished);
  }, [finished, onFinishedChange]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  // Switching machine loads that machine's history.
  useEffect(() => {
    const l = loadLog(machine);
    const t = l?.date === today() ? l : null;
    setLast(l);
    setTodayLog(t);
    setSpeed(t?.speed ?? "");
    setIncline(t?.incline ?? "");
    setLevel(t?.level ?? targetLevelRef.current);
    setFinished(t !== null);
    firedRef.current = false;
  }, [machine]);

  // Edits made after finishing still update today's saved entry.
  function editField(key: "speed" | "incline" | "level", value: string) {
    ({ speed: setSpeed, incline: setIncline, level: setLevel })[key](value);
    if (todayLog) {
      const log = { ...todayLog, [key]: value };
      saveLog(machine, log);
      setTodayLog(log);
      setLast(log);
    }
  }

  function finish(elapsedMinutes: number) {
    if (firedRef.current) return;
    firedRef.current = true;
    const log: CardioLog = { date: today(), minutes: elapsedMinutes, speed, incline, level };
    saveLog(machine, log);
    setTodayLog(log);
    setLast(log);
    setEndAt(null);
    setPausedLeft(null);
    setFinished(true);
    onDone();
  }

  useEffect(() => {
    if (!timeUp) return;
    navigator.vibrate?.([400, 150, 400, 150, 400]);
    beep();
    finish(minutes);
    // finish() reads the latest inputs; only the moment time runs out matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp]);

  function start() {
    unlockAudio();
    firedRef.current = false;
    setFinished(false);
    setNow(Date.now());
    setEndAt(Date.now() + (pausedLeft ?? minutes * 60) * 1000);
    setPausedLeft(null);
  }

  function pause() {
    setPausedLeft(left);
    setEndAt(null);
  }

  function reset() {
    setEndAt(null);
    setPausedLeft(null);
    firedRef.current = false;
    setFinished(false);
  }

  function setMinutes(m: number) {
    const next = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, m));
    // While the clock runs, changing the target shifts the end time by the same amount.
    const delta = (next - minutes) * 60;
    if (running) setEndAt((e) => (e ?? Date.now()) + delta * 1000);
    else if (pausedLeft !== null) setPausedLeft(Math.max(MIN_MINUTES * 60, pausedLeft + delta));
    onChange({ ...plan, minutes: next });
  }

  const elapsedMinutes = Math.max(1, Math.round((minutes * 60 - left) / 60));
  const progress = minutes > 0 ? 1 - left / (minutes * 60) : 0;
  const lastText = last
    ? [
        `${last.minutes} min`,
        machine === "treadmill" && last.speed && `${last.speed} ${speedUnit}`,
        machine === "treadmill" && last.incline && `${last.incline}% incline`,
        machine === "stairmaster" && last.level && `level ${last.level}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div className="rounded-2xl border border-sky-400/30 bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-sky-300">
            {standalone ? "Cardio session" : `Cardio · ${position === "before" ? "before lifting" : "after lifting"}`}
          </p>
          <h3 className="text-lg font-semibold leading-tight">{MACHINE_LABEL[machine]}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-sky-400/15 px-2.5 py-1 text-xs font-semibold text-sky-300">
          {minutes} min{machine === "stairmaster" && plan.level ? ` · L${plan.level}` : ""}
        </span>
      </div>

      <Segmented
        label="Machine"
        value={machine}
        options={[
          ["treadmill", "Treadmill"],
          ["stairmaster", "StairMaster"],
        ]}
        disabled={started}
        onChange={(m) => onChange({ ...plan, machine: m as CardioMachine })}
      />

      <div className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Duration</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMinutes(m)}
              aria-pressed={minutes === m}
              className={`h-8 rounded-full px-2.5 text-sm font-semibold tabular-nums transition active:scale-95 ${
                minutes === m ? "bg-sky-400 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:text-zinc-100"
              }`}
            >
              {m}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <SmallButton label="One minute less" onClick={() => setMinutes(minutes - 1)} disabled={minutes <= MIN_MINUTES}>
              −
            </SmallButton>
            <SmallButton label="One minute more" onClick={() => setMinutes(minutes + 1)} disabled={minutes >= MAX_MINUTES}>
              +
            </SmallButton>
          </div>
        </div>
      </div>

      <div role="timer" aria-live="polite" className="mt-4 rounded-xl bg-zinc-950/60 p-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          {finished ? "Cardio done" : running ? "Time left" : started ? "Paused" : "Ready"}
        </p>
        <p className={`text-6xl font-bold tabular-nums leading-tight ${finished ? "text-sky-300" : ""}`}>
          {finished ? "✓" : formatClock(left)}
        </p>
        <div className="mx-auto mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-sky-400 transition-[width] duration-200"
            style={{ width: `${(finished ? 1 : progress) * 100}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {finished ? (
            <button type="button" onClick={reset} className={`${BTN} col-span-2 bg-zinc-800 text-zinc-100 hover:bg-zinc-700`}>
              Do it again
            </button>
          ) : running ? (
            <>
              <button type="button" onClick={pause} className={`${BTN} bg-sky-400 text-zinc-950 hover:bg-sky-300`}>
                Pause
              </button>
              <button type="button" onClick={() => finish(elapsedMinutes)} className={`${BTN} bg-zinc-800 text-zinc-100 hover:bg-zinc-700`}>
                Finish now
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={start} className={`${BTN} bg-sky-400 text-zinc-950 hover:bg-sky-300`}>
                {started ? "Resume" : "Start"}
              </button>
              {started ? (
                <button type="button" onClick={() => finish(elapsedMinutes)} className={`${BTN} bg-zinc-800 text-zinc-100 hover:bg-zinc-700`}>
                  Finish now
                </button>
              ) : (
                <button type="button" onClick={() => finish(minutes)} className={`${BTN} bg-zinc-800 text-zinc-300 hover:bg-zinc-700`}>
                  Mark done
                </button>
              )}
            </>
          )}
        </div>
        {started && !finished && (
          <button type="button" onClick={reset} className="mt-2 text-xs text-zinc-500 hover:text-zinc-300">
            Reset timer
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {machine === "treadmill" ? (
          <>
            <Field label={`Speed (${speedUnit})`} value={speed} onChange={(v) => editField("speed", v)} placeholder={last?.speed || "3.0"} />
            <Field label="Incline (%)" value={incline} onChange={(v) => editField("incline", v)} placeholder={last?.incline || "12"} />
          </>
        ) : (
          <Field label="Level" value={level} onChange={(v) => editField("level", v)} placeholder={last?.level || plan.level || "8"} className="col-span-2" />
        )}
      </div>
      {lastText && (
        <p className="mt-2 text-xs text-zinc-500">
          {todayLog ? "Logged today" : "Last time"}: {lastText}
        </p>
      )}

      {!standalone && (
        <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-3 text-sm">
          <button
            type="button"
            onClick={() => onChange({ ...plan, position: position === "before" ? "after" : "before" })}
            className="text-zinc-400 hover:text-zinc-100"
          >
            Move {position === "before" ? "after" : "before"} lifting
          </button>
          <button type="button" onClick={onRemove} className="text-zinc-500 hover:text-red-300">
            Remove cardio
          </button>
        </div>
      )}
    </div>
  );
}

const BTN = "h-11 rounded-xl text-sm font-semibold transition active:scale-95";

function Segmented({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-zinc-800 p-1">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          disabled={disabled && v !== value}
          aria-pressed={value === v}
          className={`h-9 rounded-lg text-sm font-semibold transition disabled:opacity-40 ${
            value === v ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-100"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function SmallButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-full bg-zinc-800 text-lg font-semibold text-zinc-200 transition hover:bg-zinc-700 active:scale-90 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
        className="mt-1 h-10 w-full rounded-lg bg-zinc-800 px-3 text-base tabular-nums text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-sky-400"
      />
    </label>
  );
}
