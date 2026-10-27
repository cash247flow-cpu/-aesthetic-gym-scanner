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
  onStart: (session: SessionKey, withAbs: boolean) => void;
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
  // Legs already includes abs; other days only when "+Abs" is set.
  const extraAbs = plan.choice !== "legs" && !!plan.abs;
  const startLabel = (name: string) => (hasPhoto ? `Start ${name}` : "📷 Snap the gym to start");
  const primary = "flex h-12 w-full items-center justify-center rounded-xl text-base font-semibold transition active:scale-[0.98]";

  return (
    <div className={`mt-5 rounded-2xl border p-4 ${rest ? "border-sky-400/40 bg-sky-400/5" : "border-lime-400/40 bg-lime-400/5"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[11px] font-semibold uppercase tracking-wider ${rest ? "text-sky-300" : "text-lime-300"}`}>
            Today · {DAY_NAMES[day]}
          </p>
          <p className="mt-0.5 text-2xl font-bold leading-tight">
            {rest ? "Rest day" : plan.name}
            {(extraAbs || plan.choice === "legs") && (
              <span className="ml-2 align-middle rounded-full bg-rose-400/15 px-2 py-0.5 text-xs font-semibold text-rose-200">+ Abs</span>
            )}
          </p>
          {!rest && sessionShort !== plan.name && <p className="text-sm text-zinc-400">{sessionShort} session</p>}
        </div>
        <button type="button" onClick={onEditWeek} className="shrink-0 text-sm text-zinc-400 hover:text-zinc-100">
          Edit week
        </button>
      </div>

      <div className="mt-3 grid gap-2">
        {rest ? (
          <button type="button" onClick={onCardio} className={`${primary} bg-sky-400 text-zinc-950 hover:bg-sky-300`}>
            Open Cardio Day
          </button>
        ) : (
          <StartButton
            hasPhoto={hasPhoto}
            photoInputId={photoInputId}
            className={`${primary} bg-lime-400 text-zinc-950 hover:bg-lime-300`}
            onClick={() => onStart(plan.choice as SessionKey, extraAbs)}
          >
            {startLabel(plan.name)}
          </StartButton>
        )}
        {rest && plan.abs && (
          <StartButton
            hasPhoto={hasPhoto}
            photoInputId={photoInputId}
            className={`${primary} border border-rose-400/60 text-rose-200 hover:bg-rose-400/10`}
            onClick={() => onStart("abs", false)}
          >
            {hasPhoto ? "Start Abs" : "📷 Snap the gym for abs"}
          </StartButton>
        )}
      </div>

      <p className="mt-2 text-xs text-zinc-500">
        Tomorrow: {tomorrow.choice === "rest" ? "Rest" : tomorrow.name}
        {tomorrow.choice !== "legs" && tomorrow.abs ? " + Abs" : ""}
      </p>
    </div>
  );
}

/** A photo is needed to plan around the gym's equipment, so without one this opens the camera. */
function StartButton({
  hasPhoto,
  photoInputId,
  className,
  onClick,
  children,
}: {
  hasPhoto: boolean;
  photoInputId: string;
  className: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return hasPhoto ? (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ) : (
    <label htmlFor={photoInputId} className={`${className} cursor-pointer`}>
      {children}
    </label>
  );
}
