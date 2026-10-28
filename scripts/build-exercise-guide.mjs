// Builds the "How to" exercise guide from free-exercise-db (public domain, Unlicense):
// https://github.com/yuhonas/free-exercise-db
//
// Each app exercise is matched by hand to a database entry. Exercises without a faithful
// equivalent are left out on purpose, so the app shows no photos rather than wrong form.
//
// Writes lib/exercise-guide.json and downloads the photos to public/exercises/<id>/.
// Run from the project root:  node scripts/build-exercise-guide.mjs

import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const DB_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const IMG_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

/** App exercise name (lib/programs.ts) → database name, plus an optional note shown with it. */
const MATCHES = {
  // Push
  "Incline Dumbbell Press": { db: "Incline Dumbbell Press" },
  "Flat Dumbbell Press": { db: "Dumbbell Bench Press" },
  "Incline Smith Machine Press": { db: "Smith Machine Incline Bench Press" },
  "Cable Rope Pushdown": { db: "Triceps Pushdown - Rope Attachment" },
  "High-to-Low Cable Fly": { db: "Cable Crossover" },
  "EZ-Bar Skullcrusher": { db: "EZ-Bar Skullcrusher" },
  "Overhead Cable Extension": { db: "Cable Rope Overhead Triceps Extension" },
  "Dumbbell Overhead Press": { db: "Dumbbell Shoulder Press" },
  "Machine Chest Press": { db: "Machine Bench Press" },
  "Tricep Dumbbell Kickback": { db: "Tricep Dumbbell Kickback" },
  "Lying Dumbbell Tricep Extension": { db: "Lying Dumbbell Tricep Extension" },
  "Decline Dumbbell Fly": { db: "Decline Dumbbell Flyes" },
  "Dumbbell Fly": { db: "Dumbbell Flyes" },
  "Seated Side Lateral Raise": { db: "Seated Side Lateral Raise" },
  // Pull
  "Wide-Grip Lat Pulldown": { db: "Wide-Grip Lat Pulldown" },
  "Half-Kneeling One-Arm Cable Pulldown": {
    db: "One Arm Lat Pulldown",
    note: "Photos show it seated — kneel on one knee beside a high cable instead, same pulling path.",
  },
  "Unilateral Pulldown": { db: "One Arm Lat Pulldown" },
  "Neutral-Grip Pulldown": { db: "V-Bar Pulldown" },
  "Spider Curl": { db: "Spider Curl" },
  "Machine Preacher Curl": { db: "Machine Preacher Curls" },
  "Single-Arm Dumbbell Row": { db: "One-Arm Dumbbell Row" },
  "Chest-Supported T-Bar Row": { db: "Lying T-Bar Row" },
  "Chest-Supported Dumbbell Row (Helms Row)": { db: "Dumbbell Incline Row" },
  "Seated Cable Row": { db: "Seated Cable Rows" },
  "Wide-Grip Cable Row": { db: "Seated Cable Rows", note: "Photos show a close grip — use a wide straight bar and pull to your lower chest." },
  "Incline Dumbbell Curl": { db: "Incline Dumbbell Curl" },
  Shrugs: { db: "Dumbbell Shrug" },
  "Barbell Shrugs": { db: "Barbell Shrug" },
  "Cable Hammer Curl": { db: "Cable Hammer Curls - Rope Attachment" },
  "Reverse Pec Deck": { db: "Reverse Machine Flyes" },
  "Reverse Cable Crossover": { db: "Cable Rear Delt Fly" },
  "Pull-Up": { db: "Pullups" },
  "Straight-Arm Dumbbell Pullover": { db: "Straight-Arm Dumbbell Pullover" },
  "Prone Incline Dumbbell Curl": { db: "Dumbbell Prone Incline Curl" },
  "Concentration Curl": { db: "Concentration Curls" },
  "Dumbbell Hammer Curl": { db: "Hammer Curls" },
  "Rear Delt Raise (head on bench)": { db: "Bent Over Dumbbell Rear Delt Raise With Head On Bench" },
  // Legs
  "Hack Squat": { db: "Hack Squat" },
  "Leg Press": { db: "Leg Press" },
  "Barbell Squat": { db: "Barbell Squat" },
  "Romanian Deadlift": { db: "Romanian Deadlift" },
  "Dumbbell RDL": { db: "Stiff-Legged Dumbbell Deadlift" },
  "Leg Extension": { db: "Leg Extensions" },
  "Seated Leg Curls": { db: "Seated Leg Curl" },
  "Lying Leg Curl": { db: "Lying Leg Curls" },
  "Standing Calf Raise": { db: "Standing Calf Raises" },
  "Hip Abduction": { db: "Thigh Abductor" },
  "Goblet Squat": { db: "Goblet Squat", note: "Photos show a kettlebell — hold one dumbbell vertically at your chest instead." },
  "Dumbbell Split Squat": { db: "Split Squat with Dumbbells" },
  "Standing Dumbbell Calf Raise": { db: "Standing Dumbbell Calf Raise" },
  "Standing Barbell Calf Raise": { db: "Standing Barbell Calf Raise" },
  "Nordic Curl": {
    db: "Natural Glute Ham Raise",
    note: "Same movement as a Nordic curl — keep your hips straight so the hamstrings do the work.",
  },
  // Abs
  "Reverse Crunch (with Ab Mat)": {
    db: "Reverse Crunch",
    note: "Photos show the plain floor version — put an ab mat or rolled towel under your lower back and start with knees at 90°.",
  },
};

const res = await fetch(DB_URL);
if (!res.ok) throw new Error(`Couldn't download the database: HTTP ${res.status}`);
const db = new Map((await res.json()).map((e) => [e.name, e]));

const guide = {};
for (const [name, { db: dbName, note }] of Object.entries(MATCHES)) {
  const e = db.get(dbName);
  if (!e) throw new Error(`"${dbName}" (for ${name}) is not in the database`);
  const images = [];
  for (const path of e.images) {
    const local = `public/exercises/${path}`;
    if (!existsSync(local)) {
      const img = await fetch(IMG_URL + path);
      if (!img.ok) throw new Error(`Image ${path}: HTTP ${img.status}`);
      await mkdir(local.slice(0, local.lastIndexOf("/")), { recursive: true });
      await writeFile(local, Buffer.from(await img.arrayBuffer()));
    }
    images.push(`/exercises/${path}`);
  }
  guide[name] = {
    source: e.name,
    equipment: e.equipment,
    level: e.level,
    primaryMuscles: e.primaryMuscles,
    secondaryMuscles: e.secondaryMuscles,
    instructions: e.instructions,
    images,
    ...(note ? { note } : {}),
  };
}

await writeFile("lib/exercise-guide.json", JSON.stringify(guide, null, 2) + "\n");
console.log(`Wrote ${Object.keys(guide).length} exercises to lib/exercise-guide.json`);
