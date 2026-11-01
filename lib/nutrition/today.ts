// Browser-side glue: today's confirmed targets, intake and what's left, from the existing
// records (meal plan targets and ticks, Cronometer imports) plus the coach's own log.

import { MEALS, loadEaten, loadPhase, loadTargets, type MealPhase } from "@/lib/meals";
import { applyEdits, loadMealEdits } from "@/lib/mealEdits";
import { loadCronometer } from "@/lib/cronometer";
import { confirmedTarget, hasCustomTargets, loadConfirmed, type DayTarget } from "./targets";
import { loadLog, remainingOf, todayIntake, type Intake, type Remaining } from "./log";
import { localDate } from "./store";

export type Today = { date: string; phase: MealPhase; target: DayTarget | null; defaults: DayTarget; intake: Intake; remaining: Remaining | null };

export function readToday(now = new Date()): Today {
  const date = localDate(now);
  const phase = loadPhase();
  const targets = loadTargets();
  const target = confirmedTarget(phase, targets, loadConfirmed(), hasCustomTargets());
  const defaults = confirmedTarget(phase, targets, { [phase]: 1 }, false)!;
  const eaten = loadEaten()[date] ?? {};
  const meals = applyEdits(phase, MEALS[phase], loadMealEdits());
  const cron = loadCronometer().find((d) => d.date === date) ?? null;
  const intake = todayIntake({
    date,
    log: loadLog(),
    cronometerToday: cron,
    planMealsEaten: meals.filter((m) => eaten[m.id]).map((m) => ({ title: m.title, nutrition: m.nutrition ?? null })),
  });
  return { date, phase, target, defaults, intake, remaining: target ? remainingOf(target, intake.totals) : null };
}
