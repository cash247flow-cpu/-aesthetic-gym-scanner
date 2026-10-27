"use client";

import { useEffect, useState } from "react";
import type { SessionKey } from "@/lib/plan";
import { CHOICES, DAY_NAMES, type WeekPlan } from "@/lib/schedule";

/**
 * Today's planned session on the home screen. The day and saved week only exist in the
 * browser (the page is prerendered), so nothing renders until after mount.
 */
export function TodayCard({
  week,
  hasPhoto,
  photoInputId,
  onStart,
  onCardio,
  onEditWeek,
}: {
  week: WeekPlan;
  hasPhoto: boolean;
  photoInputId: string;
  onStart: (session: SessionKey) => void;
  onCardio: () => void;
  onEditWeek: () => void;
}) {
  const [day, setDay] = useState<number | null>(null);
  useEffect(() => setDay(new Date().getDay()), []);
  if (day === null) return <div className="mt-5 h-[9.5rem] rounded-2xl border border-zinc-900" aria-hidden />;

  const plan = week[day];
  const tomorrow = week[(day + 1) % 7];
  const rest = plan.choice === "rest";
  const sessionShort = CHOICES.find((c) => c.key === plan.choice)?.short;

  return (
    <div className={`mt-5 rounded-2xl border p-4 ${rest ? "border-sky-400/40 bg-sky-400/5" : "border-lime-400/40 bg-lime-400/5"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[11px] font-semibold uppercase tracking-wider ${rest ? "text-sky-300" : "text-lime-300"}`}>
            Today · {DAY_NAMES[day]}
          </p>
          <p className="mt-0.5 text-2xl font-bold leading-tight">{rest ? "Rest day" : plan.name}</p>
          {!rest && sessionShort !== plan.name && <p className="text-sm text-zinc-400">{sessionShort} session</p>}
        </div>
        <button type="button" onClick={onEditWeek} className="shrink-0 text-sm text-zinc-400 hover:text-zinc-100">
          Edit week
        </button>
      </div>

      <div className="mt-3">
        {rest ? (
          <button
            type="button"
            onClick={onCardio}
            className="h-12 w-full rounded-xl bg-sky-400 text-base font-semibold text-zinc-950 transition hover:bg-sky-300 active:scale-[0.98]"
          >
            Open Cardio Day
          </button>
        ) : hasPhoto ? (
          <button
            type="button"
            onClick={() => onStart(plan.choice as SessionKey)}
            className="h-12 w-full rounded-xl bg-lime-400 text-base font-semibold text-zinc-950 transition hover:bg-lime-300 active:scale-[0.98]"
          >
            Start {plan.name}
          </button>
        ) : (
          <label
            htmlFor={photoInputId}
            className="flex h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-lime-400 text-base font-semibold text-zinc-950 transition hover:bg-lime-300 active:scale-[0.98]"
          >
            📷 Snap the gym to start
          </label>
        )}
      </div>

      <p className="mt-2 text-xs text-zinc-500">
        Tomorrow: {tomorrow.choice === "rest" ? "Rest" : tomorrow.name}
      </p>
    </div>
  );
}
