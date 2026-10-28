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
  // Abs: picks from an EMG-tested ranking — loadable, deep stretch, hip flexors kept out of it.
  "Face-Away Crunch":    { label: "Abs · Upper", reason: "Facing away puts tension on the abs in the stretch; bracing your hips keeps them from doing the work." },
  "Reverse Crunch":      { label: "Abs · Lower", reason: "Curling the pelvis hits the lower abs without the hip flexors taking over; the mat adds the stretch." },
  "Garhammer Raise":     { label: "Abs · Lower", reason: "Best lower-ab emphasis of any exercise tested, with a deep stretch — add ankle weights to keep progressing." },
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
        equipmentNeeded: ["cable machine","rope attachment"], aestheticKey: "Cable Rope Pushdown", aestheticMap: "upper",
        substitutes: [
          { name: "Tricep Dumbbell Kickback", cue: "Upper arm pinned to your side, then lock out and squeeze for 1s.", equipmentNeeded: ["dumbbells","bench"], aestheticKey: "Cable Rope Pushdown", aestheticMap: "upper" },
        ] },
      { name: "Chest-Supported Lateral Raise", sets: "2–3", reps: "12–15", restSeconds: "90–120",
        cue: "Lead with the elbow, not the hand.",
        equipmentNeeded: ["dumbbells","incline bench"], aestheticKey: "Lateral Raise", aestheticMap: "upper",
        substitutes: [
          { name: "Machine Lateral Raise", cue: "Pads on the elbows; lead with the elbow, no shrug.", equipmentNeeded: ["lateral raise machine"], aestheticKey: "Lateral Raise", aestheticMap: "upper" },
          { name: "Cable Lateral Raise", cue: "Cable behind your body; lead with the elbow, no shrug.", equipmentNeeded: ["cable machine"], aestheticKey: "Lateral Raise", aestheticMap: "upper" },
          { name: "Behind-the-Back Cuffed Lateral Raise", cue: "Cuff on the wrist, cable running behind your back from the low pulley. Stretch across the body at the bottom, raise out to the side leading with the elbow.", equipmentNeeded: ["cable machine","ankle strap"], aestheticKey: "Lateral Raise", aestheticMap: "upper" },
          { name: "Cable Y-Raise", cue: "Two low cables crossed, one in each hand. Raise up and out into a Y, thumbs up, without shrugging — side delts do the work.", equipmentNeeded: ["cable machine"], aestheticKey: "Lateral Raise", aestheticMap: "upper" },
          { name: "Lying Side Raise", cue: "Lie on your side on an incline bench, dumbbell in the top hand starting across your body. Raise out to the side leading with the elbow — constant tension on the side delt.", equipmentNeeded: ["dumbbells","bench"], aestheticKey: "Lateral Raise", aestheticMap: "upper" },
          { name: "Seated Side Lateral Raise", cue: "Sit tall, lead with the elbow, no shrug or swing.", equipmentNeeded: ["dumbbells","bench"], aestheticKey: "Lateral Raise", aestheticMap: "upper" },
        ] },
      { name: "High-to-Low Cable Fly", sets: "2–3", reps: "12–15", restSeconds: "90–120",
        cue: "The fly is a fly. If you can cheat it, the weight is too heavy.",
        equipmentNeeded: ["cable machine"], aestheticKey: "High-to-Low Cable Fly", aestheticMap: "upper",
        substitutes: [
          { name: "Decline Dumbbell Fly", cue: "Slight elbow bend, wide arc, stretch at the bottom.", equipmentNeeded: ["dumbbells","decline bench"], aestheticKey: "High-to-Low Cable Fly", aestheticMap: "upper" },
          { name: "Dumbbell Fly", cue: "Slight elbow bend, wide arc; bring the dumbbells together over your lower chest.", equipmentNeeded: ["dumbbells","bench"], aestheticKey: "High-to-Low Cable Fly", aestheticMap: "upper" },
        ] },
      { name: "EZ-Bar Skullcrusher", sets: "2–3", reps: "8–12", restSeconds: "90–120",
        cue: "Keep elbows pinned, lower to forehead.",
        equipmentNeeded: ["ez bar","bench"], aestheticKey: "Cable Rope Pushdown", aestheticMap: "upper",
        substitutes: [
          { name: "Overhead Cable Extension", cue: "Face away, elbows by your ears, full stretch behind the head.", equipmentNeeded: ["cable machine","rope attachment"], aestheticKey: "Cable Rope Pushdown", aestheticMap: "upper" },
          { name: "Lying Dumbbell Tricep Extension", cue: "Elbows point up and stay still; lower beside your head for a deep stretch.", equipmentNeeded: ["dumbbells","bench"], aestheticKey: "Cable Rope Pushdown", aestheticMap: "upper" },
        ] },
      { name: "Dumbbell Overhead Press", sets: "2–3", reps: "10–12", restSeconds: "120–180",
        cue: "Brace hard, press straight up.",
        equipmentNeeded: ["dumbbells","bench"], aestheticKey: "Overhead Press", aestheticMap: "upper",
        substitutes: [
          { name: "Incline Front Dumbbell Raise", cue: "Lie back on a 45–60° incline so the front delts start stretched. Raise the dumbbells to eye level, thumbs slightly up — no swinging.", equipmentNeeded: ["dumbbells","incline bench"], aestheticKey: "Overhead Press", aestheticMap: "upper" },
          { name: "Dips", cue: "Lean slightly forward, elbows back. Lower until your shoulders stretch below your elbows, then press up — add weight once bodyweight is easy.", equipmentNeeded: ["dip station"], aestheticKey: "Overhead Press", aestheticMap: "upper" },
        ] },
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
      { name: "Wide-Grip Lat Pulldown", sets: "2–3", reps: "8–12", restSeconds: "120–180",
        cue: "Shoulder adduction: drive elbows down, not back.",
        equipmentNeeded: ["lat pulldown"], aestheticKey: "Lat Pulldown", aestheticMap: "upper",
        substitutes: [
          { name: "Neutral-Grip Pulldown", cue: "Palms facing; drive elbows down, not back.", equipmentNeeded: ["lat pulldown","neutral grip attachment"], aestheticKey: "Lat Pulldown", aestheticMap: "upper" },
          { name: "Half-Kneeling One-Arm Cable Pulldown", cue: "Kneel on one knee beside a high cable, torso slightly leaned. Reach up for a full lat stretch, then drive the elbow down to your hip.", equipmentNeeded: ["cable machine"], aestheticKey: "Lat Pulldown", aestheticMap: "upper" },
          { name: "Unilateral Pulldown", cue: "One arm at a time; drive the elbow down to your hip.", equipmentNeeded: ["lat pulldown"], aestheticKey: "Lat Pulldown", aestheticMap: "upper" },
          { name: "Pull-Up", cue: "Full hang at the bottom, then drive your elbows down to your ribs.", equipmentNeeded: ["pull-up bar"], aestheticKey: "Lat Pulldown", aestheticMap: "upper" },
          { name: "Straight-Arm Dumbbell Pullover", cue: "Arms long, big lat stretch overhead, pull back with the lats.", equipmentNeeded: ["dumbbells","bench"], aestheticKey: "Lat Pulldown", aestheticMap: "upper" },
        ] },
      { name: "Spider Curl", sets: "2–3", reps: "8–12", restSeconds: "90–120",
        cue: "Arms in front for the short head.",
        equipmentNeeded: ["ez bar","incline bench"], aestheticKey: "Incline Dumbbell Curl", aestheticMap: "upper",
        substitutes: [
          { name: "Prone Incline Dumbbell Curl", cue: "Chest on the pad, arms hanging straight down, squeeze at the top.", equipmentNeeded: ["dumbbells","incline bench"], aestheticKey: "Incline Dumbbell Curl", aestheticMap: "upper" },
          { name: "Machine Preacher Curl", cue: "Armpits tight to the pad; full stretch at the bottom.", equipmentNeeded: ["preacher curl machine"], aestheticKey: "Preacher Curl", aestheticMap: "upper" },
          { name: "Concentration Curl", cue: "Elbow braced on your inner thigh, full stretch, slow lower.", equipmentNeeded: ["dumbbells","bench"], aestheticKey: "Incline Dumbbell Curl", aestheticMap: "upper" },
        ] },
      { name: "Chest-Supported T-Bar Row", sets: "2–3", reps: "8–12", restSeconds: "120–180",
        cue: "Chest glued to the pad so nothing swings. Let the shoulder blades spread at the bottom, then pull elbows back and squeeze. Straps are fine if your grip goes first.",
        equipmentNeeded: ["t-bar row machine"], aestheticKey: "Single-Arm Dumbbell Row", aestheticMap: "upper",
        substitutes: [
          { name: "Chest-Supported Dumbbell Row (Helms Row)", cue: "Chest braced against an incline bench, neutral grip. Full stretch at the bottom, pull elbows back without lifting your chest off the pad.", equipmentNeeded: ["dumbbells","incline bench"], aestheticKey: "Single-Arm Dumbbell Row", aestheticMap: "upper" },
          { name: "Meadows Row", cue: "One end of a barbell in a landmine or corner, stand side-on and grab the thick end overhand. Hinge, stretch at the bottom, drive the elbow up and back.", equipmentNeeded: ["barbell"], aestheticKey: "Single-Arm Dumbbell Row", aestheticMap: "upper" },
          { name: "Single-Arm Dumbbell Row", cue: "Hand and knee on a bench, flat back. Full stretch at the bottom, drive the elbow to your hip. Straps are fine if your grip goes first.", equipmentNeeded: ["dumbbells","bench"], aestheticKey: "Single-Arm Dumbbell Row", aestheticMap: "upper" },
          { name: "Wide-Grip Cable Row", cue: "Wide bar, elbows flared out about 45°. Pull to your lower chest and squeeze the upper back; control the stretch forward.", equipmentNeeded: ["cable machine"], aestheticKey: "Single-Arm Dumbbell Row", aestheticMap: "upper" },
        ] },
      { name: "Seated Cable Row", sets: "2–3", reps: "8–12", restSeconds: "120–180",
        cue: "Sit tall, let the weight pull your shoulders forward for a stretch, then row to your stomach — no rocking back.",
        equipmentNeeded: ["cable machine"], aestheticKey: "Single-Arm Dumbbell Row", aestheticMap: "upper",
        substitutes: [
          { name: "Wide-Grip Cable Row", cue: "Wide bar, elbows flared out about 45°. Pull to your lower chest and squeeze the upper back; control the stretch forward.", equipmentNeeded: ["cable machine"], aestheticKey: "Single-Arm Dumbbell Row", aestheticMap: "upper" },
          { name: "Meadows Row", cue: "One end of a barbell in a landmine or corner, stand side-on and grab the thick end overhand. Hinge, stretch at the bottom, drive the elbow up and back.", equipmentNeeded: ["barbell"], aestheticKey: "Single-Arm Dumbbell Row", aestheticMap: "upper" },
          { name: "Single-Arm Dumbbell Row", cue: "Hand and knee on a bench, flat back. Full stretch at the bottom, drive the elbow to your hip. Straps are fine if your grip goes first.", equipmentNeeded: ["dumbbells","bench"], aestheticKey: "Single-Arm Dumbbell Row", aestheticMap: "upper" },
        ] },
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
        equipmentNeeded: ["cable machine","rope attachment"], aestheticKey: "Preacher Curl", aestheticMap: "upper",
        substitutes: [
          { name: "Dumbbell Hammer Curl", cue: "Palms facing in, elbows still, no swinging.", equipmentNeeded: ["dumbbells"], aestheticKey: "Preacher Curl", aestheticMap: "upper" },
        ] },
      { name: "Reverse Pec Deck", sets: "2–3", reps: "10–12", restSeconds: "90–120",
        cue: "45° angle, lead with the elbow.",
        equipmentNeeded: ["reverse pec deck"], aestheticKey: "Reverse Pec Deck", aestheticMap: "upper",
        substitutes: [
          { name: "Reverse Cable Crossover", cue: "Cables at shoulder height, crossed — left hand holds the right cable. Sweep out wide at 45°, leading with the elbows; let them cross back for a full stretch.", equipmentNeeded: ["cable machine"], aestheticKey: "Reverse Pec Deck", aestheticMap: "upper" },
          { name: "Rear Delt Raise (head on bench)", cue: "Forehead on the bench, sweep out wide and lead with the elbows.", equipmentNeeded: ["dumbbells","bench"], aestheticKey: "Reverse Pec Deck", aestheticMap: "upper" },
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
          { name: "Goblet Squat", cue: "Dumbbell at your chest, sit straight down between your knees, torso upright.", equipmentNeeded: ["dumbbells"], aestheticKey: "Hack Squat", aestheticMap: "legs" },
        ] },
      { name: "Romanian Deadlift", sets: "3", reps: "10", restSeconds: "120–180",
        cue: "Hinge at the hips, bar close, feel the hamstring stretch.",
        equipmentNeeded: ["barbell"], aestheticKey: "Romanian Deadlift", aestheticMap: "legs",
        substitutes: [
          { name: "Dumbbell RDL", cue: "Hinge at the hips, dumbbells close to the legs, feel the hamstring stretch.", equipmentNeeded: ["dumbbells"], aestheticKey: "Romanian Deadlift", aestheticMap: "legs" },
        ] },
      { name: "Leg Extension", sets: "3", reps: "10–12", restSeconds: "90–120",
        cue: "Seat back, push through the quad, squeeze at the top.",
        equipmentNeeded: ["leg extension machine"], aestheticKey: "Leg Extension", aestheticMap: "legs",
        substitutes: [
          { name: "Dumbbell Split Squat", cue: "Front knee travels forward and the front leg does the work; control the way down.", equipmentNeeded: ["dumbbells"], aestheticKey: "Leg Extension", aestheticMap: "legs" },
        ] },
      { name: "Seated Leg Curls", sets: "3", reps: "10–12", restSeconds: "90–120",
        cue: "Lean forward for a better hamstring stretch.",
        equipmentNeeded: ["seated leg curl machine"], aestheticKey: "Seated Leg Curl", aestheticMap: "legs",
        substitutes: [
          { name: "Lying Leg Curl", cue: "Hips pinned to the pad; control the eccentric.", equipmentNeeded: ["lying leg curl machine"], aestheticKey: "Seated Leg Curl", aestheticMap: "legs" },
          { name: "Nordic Curl", cue: "Kneel with your heels anchored under something solid; lower as slowly as you can, catch yourself with your hands, push back up.", equipmentNeeded: [], aestheticKey: "Seated Leg Curl", aestheticMap: "legs" },
        ] },
      { name: "Standing Calf Raise", sets: "3", reps: "10–12", restSeconds: "90–120",
        cue: "2s up, 2s at the top, 2s down, 2s in the stretch.",
        equipmentNeeded: ["calf raise machine"], aestheticKey: "Standing Calf Raise", aestheticMap: "legs",
        substitutes: [
          { name: "Standing Barbell Calf Raise", cue: "Ball of the foot on a plate, full stretch at the bottom, pause at the top.", equipmentNeeded: ["barbell","squat rack"], aestheticKey: "Standing Calf Raise", aestheticMap: "legs" },
          { name: "Standing Dumbbell Calf Raise", cue: "Ball of the foot on a step, full stretch at the bottom, pause at the top.", equipmentNeeded: ["dumbbells"], aestheticKey: "Standing Calf Raise", aestheticMap: "legs" },
        ] },
      { name: "Hip Abduction", sets: "3", reps: "10–12", restSeconds: "90–120",
        cue: "Hold 1–2s at the top and bottom; drop set on the last set.",
        equipmentNeeded: ["abductor machine"], aestheticKey: "Hip Abduction", aestheticMap: "legs",
        substitutes: [
          { name: "Cable Hip Abduction", cue: "Lean slightly away; sweep out and hold 1–2s at the top.", equipmentNeeded: ["cable machine","ankle strap"], aestheticKey: "Hip Abduction", aestheticMap: "legs" },
          { name: "Side-Lying Hip Abduction", cue: "Lie on your side, top leg straight and slightly behind you; lift with the side of the hip and hold 1–2s at the top.", equipmentNeeded: [], aestheticKey: "Hip Abduction", aestheticMap: "legs" },
        ] },
      // Abs: only the S-tier picks. Slot 1's swaps are the face-away crunch variations.
      { name: "Assisted Lat Pulldown Crunch", sets: "3", reps: "failure", restSeconds: "90–120",
        cue: "Let the cable's upward pull assist you as you crunch, then control the way down — slow lowering into a full stretch.",
        equipmentNeeded: ["lat pulldown"], aestheticKey: "Face-Away Crunch", aestheticMap: "legs", abs: true,
        substitutes: [
          { name: "Lat Pulldown Cable Crunch (Face-Away)", cue: "Sit facing away from the stack, seat pad raised to brace your lower back and lock your hips. Let your spine fully extend at the top, then curl ribs to pelvis.", equipmentNeeded: ["lat pulldown"], aestheticKey: "Face-Away Crunch", aestheticMap: "legs", abs: true },
          { name: "Standing Cable Crunch (Facing Away)", cue: "Back to the cable, hips locked against the pole (a bar pad makes it comfortable). Open up fully at the top, then round into a C on the way down.", equipmentNeeded: ["cable machine","rope attachment"], aestheticKey: "Face-Away Crunch", aestheticMap: "legs", abs: true },
          { name: "Kneeling Cable Crunch (Facing Away)", cue: "Kneel facing away from the cable, hips locked against the pole. Let the cable stretch you open at the top, then crunch ribs to pelvis.", equipmentNeeded: ["cable machine","rope attachment"], aestheticKey: "Face-Away Crunch", aestheticMap: "legs", abs: true },
        ] },
      { name: "Reverse Crunch (with Ab Mat)", sets: "3", reps: "failure", restSeconds: "90–120",
        cue: "Ab mat or rolled towel under your lower back, knees at 90°. Push your tailbone up and curl your pelvis into a C — slow on the way down. Straighten your legs more to make it harder.",
        equipmentNeeded: [], aestheticKey: "Reverse Crunch", aestheticMap: "legs", abs: true },
      { name: "Garhammer Raise", sets: "3", reps: "failure", restSeconds: "90–120",
        cue: "Hips off the end of a bench, knees tucked. Lower your legs as far as you can without touching the floor, then raise by curling your pelvis — no swinging. Add load as you get stronger.",
        equipmentNeeded: ["bench"], aestheticKey: "Garhammer Raise", aestheticMap: "legs", abs: true },
    ],
  },
};
