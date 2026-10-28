// Exercises renamed in lib/programs.ts. Set logs, PRs, workout history and saved swaps are
// keyed by name, so they're moved to the new name once (on the first load after the rename).

// Each batch runs once (tracked by its key); add a new batch for later renames.
const BATCHES: { key: string; renames: Record<string, string> }[] = [
  {
    key: "ags:renames:v1",
    renames: {
      "Face-Away Lat Pulldown Crunch": "Lat Pulldown Cable Crunch (Face-Away)",
      "Face-Away Cable Crunch (kneeling or standing)": "Standing Cable Crunch (Facing Away)",
      "Reverse Crunch": "Reverse Crunch (with Ab Mat)",
    },
  },
  { key: "ags:renames:v2", renames: { "Lat Pulldown": "Wide-Grip Lat Pulldown" } },
];

export function migrateRenamedExercises() {
  for (const { key, renames } of BATCHES) migrate(key, renames);
}

function migrate(DONE_KEY: string, RENAMES: Record<string, string>) {
  try {
    if (localStorage.getItem(DONE_KEY)) return;
    for (const [from, to] of Object.entries(RENAMES)) {
      for (const prefix of ["ags:log:", "ags:pr:"]) {
        const old = localStorage.getItem(prefix + from);
        if (old !== null && localStorage.getItem(prefix + to) === null) localStorage.setItem(prefix + to, old);
        localStorage.removeItem(prefix + from);
      }
    }
    const rename = (n: string) => RENAMES[n] ?? n;
    const history = JSON.parse(localStorage.getItem("ags:history") ?? "null") as { exercises?: string[] }[] | null;
    if (Array.isArray(history)) {
      localStorage.setItem(
        "ags:history",
        JSON.stringify(history.map((h) => (h.exercises ? { ...h, exercises: h.exercises.map(rename) } : h))),
      );
    }
    const swaps = JSON.parse(localStorage.getItem("ags:swaps") ?? "null") as Record<string, string> | null;
    if (swaps && typeof swaps === "object") {
      localStorage.setItem("ags:swaps", JSON.stringify(Object.fromEntries(Object.entries(swaps).map(([k, v]) => [rename(k), rename(v)]))));
    }
    localStorage.setItem(DONE_KEY, "1");
  } catch {
    /* storage unavailable: nothing to move */
  }
}
