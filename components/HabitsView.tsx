"use client";

import { useState } from "react";
import {
  HABITS,
  addDays,
  bestPerfectStreak,
  doneCount,
  isDone,
  loadHabitLogs,
  saveHabitLogs,
  streak,
  todayStr,
  type DayLog,
  type Habit,
} from "@/lib/habits";
import { SleepHelper } from "@/components/SleepHelper";
import { formatClockTime, loadSleep, sleepTimes } from "@/lib/sleep";
import { AccentLast, TITLE } from "@/components/ui";

// Logging is allowed for the past week (Sleep Lock is easiest to tick the next morning).
const BACKFILL_DAYS = 6;

const dayLabel = (date: string, today: string) =>
  date === today
    ? "Today"
    : date === addDays(today, -1)
      ? "Yesterday"
      : new Date(date + "T12:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

export function HabitsView({ onBack }: { onBack: () => void }) {
  const [today] = useState(todayStr);
  const [date, setDate] = useState(today);
  const [logs, setLogs] = useState(loadHabitLogs);
  const [sleep, setSleep] = useState(loadSleep);
  const [editingSleep, setEditingSleep] = useState(false);
  const log = logs[date] ?? {};
  const done = doneCount(log);
  const perfect = streak(logs, "all", today);
  const best = bestPerfectStreak(logs);
  const week = Array.from({ length: 7 }, (_, i) => addDays(date, i - 6));

  if (editingSleep) {
    return (
      <SleepHelper
        settings={sleep}
        onChange={setSleep}
        onBack={() => {
          setEditingSleep(false);
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  const tonight = sleepTimes(sleep);

  function update(patch: DayLog) {
    const next = { ...logs, [date]: { ...log, ...patch } };
    setLogs(next);
    saveHabitLogs(next);
  }

  return (
    <section className="mt-2">
      <h1 className={TITLE}><AccentLast text="Daily habits" /></h1>
      <p className="mt-1 text-sm text-zinc-400">
        {perfect > 0 ? `🔥 ${perfect}-day perfect streak` : "Do all five for a perfect day"}
        {best > perfect ? ` · best ${best}` : ""}
      </p>

      <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-2">
        <NavButton dir="prev" disabled={date <= addDays(today, -BACKFILL_DAYS)} onClick={() => setDate(addDays(date, -1))} />
        <div className="text-center">
          <p className="font-semibold">{dayLabel(date, today)}</p>
          <p className="text-xs text-zinc-400 tabular-nums">
            {done} of {HABITS.length} done
          </p>
        </div>
        <NavButton dir="next" disabled={date >= today} onClick={() => setDate(addDays(date, 1))} />
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-lime-400 transition-[width]" style={{ width: `${(done / HABITS.length) * 100}%` }} />
      </div>
      {done === HABITS.length && (
        <p className="mt-3 rounded-xl border border-lime-400/40 bg-lime-400/10 px-3 py-2 text-center text-sm font-semibold text-lime-200">
          Perfect day 🔥 All five habits done.
        </p>
      )}

      <ul className="mt-4 grid grid-cols-1 gap-3">
        {HABITS.map((h) => (
          <HabitCard
            key={h.id}
            habit={h}
            log={log}
            streakDays={streak(logs, h, today)}
            history={week.map((d) => ({ date: d, done: isDone(logs[d], h) }))}
            onChange={update}
            extra={
              h.id === "sleep" ? (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-indigo-400/10 px-3 py-2.5">
                  <p className="text-xs text-indigo-100">
                    Last meal by <b>{formatClockTime(tonight.lastMealLatest)}</b> · screens off{" "}
                    <b>{formatClockTime(tonight.screensOff)}</b> · in bed <b>{formatClockTime(tonight.inBed)}</b>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSleep(true);
                      window.scrollTo({ top: 0 });
                    }}
                    className="shrink-0 rounded-lg bg-indigo-400 px-2.5 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-indigo-300"
                  >
                    ⏰ Times
                  </button>
                </div>
              ) : null
            }
          />
        ))}
      </ul>

      <button
        type="button"
        onClick={onBack}
        className="mt-6 h-12 w-full rounded-xl bg-zinc-800 text-base font-semibold text-zinc-100 transition hover:bg-zinc-700 active:scale-[0.98]"
      >
        Back
      </button>
    </section>
  );
}

function HabitCard({
  habit,
  log,
  streakDays,
  history,
  onChange,
  extra,
}: {
  habit: Habit;
  log: DayLog;
  streakDays: number;
  history: { date: string; done: boolean }[];
  onChange: (patch: DayLog) => void;
  extra?: React.ReactNode;
}) {
  const done = isDone(log, habit);

  return (
    <li className={`rounded-2xl border bg-zinc-900 p-4 transition ${done ? "border-lime-400/50" : "border-zinc-800"}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">
          <span aria-hidden className="mr-1.5">
            {habit.emoji}
          </span>
          {habit.title}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
            streakDays > 0 ? "bg-amber-400/15 text-amber-300" : "bg-zinc-800 text-zinc-500"
          }`}
          aria-label={`${streakDays}-day streak`}
        >
          🔥 {streakDays}
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-400">{habit.what}</p>
      {extra}

      <div className="mt-3">
        {habit.kind === "check" && (
          <button
            type="button"
            onClick={() => onChange({ [habit.id]: !done })}
            aria-pressed={done}
            className={`h-11 w-full rounded-xl text-sm font-semibold transition active:scale-[0.98] ${
              done ? "bg-lime-400 text-zinc-950" : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            }`}
          >
            {done ? `✓ ${habit.action}` : habit.action}
          </button>
        )}

        {habit.kind === "count" && (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: habit.target }, (_, i) => {
              const count = (log[habit.id] as number | undefined) ?? 0;
              const on = i < count;
              return (
                <button
                  key={i}
                  type="button"
                  // Tapping the last ticked meal unticks it; any other tap fills up to that meal.
                  onClick={() => onChange({ [habit.id]: count === i + 1 ? i : i + 1 })}
                  aria-pressed={on}
                  aria-label={`${habit.title}: ${habit.unitLabel.toLowerCase()} ${i + 1}`}
                  className={`h-11 rounded-xl text-sm font-semibold transition active:scale-95 ${
                    on ? "bg-lime-400 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  {on ? "✓ " : ""}
                  {habit.unitLabel} {i + 1}
                </button>
              );
            })}
          </div>
        )}

        {habit.kind === "steps" && (
          <ul className="grid gap-1.5">
            {habit.steps.map((step, i) => {
              const steps = (log[habit.id] as boolean[] | undefined) ?? [];
              const on = !!steps[i];
              return (
                <li key={step}>
                  <button
                    type="button"
                    onClick={() => onChange({ [habit.id]: habit.steps.map((_, j) => (j === i ? !on : !!steps[j])) })}
                    aria-pressed={on}
                    className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition active:scale-[0.99] ${
                      on ? "bg-lime-400/15 text-lime-100" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    }`}
                  >
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-md text-xs font-bold ${
                        on ? "bg-lime-400 text-zinc-950" : "border border-zinc-600"
                      }`}
                    >
                      {on ? "✓" : ""}
                    </span>
                    {step}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-3 flex items-center gap-1.5" aria-label="Last 7 days">
        {history.map((h) => (
          <span
            key={h.date}
            title={h.date}
            className={`h-1.5 flex-1 rounded-full ${h.done ? "bg-lime-400" : "bg-zinc-800"}`}
          />
        ))}
      </div>
    </li>
  );
}

function NavButton({ dir, disabled, onClick }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Previous day" : "Next day"}
      className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-800 text-zinc-200 transition hover:bg-zinc-700 active:scale-90 disabled:opacity-30"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path d={dir === "prev" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
      </svg>
    </button>
  );
}
