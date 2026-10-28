// Hand-picked YouTube demos for exercises that free-exercise-db doesn't cover (or covers poorly).
// Shown in the "How to" screen; a video only loads from YouTube once the user taps play.

export type ExerciseVideo = { id: string; start?: number };

const BACK_VIDEO = "jLvqKgW-_G8";
const SHOULDER_VIDEO = "SgyUoY0IZ7A";
const FACE_AWAY_CRUNCH: ExerciseVideo[] = [{ id: "0ShG8aVIvms" }];

export const VIDEOS: Record<string, ExerciseVideo[]> = {
  "Garhammer Raise": [{ id: "PjFeAHXSoY0", start: 325 }],
  "Assisted Lat Pulldown Crunch": FACE_AWAY_CRUNCH,
  "Lat Pulldown Cable Crunch (Face-Away)": FACE_AWAY_CRUNCH,
  "Standing Cable Crunch (Facing Away)": FACE_AWAY_CRUNCH,
  "Kneeling Cable Crunch (Facing Away)": FACE_AWAY_CRUNCH,
  "Machine Lateral Raise": [{ id: "0FUpcwj_1z4" }],
  "Cable Lateral Raise": [{ id: "Sp8be0IFNvk" }, { id: "ozpcrgmwyto" }, { id: SHOULDER_VIDEO, start: 477 }],
  // Jeff Nippard's shoulder-exercise ranking, each starting at that exercise's chapter.
  "Cable Y-Raise": [{ id: SHOULDER_VIDEO, start: 532 }],
  "Behind-the-Back Cuffed Lateral Raise": [{ id: SHOULDER_VIDEO, start: 545 }],
  "Reverse Pec Deck": [{ id: SHOULDER_VIDEO, start: 626 }],
  "Reverse Cable Crossover": [{ id: SHOULDER_VIDEO, start: 718 }],
  "Chest-Supported Lateral Raise": [{ id: "zOQxJm7sEAg" }],
  "Cable Hip Abduction": [{ id: "3ryh7PNhz3E", start: 500 }],
  "Side-Lying Hip Abduction": [{ id: "s6lDpy4AO6w" }],
  // Jeff Nippard's back-exercise ranking, each starting at that exercise's chapter.
  "Wide-Grip Lat Pulldown": [{ id: BACK_VIDEO, start: 218 }],
  "Neutral-Grip Pulldown": [{ id: BACK_VIDEO, start: 239 }],
  "Half-Kneeling One-Arm Cable Pulldown": [{ id: BACK_VIDEO, start: 248 }],
  "Meadows Row": [{ id: BACK_VIDEO, start: 388 }],
  "Chest-Supported T-Bar Row": [{ id: BACK_VIDEO, start: 533 }],
  "Chest-Supported Dumbbell Row (Helms Row)": [{ id: BACK_VIDEO, start: 533 }],
  "Seated Cable Row": [{ id: BACK_VIDEO, start: 562 }],
  "Wide-Grip Cable Row": [{ id: BACK_VIDEO, start: 577 }],
  "Smith Machine Shrug": [{ id: "kJUypIT1Txo" }],
};
