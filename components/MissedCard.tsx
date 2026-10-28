"use client";

import { useEffect, useState } from "react";
import { dayName, missedThisWeek, skipMissed, weekStatus, type DayItem } from "@/lib/missed";

const KIND: Record<DayItem["kind"], string> = { lift: "Workout", abs: "Abs", forearms: "Forearms", cardio: "Cardio" };

/**
 * Missed workouts, abs and cardio from earlier this week (Sunday–Saturday), each with
 * "Make it up" or "Skip". A new week starts clean. Browser-only data, so it renders after mount.
 */
export function MissedCard({ onMakeUp }: { onMakeUp: (item: DayItem) => void }) {
  const [items, setItems] = useState<DayItem[] | null>(null);
  const refresh = () => setItems(missedThisWeek(weekStatus()));
  useEffect(refresh, []);

  if (!items?.length) return null;

  function skip(item: DayItem) {
    if (!window.confirm(`Skip ${dayName(item.date)}'s ${item.label}? It stays recorded as missed.`)) return;
    skipMissed(item.key);
    refresh();
  }

  return (
    <section aria-label="Missed this week" className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-400/5 p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">Missed this week</p>
      <ul className="mt-2 grid grid-cols-1 gap-2">
        {items.map((it) => (
          <li key={it.key} className="rounded-xl bg-zinc-900 px-3 py-2.5">
            <p className="font-semibold leading-snug">
              {dayName(it.date)} · {it.label}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="flex-1 text-xs text-zinc-400">{KIND[it.kind]} missed</span>
              <button
                type="button"
                onClick={() => skip(it)}
                className="shrink-0 px-2 text-xs font-semibold text-zinc-500 hover:text-zinc-300"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => onMakeUp(it)}
                className="h-9 shrink-0 rounded-full bg-gradient-to-r from-lime-400 to-emerald-300 px-3.5 text-sm font-semibold text-zinc-950 transition active:scale-95"
              >
                Make it up
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-zinc-500">Make-ups count until Saturday. Each week starts fresh on Sunday.</p>
    </section>
  );
}
