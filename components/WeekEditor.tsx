"use client";

import {
  CHOICES,
  DAY_NAMES,
  MAX_AB_DAYS,
  WEEK_ORDER,
  abDayCount,
  abWarnings,
  canAddAbs,
  isDefaultWeek,
  withAbs,
  withChoice,
  type WeekPlan,
} from "@/lib/schedule";

/** Weekly split editor: pick Push / Pull / Legs / Pump / Rest for each day. */
export function WeekEditor({
  week,
  onChange,
  onBack,
}: {
  week: WeekPlan;
  onChange: (week: WeekPlan | null) => void;
  onBack: () => void;
}) {
  const today = new Date().getDay();
  const abDays = abDayCount(week);
  const warnings = abWarnings(week);

  return (
    <section className="mt-2">
      <h1 className="text-3xl font-bold tracking-tight">Your week</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Pick what each day is for. Rest days open Cardio Day. Changes save automatically.
      </p>

      <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/5 px-3.5 py-2.5 text-sm">
        <p className="font-semibold text-rose-200">
          Ab days: {abDays} of {MAX_AB_DAYS}
          <span className="font-normal text-zinc-400"> · keep a day off between</span>
        </p>
        <p className="mt-0.5 text-xs text-zinc-400">Legs days include abs. Tap “+ Abs” to add them to another day.</p>
        {warnings.map((w) => (
          <p key={w} className="mt-1 text-xs font-semibold text-amber-300">
            ⚠ {w}
          </p>
        ))}
      </div>

      <ol className="mt-5 grid grid-cols-1 gap-2">
        {WEEK_ORDER.map((day) => {
          const plan = week[day];
          const absAllowed = canAddAbs(week, day);
          return (
            <li
              key={day}
              className={`rounded-2xl border bg-zinc-900 p-3 ${day === today ? "border-lime-400/60" : "border-zinc-800"}`}
            >
              <div className="flex items-baseline justify-between gap-2 px-1">
                <p className="font-semibold">
                  {DAY_NAMES[day]}
                  {day === today && <span className="ml-2 text-xs font-semibold text-lime-300">Today</span>}
                </p>
                <p className="truncate text-xs text-zinc-400">{plan.name}</p>
              </div>
              <div role="group" aria-label={`${DAY_NAMES[day]} session`} className="mt-2 grid grid-cols-5 gap-1">
                {CHOICES.map((c) => {
                  const on = plan.choice === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => onChange(withChoice(week, day, c.key))}
                      aria-pressed={on}
                      className={`h-9 rounded-lg text-xs font-semibold transition active:scale-95 ${
                        on
                          ? c.key === "rest"
                            ? "bg-sky-400 text-zinc-950"
                            : "bg-lime-400 text-zinc-950"
                          : "bg-zinc-800 text-zinc-400 hover:text-zinc-100"
                      }`}
                    >
                      {c.short}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center gap-2 px-1">
                {plan.choice === "legs" ? (
                  <span className="rounded-full bg-rose-400/15 px-2.5 py-1 text-xs font-semibold text-rose-200">Abs included</span>
                ) : plan.abs ? (
                  <button
                    type="button"
                    onClick={() => onChange(withAbs(week, day, false))}
                    aria-pressed="true"
                    className="rounded-full bg-rose-400 px-2.5 py-1 text-xs font-semibold text-zinc-950 transition active:scale-95"
                  >
                    ✓ Abs
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onChange(withAbs(week, day, true))}
                      disabled={!absAllowed.ok}
                      aria-pressed="false"
                      className="rounded-full border border-rose-400/50 px-2.5 py-1 text-xs font-semibold text-rose-200 transition active:scale-95 disabled:border-zinc-800 disabled:text-zinc-600"
                    >
                      + Abs
                    </button>
                    {!absAllowed.ok && <span className="truncate text-[11px] text-zinc-500">{absAllowed.reason}</span>}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-xs text-zinc-500">
        Pump = chest from Push + rear delts and biceps from Pull.
      </p>

      {!isDefaultWeek(week) && (
        <button
          type="button"
          onClick={() => window.confirm("Reset every day back to your training plan?") && onChange(null)}
          className="mt-4 text-sm text-zinc-400 hover:text-zinc-100"
        >
          Reset to my training plan
        </button>
      )}

      <button
        type="button"
        onClick={onBack}
        className="mt-6 h-12 w-full rounded-xl bg-zinc-800 text-base font-semibold text-zinc-100 transition hover:bg-zinc-700 active:scale-[0.98]"
      >
        Done
      </button>
    </section>
  );
}
