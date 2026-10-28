// Exercises renamed in lib/programs.ts. Set logs, PRs, workout history and saved swaps are
// keyed by name, so they're moved to the new name once (on the first load after the rename).

const RENAMES: Record<string, string> = {
  "Face-Away Lat Pulldown Crunch": "Lat Pulldown Cable Crunch (Face-Away)",
  "Face-Away Cable Crunch (kneeling or standing)": "Standing Cable Crunch (Facing Away)",
  "Reverse Crunch": "Reverse Crunch (with Ab Mat)",
};
const DONE_KEY = "ags:renames:v1";

export function migrateRenamedExercises() {
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
