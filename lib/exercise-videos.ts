// Hand-picked YouTube demos for exercises that free-exercise-db doesn't cover (or covers poorly).
// Shown in the "How to" screen; the video only loads from YouTube once the user taps play.

export type ExerciseVideo = { id: string; start?: number };

export const VIDEOS: Record<string, ExerciseVideo> = {
  "Garhammer Raise": { id: "PjFeAHXSoY0", start: 325 },
  "Face-Away Lat Pulldown Crunch": { id: "0ShG8aVIvms" },
  "Face-Away Cable Crunch (kneeling or standing)": { id: "0ShG8aVIvms" },
};
