// ─── Types ─────────────────────────────────────────────────────────────
export type AestheticMap = "upper" | "legs";

export type Sub = {
  name: string;
  cue?: string; // overrides the slot's cue when this swap is used
  equipmentNeeded: string[];
  aestheticKey: string;
  aestheticMap: AestheticMap;
  abs?: boolean;
};

export type Exercise = {
  name: string;
  sets: string;
  reps: string;
  restSeconds: string;
  cue: string;
  equipmentNeeded: string[];
  aestheticKey: string;
  aestheticMap: AestheticMap;
  abs?: boolean;
  substitutes?: Sub[];
};

// ─── Upper-body aesthetic ranking (Top 10 file) ────────────────────────
export const AESTHETIC_RANK: Record<string, { rank: number; reason: string }> = {
  "Lat Pulldown":             { rank: 1,  reason: "Lower lats build the V-taper width." },
  "Lateral Raise":            { rank: 2,  reason: "Side delts shape arms and the V-taper." },
  "Incline Dumbbell Curl":    { rank: 3,  reason: "Biceps are the most visible muscle in a t-shirt." },
  "Cable Rope Crunch":        { rank: 4,  reason: "Direct ab development, not just leanness." },
  "High-to-Low Cable Fly":    { rank: 5,  reason: "Upper chest gives the superhero look, avoids a saggy chest." },
  "Incline Dumbbell Press":   { rank: 5,  reason: "Upper chest gives the superhero look, avoids a saggy chest." },
  "Shrugs":                   { rank: 6,  reason: "Upper back shows in tight shirts and shirtless." },
  "Reverse Pec Deck":         { rank: 7,  reason: "Rear delts at 45° are the most underrated aesthetic muscle." },
  "Cable Rope Pushdown":      { rank: 8,  reason: "Long-head tricep fills out t-shirts." },
  "Preacher Curl":            { rank: 9,  reason: "Brachialis pushes the biceps up." },
  "Single-Arm Dumbbell Row":  { rank: 10, reason: "Upper lats support full back development." },
  "Overhead Press":           { rank: 11, reason: "Shoulder width frames the whole upper body." },
};

// ─── Legs / abs aesthetic map ──────────────────────────────────────────
export const LEG_AESTHETIC: Record<string, { label: string; reason: string }> = {
  "Hack Squat":          { label: "Quads",  reason: "Quad sweep is the main driver of leg size and shape." },
  "Romanian Deadlift":   { label: "Hams",   reason: "Hamstring and glute thickness builds the posterior chain silhouette." },
  "Leg Extension":       { label: "Quads",  reason: "Isolates the rectus femoris — the visible teardrop above the knee." },
  "Seated Leg Curl":     { label: "Hams",   reason: "Seated curl stretches the hamstring at the hip — best growth position." },
  "Standing Calf Raise": { label: "Calves", reason: "Full-stretch calves complete the lower-leg look in shorts." },
  "Hip Abduction":       { label: "Glutes", reason: "Upper glute/hip shape — the 'shelf' look from behind." },
  "Leg Raise":           { label: "Abs · Lower", reason: "Lower-ab development that leanness alone can't create." },
  "Decline Crunch":      { label: "Abs · Upper", reason: "Loaded spinal flexion builds blocky, visible abs." },
};

// ─── Sessions ──────────────────────────────────────────────────────────
export const SESSIONS: Record<"push" | "pull" | "legs", { label: string; note: string; exercises: Exercise[] }> = {
  push: {
    label: "Push Day",
    note: "Compare with last week's Push, not Upper.",
    exercises: [
      { name: "Incline Dumbbell Press", sets: "3", reps: "8–12", restSeconds: "120–180",
        cue: "Every set to true failure; the rep range is where failure lands.",
        equipmentNeeded: ["dumbbells","incline bench"], aestheticKey: "Incline Dumbbell Press", aestheticMap: "upper",
        substitutes: [
          { name: "Incline Smith Machine Press", cue: "Bench at 30°, lower the bar to your upper chest.", equipmentNeeded: ["smith machine","bench"], aestheticKey: "Incline Dumbbell Press", aestheticMap: "upper" },
          { name: "Flat Dumbbell Press", cue: "Elbows ~45°, sink into a deep stretch at the bottom.", equipmentNeeded: ["dumbbells","bench"], aestheticKey: "Incline Dumbbell Press", aestheticMap: "upper" },
        ] },
      { name: "Cable Rope Pushdown", sets: "2–3", reps: "8–12", restSeconds: "90–120",
        cue: "No upper-arm swing; let the long head work.",
        equipmentNeeded: ["cable machine","rope attachment"], aestheticKey: "Cable Rope Pushdown", aestheticMap: "upper" },
      { name: "Chest-Supported Lateral Raise", sets: "2–3", reps: "12–15", restSeconds: "90–120",
        cue: "Lead with the elbow, not the hand.",
        equipmentNeeded: ["dumbbells","incline bench"], aestheticKey: "Lateral Raise", aestheticMap: "upper",
        substitutes: [
          { name: "Machine Lateral Raise", cue: "Pads on the elbows; lead with the elbow, no shrug.", equipmentNeeded: ["lateral raise machine"], aestheticKey: "Lateral Raise", aestheticMap: "upper" },
          { name: "Cable Lateral Raise", cue: "Cable behind your body; lead with the elbow, no shrug.", equipmentNeeded: ["cable machine"], aestheticKey: "Lateral Raise", aestheticMap: "upper" },
        ] },
      { name: "High-to-Low Cable Fly", sets: "2–3", reps: "12–15", restSeconds: "90–120",
        cue: "The fly is a fly. If you can cheat it, the weight is too heavy.",
        equipmentNeeded: ["cable machine"], aestheticKey: "High-to-Low Cable Fly", aestheticMap: "upper" },
      { name: "EZ-Bar Skullcrusher", sets: "2–3", reps: "8–12", restSeconds: "90–120",
        cue: "Keep elbows pinned, lower to forehead.",
        equipmentNeeded: ["ez bar","bench"], aestheticKey: "Cable Rope Pushdown", aestheticMap: "upper",
        substitutes: [
          { name: "Overhead Cable Extension", cue: "Face away, elbows by your ears, full stretch behind the head.", equipmentNeeded: ["cable machine","rope attachment"], aestheticKey: "Cable Rope Pushdown", aestheticMap: "upper" },
        ] },
      { name: "Dumbbell Overhead Press", sets: "2–3", reps: "10–12", restSeconds: "120–180",
        cue: "Brace hard, press straight up.",
        equipmentNeeded: ["dumbbells","bench"], aestheticKey: "Overhead Press", aestheticMap: "upper" },
      { name: "Machine Chest Press", sets: "2–3", reps: "8–12", restSeconds: "120–180",
        cue: "Full stretch at the bottom.",
        equipmentNeeded: ["chest press machine"], aestheticKey: "High-to-Low Cable Fly", aestheticMap: "upper",
        substitutes: [
          { name: "Flat Dumbbell Press", cue: "Full stretch at the bottom; elbows ~45°.", equipmentNeeded: ["dumbbells","bench"], aestheticKey: "High-to-Low Cable Fly", aestheticMap: "upper" },
        ] },
    ],
  },
  pull: {
    label: "Pull Day",
    note: "Log against last week's Pull, not Upper.",
    exercises: [
      { name: "Lat Pulldown", sets: "2–3", reps: "8–12", restSeconds: "120–180",
        cue: "Shoulder adduction: drive elbows down, not back.",
        equipmentNeeded: ["lat pulldown"], aestheticKey: "Lat Pulldown", aestheticMap: "upper",
        substitutes: [
          { name: "Unilateral Pulldown", cue: "One arm at a time; drive the elbow down to your hip.", equipmentNeeded: ["lat pulldown"], aestheticKey: "Lat Pulldown", aestheticMap: "upper" },
          { name: "Neutral-Grip Pulldown", cue: "Palms facing; drive elbows down, not back.", equipmentNeeded: ["lat pulldown","neutral grip attachment"], aestheticKey: "Lat Pulldown", aestheticMap: "upper" },
        ] },
      { name: "Spider Curl", sets: "2–3", reps: "8–12", restSeconds: "90–120",
        cue: "Arms in front for the short head.",
        equipmentNeeded: ["ez bar","incline bench"], aestheticKey: "Incline Dumbbell Curl", aestheticMap: "upper",
        substitutes: [
          { name: "Machine Preacher Curl", cue: "Armpits tight to the pad; full stretch at the bottom.", equipmentNeeded: ["preacher curl machine"], aestheticKey: "Preacher Curl", aestheticMap: "upper" },
        ] },
      { name: "Single-Arm Dumbbell Row", sets: "2–3", reps: "8–12", restSeconds: "120–180",
        cue: "Straps are fine if your grip goes first.",
        equipmentNeeded: ["dumbbells","bench"], aestheticKey: "Single-Arm Dumbbell Row", aestheticMap: "upper" },
      { name: "Incline Dumbbell Curl", sets: "2", reps: "10–12", restSeconds: "90–120",
        cue: "Arms behind for the long head.",
        equipmentNeeded: ["dumbbells","incline bench"], aestheticKey: "Incline Dumbbell Curl", aestheticMap: "upper" },
      { name: "Shrugs", sets: "2–3", reps: "12–15", restSeconds: "90–120",
        cue: "Straight up, no rolling.",
        equipmentNeeded: ["dumbbells"], aestheticKey: "Shrugs", aestheticMap: "upper",
        substitutes: [
          { name: "Barbell Shrugs", cue: "Straight up, pause at the top, no rolling.", equipmentNeeded: ["barbell"], aestheticKey: "Shrugs", aestheticMap: "upper" },
          { name: "Smith Machine Shrug", cue: "Straight up, pause at the top, no rolling.", equipmentNeeded: ["smith machine"], aestheticKey: "Shrugs", aestheticMap: "upper" },
        ] },
      { name: "Cable Hammer Curl", sets: "2–3", reps: "12–15", restSeconds: "90–120",
        cue: "Neutral grip for the brachialis.",
        equipmentNeeded: ["cable machine","rope attachment"], aestheticKey: "Preacher Curl", aestheticMap: "upper" },
      { name: "Reverse Pec Deck", sets: "2–3", reps: "10–12", restSeconds: "90–120",
        cue: "45° angle, lead with the elbow.",
        equipmentNeeded: ["reverse pec deck"], aestheticKey: "Reverse Pec Deck", aestheticMap: "upper",
        substitutes: [
          { name: "Cable Rear Delt Fly", cue: "Cross the cables; sweep out at 45°, lead with the elbow.", equipmentNeeded: ["cable machine"], aestheticKey: "Reverse Pec Deck", aestheticMap: "upper" },
        ] },
    ],
  },
  legs: {
    label: "Legs & Abs",
    note: "Compare with last week's Legs.",
    exercises: [
      { name: "Hack Squat", sets: "3", reps: "8–10", restSeconds: "120–180",
        cue: "Feet low on the platform; control the eccentric.",
        equipmentNeeded: ["hack squat machine"], aestheticKey: "Hack Squat", aestheticMap: "legs",
        substitutes: [
          { name: "Leg Press", cue: "Feet low on the platform; control the eccentric, don't lock out.", equipmentNeeded: ["leg press"], aestheticKey: "Hack Squat", aestheticMap: "legs" },
          { name: "Barbell Squat", cue: "Sit straight down, knees forward; control the eccentric.", equipmentNeeded: ["barbell","squat rack"], aestheticKey: "Hack Squat", aestheticMap: "legs" },
        ] },
      { name: "Romanian Deadlift", sets: "3", reps: "10", restSeconds: "120–180",
        cue: "Hinge at the hips, bar close, feel the hamstring stretch.",
        equipmentNeeded: ["barbell"], aestheticKey: "Romanian Deadlift", aestheticMap: "legs",
        substitutes: [
          { name: "Dumbbell RDL", cue: "Hinge at the hips, dumbbells close to the legs, feel the hamstring stretch.", equipmentNeeded: ["dumbbells"], aestheticKey: "Romanian Deadlift", aestheticMap: "legs" },
        ] },
      { name: "Leg Extension", sets: "3", reps: "10–12", restSeconds: "90–120",
        cue: "Seat back, push through the quad, squeeze at the top.",
        equipmentNeeded: ["leg extension machine"], aestheticKey: "Leg Extension", aestheticMap: "legs" },
      { name: "Seated Leg Curls", sets: "3", reps: "10–12", restSeconds: "90–120",
        cue: "Lean forward for a better hamstring stretch.",
        equipmentNeeded: ["seated leg curl machine"], aestheticKey: "Seated Leg Curl", aestheticMap: "legs",
        substitutes: [
          { name: "Lying Leg Curl", cue: "Hips pinned to the pad; control the eccentric.", equipmentNeeded: ["lying leg curl machine"], aestheticKey: "Seated Leg Curl", aestheticMap: "legs" },
        ] },
      { name: "Standing Calf Raise", sets: "3", reps: "10–12", restSeconds: "90–120",
        cue: "2s up, 2s at the top, 2s down, 2s in the stretch.",
        equipmentNeeded: ["calf raise machine"], aestheticKey: "Standing Calf Raise", aestheticMap: "legs" },
      { name: "Hip Abduction", sets: "3", reps: "10–12", restSeconds: "90–120",
        cue: "Hold 1–2s at the top and bottom; drop set on the last set.",
        equipmentNeeded: ["abductor machine"], aestheticKey: "Hip Abduction", aestheticMap: "legs",
        substitutes: [
          { name: "Cable Hip Abduction", cue: "Lean slightly away; sweep out and hold 1–2s at the top.", equipmentNeeded: ["cable machine","ankle strap"], aestheticKey: "Hip Abduction", aestheticMap: "legs" },
        ] },
      { name: "Leg Raise", sets: "3", reps: "failure", restSeconds: "90–120",
        cue: "Curl the pelvis, don't swing. Stop when you can't do a clean rep.",
        equipmentNeeded: ["captains chair"], aestheticKey: "Leg Raise", aestheticMap: "legs", abs: true,
        substitutes: [
          { name: "Hanging Leg Raise", cue: "Dead hang, curl the pelvis up; don't swing.", equipmentNeeded: ["pull-up bar"], aestheticKey: "Leg Raise", aestheticMap: "legs", abs: true },
          { name: "Lying Leg Raise", cue: "Lower back pressed down; curl the pelvis up at the top.", equipmentNeeded: ["bench"], aestheticKey: "Leg Raise", aestheticMap: "legs", abs: true },
        ] },
      { name: "Decline Crunches", sets: "3", reps: "failure", restSeconds: "90–120",
        cue: "Pure spinal flexion — round the back, slow eccentric.",
        equipmentNeeded: ["decline bench"], aestheticKey: "Decline Crunch", aestheticMap: "legs", abs: true,
        substitutes: [
          { name: "Cable Rope Crunch", cue: "Kneel, round the spine to bring elbows to knees; slow eccentric.", equipmentNeeded: ["cable machine","rope attachment"], aestheticKey: "Decline Crunch", aestheticMap: "legs", abs: true },
        ] },
    ],
  },
};
