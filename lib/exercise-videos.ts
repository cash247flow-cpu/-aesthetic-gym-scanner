// Hand-picked YouTube demos for exercises that free-exercise-db doesn't cover (or covers poorly).
// Shown in the "How to" screen; a video only loads from YouTube once the user taps play.

export type ExerciseVideo = { id: string; start?: number };

const FACE_AWAY_CRUNCH: ExerciseVideo[] = [{ id: "0ShG8aVIvms" }];

export const VIDEOS: Record<string, ExerciseVideo[]> = {
  "Garhammer Raise": [{ id: "PjFeAHXSoY0", start: 325 }],
  "Face-Away Lat Pulldown Crunch": FACE_AWAY_CRUNCH,
  "Face-Away Cable Crunch (kneeling or standing)": FACE_AWAY_CRUNCH,
  "Machine Lateral Raise": [{ id: "0FUpcwj_1z4" }],
  "Cable Lateral Raise": [{ id: "Sp8be0IFNvk" }, { id: "ozpcrgmwyto" }],
  "Chest-Supported Lateral Raise": [{ id: "zOQxJm7sEAg" }],
  "Cable Hip Abduction": [{ id: "3ryh7PNhz3E", start: 500 }],
  "Side-Lying Hip Abduction": [{ id: "s6lDpy4AO6w" }],
  "Smith Machine Shrug": [{ id: "kJUypIT1Txo" }],
};
