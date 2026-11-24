// "Training terms": the words the plan and the app use, in plain English. Only terms the program
// or the app actually uses are listed, and each one says how this app applies it (rules from
// lib/overload.ts, lib/wins.ts and lib/programs.ts). Static text: nothing is stored.

export type Term = { term: string; meaning: string; inApp?: string };
export type TermGroup = { title: string; terms: Term[] };

export const TRAINING_TERMS: TermGroup[] = [
  {
    title: "Sets and reps",
    terms: [
      {
        term: "Sets × reps",
        meaning: "“3 × 8–12” means three sets of 8 to 12 reps each. The range is where your last good rep should land, not a number to stop at.",
        inApp: "Shown on every exercise card.",
      },
      {
        term: "Working set",
        meaning: "A set that counts toward your workout and your records.",
        inApp: "Every working set goes to true failure.",
      },
      {
        term: "Warm-up set",
        meaning: "A lighter set to get ready before your working sets.",
        inApp: "The sets shown are working sets only, so do warm-ups first and leave them out of the set boxes.",
      },
      {
        term: "Rest",
        meaning: "The break between sets, so you can give the next one everything. Bigger lifts get longer rests (about 2–3 min), smaller ones shorter (about 1–2 min).",
        inApp: "Each exercise shows its rest; tap it to start the timer. Take a little longer if you need it.",
      },
    ],
  },
  {
    title: "Effort",
    terms: [
      {
        term: "True failure",
        meaning: "The point where you can't finish another full rep with good form, however hard you try.",
        inApp: "When an exercise shows “failure” instead of a rep number, do as many good reps as you can.",
      },
      {
        term: "Drop set",
        meaning: "After your last rep, lower the weight by about 20–30% and keep going straight away, with no rest.",
        inApp: "Used on the last set of Hip Abduction.",
      },
      {
        term: "Slow lowering",
        meaning: "The lowering half of each rep. It builds muscle too, so control it instead of letting the weight drop.",
        inApp: "Cues that say “lower slowly into the stretch” mean this.",
      },
      {
        term: "Hold",
        meaning: "Pause and squeeze for a moment before lowering, so momentum doesn't do the work.",
        inApp: "Cues like “hold 1–2s at the top”.",
      },
    ],
  },
  {
    title: "Progress",
    terms: [
      {
        term: "Progressive overload",
        meaning: "Doing a little more over time (more reps, then more weight) so your muscles keep a reason to grow.",
        inApp: "The app does this for you with double progression. You can turn it off under More.",
      },
      {
        term: "Double progression",
        meaning:
          "Keep the weight and add a rep to each set until every working set reaches the top of the range. Then add a little weight and start again at the bottom.",
        inApp:
          "The app fills these targets into your set boxes: +5 lb (2.5 kg) on big lifts, +2.5 lb (1.25 kg) on smaller ones. For “failure” exercises the target is one more rep. You can always change the numbers.",
      },
      {
        term: "Personal record (PR)",
        meaning: "Your best so far on an exercise.",
        inApp: "The app spots three kinds when you finish a workout: heaviest weight, most reps, and biggest single set (weight × reps).",
      },
      {
        term: "Progression hold",
        meaning: "A pause on adding weight or reps.",
        inApp:
          "If you report pain in your weekly review, the app stops suggesting increases until you choose to resume. It isn't medical advice or medical clearance.",
      },
    ],
  },
  {
    title: "Your plan",
    terms: [
      {
        term: "Swap",
        meaning: "Another exercise for the same spot in your plan, for when a machine is taken or your gym doesn't have it.",
        inApp: "Tap ⇄ Swap on an exercise. A swap keeps that spot's sets, reps and rest.",
      },
    ],
  },
];
