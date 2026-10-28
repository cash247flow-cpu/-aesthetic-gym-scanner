// Which numbers can go on a Weekly Wins card. Only metrics backed by records this week are
// offered; nothing missing is shown as a zero. Body numbers are opt-in (off by default).

import type { WeekMetrics } from "@/lib/review/metrics";

export type WinKey = "workouts" | "prs" | "habits" | "cardio" | "volume" | "weight" | "waist" | "bodyfat";
export type WinMetric = { key: WinKey; value: string; label: string; sub?: string; body?: boolean };

const pct = (r: number) => `${Math.round(r * 100)}%`;
const n = (x: number) => x.toLocaleString("en-US");

export function winCandidates(m: WeekMetrics, unit: "lb" | "kg"): WinMetric[] {
  const out: WinMetric[] = [];
  const w = m.workouts;
  if (w.rate != null && w.scheduled) out.push({ key: "workouts", value: `${w.completed}/${w.scheduled}`, label: "Workouts completed", sub: pct(w.rate) + " of plan" });
  else if (w.sessions) out.push({ key: "workouts", value: String(w.sessions), label: w.sessions === 1 ? "Workout logged" : "Workouts logged" });
  if (m.strength.prs.length) {
    const names = [...new Set(m.strength.prs.map((p) => p.exerciseName).filter(Boolean))] as string[];
    out.push({ key: "prs", value: String(m.strength.prs.length), label: m.strength.prs.length === 1 ? "Personal record" : "Personal records", sub: names.slice(0, 2).join(" · ") || undefined });
  }
  if (m.habits.rate != null && m.habits.done > 0)
    out.push({ key: "habits", value: pct(m.habits.rate), label: "Habits completed", sub: m.habits.perfectDays ? `${m.habits.perfectDays} perfect day${m.habits.perfectDays === 1 ? "" : "s"}` : undefined });
  if (m.cardio.minutes > 0)
    out.push({ key: "cardio", value: n(m.cardio.minutes), label: "Cardio minutes", sub: m.cardio.steps ? `${n(m.cardio.steps)} steps` : undefined });
  if (w.volumeLb > 0) {
    const v = unit === "kg" ? Math.round(w.volumeLb / 2.20462) : w.volumeLb;
    out.push({ key: "volume", value: n(v), label: `${unit} lifted`, sub: `${w.sets} sets` });
  }
  if (m.body.avgChangeLb != null) {
    const c = unit === "kg" ? Math.round((m.body.avgChangeLb / 2.20462) * 10) / 10 : m.body.avgChangeLb;
    out.push({ key: "weight", value: `${c > 0 ? "+" : c < 0 ? "−" : ""}${Math.abs(c)} ${unit}`, label: "Weekly average", sub: "vs last week", body: true });
  }
  if (m.body.waist) {
    const c = unit === "kg" ? Math.round(m.body.waist.change * 2.54 * 10) / 10 : m.body.waist.change;
    out.push({ key: "waist", value: `${c > 0 ? "+" : c < 0 ? "−" : ""}${Math.abs(c)} ${unit === "kg" ? "cm" : "in"}`, label: "Waist", sub: "across the week", body: true });
  }
  if (m.body.bodyFat)
    out.push({ key: "bodyfat", value: `${m.body.bodyFat.change > 0 ? "+" : m.body.bodyFat.change < 0 ? "−" : ""}${Math.abs(m.body.bodyFat.change)} pts`, label: "Body fat", sub: "scale estimate", body: true });
  return out;
}

/** Default selection: up to four, achievements first, body numbers only if the user adds them. */
export const defaultWins = (c: WinMetric[]): WinKey[] => c.filter((x) => !x.body).slice(0, 4).map((x) => x.key);
