// Achievement Artifact Engine — every eligibility rule, tier threshold and piece of certificate
// wording lives here, so awards can be retuned without touching detection or design code.
// Bump RULE_VERSION when a rule changes; each stored achievement records the version it used.

export const RULE_VERSION = 1;

export type Family = "conqueror" | "transformation" | "discipline";
export type Tier = "silver" | "gold" | "platinum";
export type AchievementType =
  | "weight-pr"
  | "rep-pr"
  | "volume-pr"
  | "first-pr"
  | "bodyweight-pr"
  | "volume-milestone"
  | "workout-count"
  | "habit-streak"
  | "weight-goal"
  | "weight-change"
  | "bodyfat-drop";

export const FAMILIES: Record<Family, { series: string; title: string; subtitle: string }> = {
  conqueror: { series: "The Conqueror Series", title: "Strength Conqueror", subtitle: "New Personal Record" },
  transformation: { series: "The Transformation Series", title: "The Evolution Award", subtitle: "Progress Beyond the Scale" },
  discipline: { series: "The Discipline Series", title: "30 Days Unbroken", subtitle: "The Consistency Certificate" },
};

export const TIERS: Record<Tier, { collection: string; rank: number }> = {
  silver: { collection: "Excellence Collection", rank: 1 },
  gold: { collection: "Champion Collection", rank: 2 },
  platinum: { collection: "Sovereign Collection", rank: 3 },
};

export const FOOTER = "STRENGTH IS EARNED. NEVER GIVEN.";

export const DECLARATION: Record<AchievementType, string> = {
  "weight-pr": "THE WEIGHT MOVED. THE STANDARD ROSE.",
  "rep-pr": "THE LIMIT MOVED. THE STANDARD ROSE.",
  "bodyweight-pr": "THE LIMIT MOVED. THE STANDARD ROSE.",
  "volume-pr": "MORE WORK. GREATER CAPACITY.",
  "first-pr": "EVERY LEGACY BEGINS WITH A FIRST REP.",
  "volume-milestone": "EVERY REP COUNTED. EVERY POUND EARNED.",
  "workout-count": "SHOW UP. AGAIN. AND AGAIN.",
  "habit-streak": "DISCIPLINE IS DONE DAILY.",
  "weight-goal": "THE GOAL WAS SET. THE GOAL WAS MET.",
  "weight-change": "PROGRESS MEASURED. PROGRESS EARNED.",
  "bodyfat-drop": "PROGRESS MEASURED. PROGRESS EARNED.",
};

/**
 * Personal-record rules (per exercise, exact exercise name — variants are never treated as the
 * same exercise). One record per exercise per workout, checked in this order:
 *  1. first-pr      — no earlier workout has a logged set of this exercise.
 *  2. weight-pr     — heaviest weight lifted for at least WEIGHT_PR_MIN_REPS reps beats every
 *                     earlier weight lifted for at least that many reps ("comparable reps").
 *  3. rep-pr        — at a weight used before (same weight to 0.1 lb), more reps in one set than
 *                     ever at that weight; the heaviest such weight is reported.
 *  4. volume-pr     — the workout's total for the exercise (Σ weight × reps) beats every earlier
 *                     workout's total.
 *  bodyweight-pr    — sets with no added weight compare only with earlier no-added-weight sets:
 *                     more reps in one set than ever before.
 */
export const PR_RULES = { WEIGHT_PR_MIN_REPS: 5, WEIGHT_MATCH_LB: 0.1 } as const;

/** Tier thresholds: the first rule an achievement meets, from platinum down, sets its metal. */
export const TIER_RULES = {
  "weight-pr": { platinum: 10, gold: 5 }, // % heavier than the previous best
  "rep-pr": { platinum: 5, gold: 3 }, // extra reps
  "bodyweight-pr": { platinum: 5, gold: 3 }, // extra reps
  "volume-pr": { platinum: 20, gold: 10 }, // % more volume
} as const;

/** Milestones: value reached → tier. Values are in the unit noted. */
export const MILESTONES = {
  "volume-milestone": [
    { at: 100_000, tier: "silver" },
    { at: 500_000, tier: "gold" },
    { at: 1_000_000, tier: "platinum" },
  ], // lb lifted in total (finished workouts)
  "workout-count": [
    { at: 10, tier: "silver" },
    { at: 50, tier: "gold" },
    { at: 100, tier: "platinum" },
  ], // finished workouts with at least one logged set or cardio
  // Perfect habit days in a row (all five daily habits). Habits are daily, so there are no
  // rest-day exemptions: a day with any habit unticked ends the streak.
  "habit-streak": [
    { at: 7, tier: "silver" },
    { at: 30, tier: "gold" },
    { at: 100, tier: "platinum" },
  ],
  // lb toward the body goal (lose or gain) from the first weigh-in; "maintain" goals don't count.
  "weight-change": [
    { at: 5, tier: "silver" },
    { at: 10, tier: "gold" },
    { at: 20, tier: "platinum" },
  ],
  // Body-fat percentage points down from the first reading with body fat.
  "bodyfat-drop": [
    { at: 2, tier: "silver" },
    { at: 4, tier: "gold" },
    { at: 6, tier: "platinum" },
  ],
} as const satisfies Record<string, readonly { at: number; tier: Tier }[]>;

/** Reaching a lose/gain weight goal (first weigh-in at or past the target). */
export const WEIGHT_GOAL_TIER: Tier = "gold";
export const FIRST_PR_TIER: Tier = "silver";
