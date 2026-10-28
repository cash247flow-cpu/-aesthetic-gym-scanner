// Review periods: 7 days starting on the user's chosen review day (default Sunday, matching the
// rest of the app's weeks).

import { addDays } from "@/lib/habits";

export type Period = { start: string; end: string };

const dow = (date: string) => new Date(date + "T12:00").getDay();

export function periodFor(date: string, startDay: number): Period {
  const start = addDays(date, -((dow(date) - startDay + 7) % 7));
  return { start, end: addDays(start, 6) };
}

export const previousPeriod = (p: Period): Period => ({ start: addDays(p.start, -7), end: addDays(p.start, -1) });

/** The latest period that has fully ended before `today`. */
export const lastCompleted = (today: string, startDay: number) => previousPeriod(periodFor(today, startDay));

export const inPeriod = (date: string, p: Period) => date >= p.start && date <= p.end;

export function periodLabel(p: Period) {
  const f = (d: string, withYear = false) =>
    new Date(d + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });
  return `${f(p.start)} – ${f(p.end, true)}`;
}
