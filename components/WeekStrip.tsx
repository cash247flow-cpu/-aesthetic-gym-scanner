"use client";

import { useEffect, useState } from "react";
import { HABITS, doneCount, loadHabitLogs, todayStr } from "@/lib/habits";
import { weekStatus } from "@/lib/missed";

type Day = { date: string; letter: string; num: number; trained: boolean; missed: boolean; madeUp: boolean; habits: number };

/**
 * This week, Sunday to Saturday: a lime dot over days you trained, an amber dot over days with
 * a missed workout or cardio, a dashed ring on days you made up later, and a bar under each
 * day that fills in as you tick off habits. Browser-only data, so it renders after mount.
 */
export function WeekStrip() {
  const [days, setDays] = useState<Day[] | null>(null);
  const [today, setToday] = useState("");

  useEffect(() => {
    const t = todayStr();
    const logs = loadHabitLogs();
    setToday(t);
    setDays(
      weekStatus(t).map(({ date, items, trained }) => {
        const d = new Date(date + "T12:00");
        return {
          date,
          letter: d.toLocaleDateString(undefined, { weekday: "narrow" }),
          num: d.getDate(),
          trained,
          missed: items.some((i) => i.status === "missed" || i.status === "skipped"),
          madeUp: items.some((i) => i.status === "madeUp"),
          habits: doneCount(logs[date]) / HABITS.length,
        };
      }),
    );
  }, []);

  if (!days) return <div className="mt-5 h-[5.25rem]" aria-hidden />;
  const month = new Date(today + "T12:00").toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <section className="mt-5" aria-label="This week">
      <p className="text-center text-sm font-semibold text-zinc-300">{month}</p>
      <ol className="mt-2 grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const isToday = d.date === today;
          const future = d.date > today;
          return (
            <li
              key={d.date}
              aria-label={`${d.date}${d.trained ? ", trained" : ""}${d.missed ? ", missed" : ""}${d.madeUp ? ", made up" : ""}, habits ${Math.round(d.habits * HABITS.length)}/${HABITS.length}`}
              className={`relative flex flex-col items-center rounded-full border py-2 ${
                isToday
                  ? "border-lime-400 bg-lime-400/10"
                  : d.madeUp
                    ? "border-dashed border-lime-400/70 bg-zinc-900/60"
                    : "border-zinc-800 bg-zinc-900/60"
              } ${future ? "opacity-50" : ""}`}
            >
              <span
                aria-hidden
                className={`absolute -top-1 h-2 w-2 rounded-full ${
                  d.missed
                    ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]"
                    : d.trained
                      ? "bg-lime-400 shadow-[0_0_6px_rgba(198,244,50,0.8)]"
                      : "bg-transparent"
                }`}
              />
              <span className="text-[11px] text-zinc-400">{d.letter}</span>
              <span className={`text-sm font-semibold tabular-nums ${isToday ? "text-lime-300" : "text-zinc-100"}`}>
                {String(d.num).padStart(2, "0")}
              </span>
              <span aria-hidden className="mt-1 h-1 w-5 overflow-hidden rounded-full bg-zinc-800">
                <span className="block h-full rounded-full bg-lime-400" style={{ width: `${d.habits * 100}%` }} />
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-1.5 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
        <span>
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-lime-400 align-middle" />
          Trained
        </span>
        <span>
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle" />
          Missed
        </span>
        <span>
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full border border-dashed border-lime-400 align-middle" />
          Made up
        </span>
        <span>
          <span className="mr-1 inline-block h-1 w-3 rounded-full bg-lime-400 align-middle" />
          Habits
        </span>
      </p>
    </section>
  );
}
