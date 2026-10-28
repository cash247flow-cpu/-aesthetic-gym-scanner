"use client";

import { useEffect, useState } from "react";
import type { SessionKey } from "@/lib/plan";
import { CHOICES, DAY_NAMES, type WeekPlan } from "@/lib/schedule";
import { ArrowCircle } from "@/components/ui";

/**
 * Today's planned session on the home screen, as a gradient bar. The day and saved week only
 * exist in the browser (the page is prerendered), so nothing renders until after mount.
 * Starting without a gym photo opens the camera first (handled by onStart).
 */
export function TodayCard({
  week,
  hasPhoto,
  onStart,
  onCardio,
  onEditWeek,
}: {
  week: WeekPlan;
  hasPhoto: boolean;
  onStart: (session: SessionKey, withAbs: boolean) => void;
  onCardio: () => void;
  onEditWeek: () => void;
}) {
  const [day, setDay] = useState<number | null>(null);
  useEffect(() => setDay(new Date().getDay()), []);
  if (day === null) return <div className="mt-5 h-[6.5rem]" aria-hidden />;

  const plan = week[day];
  const tomorrow = week[(day + 1) % 7];
  const rest = plan.choice === "rest";
  const sessionShort = CHOICES.find((c) => c.key === plan.choice)?.short;
  // Legs already includes abs; other days only when "+Abs" is set.
  const extraAbs = plan.choice !== "legs" && !!plan.abs;
  const withAbsTag = extraAbs || plan.choice === "legs";

  return (
    <section className="mt-5" aria-label="Today">
      <button
        type="button"
        onClick={rest ? onCardio : () => onStart(plan.choice as SessionKey, extraAbs)}
        className={`flex w-full items-center gap-3 rounded-full p-1.5 text-left text-zinc-950 shadow-[0_0_28px_-8px_rgba(198,244,50,0.6)] transition active:scale-[0.98] ${
          rest ? "bg-gradient-to-r from-sky-300 to-teal-300" : "bg-gradient-to-r from-lime-400 to-emerald-300"
        }`}
      >
        <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-zinc-950 text-xl">
          {rest ? "🏃" : "🏋️"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-800">
            Today · {DAY_NAMES[day]}
          </span>
          <span className="block truncate text-lg font-bold leading-tight">
            {rest ? "Rest day · Cardio" : plan.name}
            {withAbsTag && !rest && <span className="ml-1.5 text-sm font-semibold text-zinc-800">+ Abs</span>}
          </span>
          <span className="block truncate text-xs text-zinc-800">
            {rest
              ? "Tap to open Cardio Day"
              : hasPhoto
                ? `Start ${sessionShort !== plan.name ? `${sessionShort} session` : "workout"}`
                : "Tap to scan the gym and start"}
          </span>
        </span>
        <ArrowCircle />
      </button>

      {rest && plan.abs && (
        <button
          type="button"
          onClick={() => onStart("abs", false)}
          className="mt-2 h-11 w-full rounded-full border border-rose-400/60 text-sm font-semibold text-rose-200 transition hover:bg-rose-400/10 active:scale-[0.98]"
        >
          {hasPhoto ? "Start Abs" : "📷 Scan the gym for abs"}
        </button>
      )}

      {rest && plan.forearms && (
        <button
          type="button"
          onClick={() => onStart("forearms", false)}
          className="mt-2 h-11 w-full rounded-full border border-amber-300/60 text-sm font-semibold text-amber-200 transition hover:bg-amber-300/10 active:scale-[0.98]"
        >
          {hasPhoto ? "Start Forearms" : "📷 Scan the gym for forearms"}
        </button>
      )}

      <div className="mt-2 flex items-center justify-between px-2 text-xs text-zinc-500">
        <span>
          Tomorrow: {tomorrow.choice === "rest" ? "Rest" : tomorrow.name}
          {tomorrow.choice !== "legs" && tomorrow.abs ? " + Abs" : ""}
          {tomorrow.forearms ? " + Forearms" : ""}
        </span>
        <button type="button" onClick={onEditWeek} className="font-semibold text-zinc-400 hover:text-zinc-100">
          Edit week
        </button>
      </div>
    </section>
  );
}
