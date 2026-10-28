// Weekly review and coaching rules — one place to tune them. Deliberately conservative: the coach
// never calls a plateau from one slow week and never changes a plan by itself.

export const REVIEW_RULE_VERSION = 1;

export const COACH = {
  /** Weigh-ins in a week needed before that week's average counts as evidence. */
  MIN_WEIGHINS: 2,
  /** Weekly-average change (lb/week) in the goal's direction that counts as progress. */
  PROGRESS_LB_PER_WEEK: 0.3,
  /** A possible plateau needs this many consecutive week-to-week comparisons… */
  PLATEAU_WEEKS: 3,
  /** …with no more than this total change (lb) toward the goal across them… */
  PLATEAU_MAX_LB: 1,
  /** …and the waist (if measured) not down by at least this much (in). */
  WAIST_PROGRESS_IN: 0.5,
  /** Planned-workout completion below this is treated as the first thing to look at. */
  ADHERENCE_OK: 0.75,
  /** Losing faster than this % of body weight per week, two weeks running, is flagged. */
  FAST_LOSS_PCT: 1,
  /** Nutrition is only compared with targets with at least this many logged (imported) days. */
  MIN_INTAKE_DAYS: 4,
  /** A logged day counts as "on target" when calories are within this fraction of target. */
  KCAL_TOLERANCE: 0.1,
};
