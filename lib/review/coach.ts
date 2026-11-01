// Adaptive Weekly Coach — transparent rules, no AI and no automatic plan changes.
// Data (metrics.ts) → trend (weekly averages) → decision (rules below, tuned in config.ts) →
// explanation (plain sentences) → feedback (the user says whether last week's focus helped).
// It never diagnoses; pain, very low energy or unusually fast weight loss point to a professional.

import type { BodyEntry, BodyGoal } from "@/lib/bodyLog";
import { COACH } from "@/lib/review/config";
import type { WeekMetrics } from "@/lib/review/metrics";
import { addDays } from "@/lib/habits";

export type Status = "insufficient" | "progress" | "normal-variation" | "possible-plateau" | "maintaining";
export type FocusKind = "continue" | "measure" | "adherence" | "recovery" | "review-targets" | "professional";
export type Focus = { id: string; kind: FocusKind; text: string; why: string };
export type CheckIn = { energy?: 1 | 2 | 3 | 4 | 5; pain?: boolean };
export type CoachResult = {
  status: Status;
  shows: string[]; // WHAT THE DATA SHOWS
  /** What this week's data can't tell (missing, stale or contradictory records). Older saved reviews lack it. */
  limits?: string[];
  means: string; // WHAT IT MAY MEAN
  next: Focus; // WHAT TO DO NEXT
  reviewAgain: string; // WHEN TO REVIEW AGAIN
  flags: string[]; // safety notes
  /** Plan changes that need the user's approval (never applied automatically). */
  proposal: { kind: "review-targets"; text: string } | null;
};

export const STATUS_LABEL: Record<Status, string> = {
  insufficient: "Not enough data yet",
  progress: "Progressing",
  "normal-variation": "Normal week-to-week variation",
  "possible-plateau": "Possible plateau — worth a closer look",
  maintaining: "Holding steady",
};

export type CoachInput = {
  week: WeekMetrics;
  /** Weekly average weights, newest first: [this week, last week, …] (null = too few weigh-ins). */
  averages: (number | null)[];
  /** Plan completion rates for earlier weeks, newest first (null = unknown). */
  earlierRates: (number | null)[];
  body: BodyEntry[];
  goal: BodyGoal | null;
  checkIn: CheckIn | null;
  unit: "lb" | "kg";
};

const fmtLb = (lb: number, unit: "lb" | "kg") =>
  unit === "kg" ? `${Math.round((lb / 2.20462) * 10) / 10} kg` : `${Math.round(lb * 10) / 10} lb`;
const pct = (r: number) => `${Math.round(r * 100)}%`;

/** Waist change (in) over the span covered by the trend weeks, from the earliest to latest measurement. */
function waistOver(body: BodyEntry[], from: string, to: string): number | null {
  const w = body.filter((e) => e.waistIn != null && e.date >= from && e.date <= to);
  if (w.length < 2 || w[0].date === w[w.length - 1].date) return null;
  return Math.round((w[w.length - 1].waistIn! - w[0].waistIn!) * 10) / 10;
}

/**
 * Data-quality notes: what the records can't support. Never fills a gap with an assumption —
 * a missing value is reported as missing, not as zero or "on track".
 */
export function dataLimits(input: CoachInput): string[] {
  const { week: m, averages, goal, body } = input;
  const out: string[] = [];
  if (m.body.weighIns < COACH.MIN_WEIGHINS)
    out.push(m.body.weighIns ? `Only ${m.body.weighIns} weigh-in this week — not enough for a weekly average.` : "No weigh-ins this week, so there's no weight trend for it.");
  else if (averages[1] == null) out.push("Last week had too few weigh-ins to compare with.");
  const latest = [...body].filter((e) => e.date <= m.period.end).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (latest) {
    const age = Math.round((new Date(m.period.end + "T12:00").getTime() - new Date(latest.date + "T12:00").getTime()) / 86_400_000);
    if (age > COACH.STALE_DAYS) out.push(`Your latest weigh-in is ${age} days older than the end of this week.`);
  }
  const inWeek = body.filter((e) => e.date >= m.period.start && e.date <= m.period.end);
  const byDay = new Map<string, number[]>();
  for (const e of inWeek) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e.weightLb]);
  for (const [day, ws] of byDay)
    if (ws.length > 1 && (Math.max(...ws) - Math.min(...ws)) / Math.min(...ws) > COACH.SAME_DAY_MISMATCH)
      out.push(`Two weigh-ins on ${day} differ by more than ${Math.round(COACH.SAME_DAY_MISMATCH * 100)}% — one may be a typo. Check Body tracker.`);
  if (!goal) out.push("No weight goal is set, so the coach can't tell which direction counts as progress.");
  if (m.workouts.rate == null && m.workouts.sessions) out.push("This week's planned sessions aren't on record, so completion can't be measured.");
  if (m.nutrition.intakeDays < COACH.MIN_INTAKE_DAYS)
    out.push(m.nutrition.intakeDays ? `Only ${m.nutrition.intakeDays} day${m.nutrition.intakeDays === 1 ? "" : "s"} of imported food log — nutrition wasn't assessed.` : "No imported food log this week — nutrition wasn't assessed.");
  return out;
}

export function coach(input: CoachInput): CoachResult {
  const { week: m, averages, goal, checkIn, unit } = input;
  const shows: string[] = [];
  const flags: string[] = [];
  const limits = dataLimits(input);
  const dir = goal?.type === "lose" ? -1 : goal?.type === "gain" ? 1 : 0;

  // ── Data layer → what the data shows ──────────────────────────────────
  if (m.workouts.rate != null) shows.push(`Completed ${m.workouts.completed} of ${m.workouts.scheduled} planned sessions (${pct(m.workouts.rate)}).`);
  else if (m.workouts.sessions) shows.push(`Logged ${m.workouts.sessions} workout${m.workouts.sessions === 1 ? "" : "s"} (your plan for this week isn't on record, so no completion rate).`);
  else shows.push("No workouts logged this week.");
  if (m.strength.prs.length) shows.push(`Set ${m.strength.prs.length} new personal record${m.strength.prs.length === 1 ? "" : "s"}.`);
  if (m.habits.rate != null) shows.push(`Habits: ${m.habits.done} of ${m.habits.eligible} done (${pct(m.habits.rate)}).`);
  if (m.body.avgLb != null && m.body.avgChangeLb != null)
    shows.push(`Average weight ${fmtLb(m.body.avgLb, unit)}, ${m.body.avgChangeLb === 0 ? "the same as" : `${m.body.avgChangeLb > 0 ? "up" : "down"} ${fmtLb(Math.abs(m.body.avgChangeLb), unit)} from`} last week's average.`);
  else if (m.body.weighIns) shows.push(`${m.body.weighIns} weigh-in${m.body.weighIns === 1 ? "" : "s"} this week — a weekly average needs at least ${COACH.MIN_WEIGHINS}${m.body.prevAvgLb == null ? " in each of two weeks" : ""}.`);
  else shows.push("No weigh-ins this week.");
  if (m.body.waist) shows.push(`Waist ${m.body.waist.change === 0 ? "unchanged" : `${m.body.waist.change < 0 ? "down" : "up"} ${Math.abs(m.body.waist.change)} in`} across the week.`);
  if (m.nutrition.intakeDays >= COACH.MIN_INTAKE_DAYS && m.nutrition.avgKcal != null)
    shows.push(`Imported food log: ${m.nutrition.intakeDays} days, averaging ${m.nutrition.avgKcal.toLocaleString()} kcal (target ≈${m.nutrition.targetKcal.toLocaleString()}).`);

  // ── Safety first ─────────────────────────────────────────────────────
  const safety = (): CoachResult | null => {
    if (checkIn?.pain)
      return result("insufficient", "Pain or a possible injury matters more than any number on this page. This app can't assess it.", {
        id: "professional-pain",
        kind: "professional",
        text: "Get the pain checked by a doctor or physiotherapist before pushing training again.",
        why: "You reported pain or an injury this week.",
      }, "After you've had it checked");
    if (checkIn?.energy === 1)
      return result("insufficient", "Very low energy can come from sleep, stress, food, illness or training load — the data here can't tell which.", {
        id: "recovery-energy",
        kind: "recovery",
        text: "Prioritise sleep and an easier week. If you still feel this drained, talk to your doctor.",
        why: "You rated your energy 1 of 5.",
      }, "In one week");
    return null;
  };

  // Unusually fast loss, two weeks running.
  const [a0, a1, a2] = averages;
  if (dir < 0 && a0 != null && a1 != null && a2 != null) {
    const r1 = ((a1 - a0) / a1) * 100;
    const r2 = ((a2 - a1) / a2) * 100;
    if (r1 > COACH.FAST_LOSS_PCT && r2 > COACH.FAST_LOSS_PCT)
      flags.push(`Weight has dropped more than ${COACH.FAST_LOSS_PCT}% a week for two weeks. That's faster than usually recommended — consider checking your intake with a doctor or registered dietitian.`);
  }

  function result(status: Status, means: string, next: Focus, reviewAgain = "Next week", proposal: CoachResult["proposal"] = null): CoachResult {
    return { status, shows, limits, means, next, reviewAgain, flags, proposal };
  }

  const s = safety();
  if (s) return s;

  const strengthUp = m.strength.prs.length > 0 || (m.strength.volumeChangePct != null && m.strength.volumeChangePct > 0);
  const strengthNote = strengthUp ? " Your training performance improved, which is a good sign." : "";
  const lowAdherence = m.workouts.rate != null && m.workouts.rate < COACH.ADHERENCE_OK;

  const adherenceFocus: Focus = {
    id: "adherence",
    kind: "adherence",
    text: m.workouts.missed ? `Aim to complete every planned session next week — ${m.workouts.missed} were missed this week.` : "Aim to complete every planned session next week.",
    why: `Plan completion was ${pct(m.workouts.rate ?? 0)}. Consistency comes before any change to the plan.`,
  };
  const measureFocus: Focus = {
    id: "measure",
    kind: "measure",
    text: "Weigh in at least 3 mornings next week (after the bathroom, before eating), and measure your waist once.",
    why: "More consistent measurements make next week's review reliable.",
  };
  const continueFocus = (why: string): Focus => ({ id: "continue", kind: "continue", text: "Keep the current plan for another week.", why });

  // ── Trend + decision layers ──────────────────────────────────────────
  if (a0 == null || a1 == null) {
    if (lowAdherence) return result("insufficient", `There isn't enough weigh-in data to judge your weight trend yet.${strengthNote}`, adherenceFocus);
    return result("insufficient", `There isn't enough weigh-in data to judge your weight trend yet.${strengthNote}`, measureFocus);
  }

  const weekly = a0 - a1; // + = up
  if (!goal)
    return result(
      "normal-variation",
      `Your average weight ${weekly === 0 ? "didn't change" : `moved ${fmtLb(Math.abs(weekly), unit)}`}. Without a weight goal the coach can't say whether that's progress — set one in Body tracker.${strengthNote}`,
      lowAdherence ? adherenceFocus : continueFocus("No goal is set, so there's nothing to adjust toward."),
    );
  if (!dir) {
    if (Math.abs(weekly) <= 1)
      return result("maintaining", `Your weight is holding steady, in line with a maintenance goal.${strengthNote}`, lowAdherence ? adherenceFocus : continueFocus("Your weight is stable and that's the goal."));
    return result("normal-variation", `Weight moved ${fmtLb(Math.abs(weekly), unit)} — one week's change is often water, food volume or salt, not a real trend.${strengthNote}`, lowAdherence ? adherenceFocus : continueFocus("One week isn't enough to change course."));
  }

  if (weekly * dir >= COACH.PROGRESS_LB_PER_WEEK)
    return result("progress", `Your weekly average moved in the right direction.${strengthNote} Your current plan appears to be working.`, lowAdherence ? adherenceFocus : continueFocus("The trend is heading toward your goal."));

  // Not moving toward the goal this week. Only call it a possible plateau with several weeks of evidence.
  const span = averages.slice(0, COACH.PLATEAU_WEEKS + 1);
  const enoughWeeks = span.length === COACH.PLATEAU_WEEKS + 1 && span.every((v) => v != null);
  if (enoughWeeks) {
    const total = ((span[0] as number) - (span[span.length - 1] as number)) * dir; // + = toward goal
    const from = addDays(m.period.start, -7 * COACH.PLATEAU_WEEKS);
    const waist = waistOver(input.body, from, m.period.end);
    const waistDown = waist != null && -waist >= COACH.WAIST_PROGRESS_IN && dir < 0;
    if (total <= COACH.PLATEAU_MAX_LB && !waistDown) {
      const rates = [m.workouts.rate, ...input.earlierRates.slice(0, COACH.PLATEAU_WEEKS)];
      const consistent = rates.every((r) => r == null || r >= COACH.ADHERENCE_OK);
      if (!consistent)
        return result("possible-plateau", `Your weekly average has barely moved for ${COACH.PLATEAU_WEEKS}+ weeks, but some planned sessions were missed in that time, so the plan itself hasn't had a fair test.${strengthNote}`, adherenceFocus);
      return result(
        "possible-plateau",
        `${total > 0 ? `Your weekly average has moved only ${fmtLb(total, unit)} toward your goal` : "Your weekly average hasn't moved toward your goal"} over ${COACH.PLATEAU_WEEKS} weeks while you followed the plan.${strengthNote} This may be a plateau worth investigating — it isn't a diagnosis.`,
        {
          id: "review-targets",
          kind: "review-targets",
          text: "Review your nutrition targets and food logging. Change them only if you decide to — a registered dietitian can help.",
          why: `${COACH.PLATEAU_WEEKS}+ weeks of consistent training without a change in your average weight.`,
        },
        "In 2 weeks, after any change has had time to show",
        { kind: "review-targets", text: "Open your macro targets to review them yourself. Nothing changes unless you edit and save." },
      );
    }
    if (waistDown)
      return result("progress", `The scale hasn't moved much, but your waist is down ${Math.abs(waist!)} in.${strengthNote} Your current plan may still be productive.`, continueFocus("Waist and performance point to progress."));
  }

  return result(
    "normal-variation",
    dir < 0 && Math.abs(weekly) < COACH.PROGRESS_LB_PER_WEEK && strengthUp
      ? "Your weight remained stable, but your training performance improved. There isn't enough evidence to conclude that your progress has stopped."
      : `One slower week is normal variation, not a plateau.${strengthNote} There isn't enough evidence to conclude that your progress has stopped.`,
    lowAdherence ? adherenceFocus : m.body.weighIns < 3 ? measureFocus : continueFocus("A single week isn't enough to change course."),
  );
}
