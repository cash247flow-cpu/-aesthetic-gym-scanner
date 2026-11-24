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
  ANTAGONIST_WEEK,
  isAntagonistWeek,
  withAbs,
  withForearms,
  withChoice,
  type WeekPlan,
} from "@/lib/schedule";
import { AccentLast, TITLE } from "@/components/ui";
import { saveSuperset } from "@/lib/superset";

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
      <h1 className={TITLE}><AccentLast text="Your week" /></h1>
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
              <div role="group" aria-label={`${DAY_NAMES[day]} session`} className="mt-2 grid grid-cols-4 gap-1">
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
                {plan.choice === "rest" && (
                  <button
                    type="button"
                    onClick={() => onChange(withForearms(week, day, !plan.forearms))}
                    aria-pressed={!!plan.forearms}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold transition active:scale-95 ${
                      plan.forearms ? "bg-amber-300 text-zinc-950" : "border border-amber-300/50 text-amber-200"
                    }`}
                  >
                    {plan.forearms ? "✓ Forearms" : "+ Forearms"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-xs text-zinc-500">
        Pump = chest from Push + rear delts and biceps from Pull. Pull ends with forearms; “+ Forearms” adds them to a rest day.
        Chest+Bis and Back+Tris are the Antagonist week&apos;s days, made from Push and Pull exercises.
      </p>

      <section aria-label="Antagonist week" className="mt-4 rounded-2xl border border-lime-400/30 bg-lime-400/5 p-3.5">
        <p className="font-semibold">🔁 Antagonist week</p>
        <p className="mt-1 text-xs text-zinc-300">
          Every day built for supersets: Mon &amp; Fri Chest + Biceps + Shoulders, Tue &amp; Sat Legs + Abs, Wed &amp; Sun Back +
          Triceps, Thursday off.
        </p>
        {isAntagonistWeek(week) ? (
          <p className="mt-2 text-xs font-semibold text-lime-300">You&apos;re on the Antagonist week. “Reset to my training plan” below switches back.</p>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (!window.confirm("Switch to the Antagonist week? This also turns supersets on. You can reset to your training plan any time.")) return;
              saveSuperset(true);
              onChange(ANTAGONIST_WEEK);
            }}
            className="mt-2 h-10 rounded-full bg-gradient-to-r from-lime-400 to-emerald-300 px-4 text-sm font-semibold text-zinc-950 transition active:scale-95"
          >
            Use the Antagonist week
          </button>
        )}
      </section>

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
