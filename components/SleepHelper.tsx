"use client";

import { formatClockTime, saveSleep, SLEEP_OPTIONS, sleepTimes, type SleepSettings } from "@/lib/sleep";
import { AccentLast, TITLE } from "@/components/ui";

/** Pick a wake time and sleep goal; shows tonight's Sleep Lock timeline. */
export function SleepHelper({
  settings,
  onChange,
  onBack,
}: {
  settings: SleepSettings;
  onChange: (s: SleepSettings) => void;
  onBack: () => void;
}) {
  const t = sleepTimes(settings);

  function update(next: SleepSettings) {
    onChange(next);
    saveSleep(next);
  }

  const timeline = [
    { icon: "🍽️", label: "Last meal", time: `${formatClockTime(t.lastMealEarliest)} – ${formatClockTime(t.lastMealLatest)}`, note: "Stop eating 2–3 h before bed so you can drop into deep sleep." },
    { icon: "📵", label: "Screens off", time: formatClockTime(t.screensOff), note: "Start winding down — phone light tells your brain it's still day." },
    { icon: "🛏️", label: "In bed", time: formatClockTime(t.inBed), note: `${t.inBedHours} h in bed for ${settings.sleepHours} h of sleep.` },
    { icon: "😴", label: "Asleep by about", time: formatClockTime(t.asleepBy), note: "Allowing an hour to fall asleep." },
    { icon: "⏰", label: "Wake", time: formatClockTime(t.wake), note: "Same time every day — weekends too." },
  ];

  return (
    <section className="mt-2">
      <h1 className={TITLE}><AccentLast text="Sleep times" /></h1>
      <p className="mt-1 text-sm text-zinc-400">Set when you wake and how much sleep you want. Same times every day.</p>

      <div className="mt-5 grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Wake up at</span>
          <input
            type="time"
            value={settings.wake}
            onChange={(e) => e.target.value && update({ ...settings, wake: e.target.value })}
            className="mt-1 h-12 w-full rounded-xl bg-zinc-800 px-3 text-lg font-semibold tabular-nums text-zinc-100 [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </label>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Hours of sleep you want</p>
          <div role="group" aria-label="Hours of sleep" className="mt-1 grid grid-cols-5 gap-1 rounded-xl bg-zinc-800 p-1">
            {SLEEP_OPTIONS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => update({ ...settings, sleepHours: h })}
                aria-pressed={settings.sleepHours === h}
                className={`h-10 rounded-lg text-sm font-semibold tabular-nums transition ${
                  settings.sleepHours === h ? "bg-indigo-400 text-zinc-950" : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      </div>

      <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-zinc-500">Tonight</h2>
      <ol className="mt-2 grid grid-cols-1 gap-2">
        {timeline.map((step) => (
          <li key={step.label} className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
            <span className="text-xl" aria-hidden>
              {step.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold">{step.label}</p>
                <p className="shrink-0 text-right font-bold tabular-nums text-indigo-200">{step.time}</p>
              </div>
              <p className="mt-0.5 text-xs text-zinc-500">{step.note}</p>
            </div>
          </li>
        ))}
      </ol>

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
