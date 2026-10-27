"use client";

// A simple front/back body made of muscle shapes; worked muscles light up in lime.
// Shapes are drawn for the left side only and mirrored for the right.

type Shape = { muscle?: string; d: string }; // no muscle = neutral (head, hands, knees…)

const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0 Z`;

const DELT = "M38,32 C31,32 26,37 26,45 L33,46 C34,41 36,37 41,35 Z";
const UPPER_ARM = "M26,47 L33,47 C34,53 33,58 31,63 L25,63 C24,57 24,51 26,47 Z";
const FOREARM = "M24.5,65 L31,65 C31,72 29.5,79 27.5,86 L22.5,86 C21.5,79 22.5,71 24.5,65 Z";
const HAND = ellipse(25, 90.5, 3.2, 4.2);
const KNEE = ellipse(42.5, 131.5, 4, 3);
const FOOT = ellipse(42, 175, 4.5, 2.5);

// Shared midline pieces are drawn once (no mirroring).
const FRONT_MID: Shape[] = [
  { d: ellipse(50, 14, 8.5, 9.5) },
  { d: "M45,23 L55,23 L56,30 L44,30 Z" },
];
const FRONT_SIDE: Shape[] = [
  { muscle: "traps", d: "M44,28 L37.5,32 L44,32.5 Z" },
  { muscle: "shoulders", d: DELT },
  { muscle: "chest", d: "M41.5,33 L49.5,33 L49.5,49 C44,51 38.5,49.5 35,45.5 C35,40 37,35.5 41.5,33 Z" },
  { muscle: "biceps", d: UPPER_ARM },
  { muscle: "forearms", d: FOREARM },
  { d: HAND },
  { muscle: "abdominals", d: "M44,51.5 L49.5,51.5 L49.5,58 L44,58 Z" },
  { muscle: "abdominals", d: "M44,59.5 L49.5,59.5 L49.5,66 L44,66 Z" },
  { muscle: "abdominals", d: "M44,67.5 L49.5,67.5 L49.5,74 L44,74 Z" },
  { muscle: "abdominals", d: "M44,75.5 L49.5,75.5 L49.5,86 C47,85 45,82 44,79 Z" },
  { muscle: "abdominals", d: "M36.5,50 L42.5,52 L42.5,80 C39.5,77 37.5,71 36.5,64 Z" },
  { muscle: "abductors", d: "M36,82 C34,87 34,93 35,98 L38.5,95 L39.5,85 Z" },
  { muscle: "quadriceps", d: "M40,85 L46.5,89 C47.5,100 48,112 47,124 C44.5,129 40.5,129 38.5,126 C35.5,116 35.5,99 40,85 Z" },
  { muscle: "adductors", d: "M48,88 L49.5,88 L49.5,110 C48.8,104 48.3,96 48,88 Z" },
  { d: KNEE },
  { muscle: "calves", d: "M38.5,136 C40.5,134 45,134 46.5,137 C46.5,150 44.5,161 43.5,169 L40.5,169 C38.5,159 37.5,147 38.5,136 Z" },
  { d: FOOT },
];

const BACK_MID: Shape[] = [
  { d: ellipse(50, 14, 8.5, 9.5) },
  { muscle: "middle back", d: "M44,38 L50,50 L56,38 L57,56 L50,61 L43,56 Z" },
  { muscle: "traps", d: "M50,23 L45,28 L36,33 L44.5,36 L50,52 L55.5,36 L64,33 L55,28 Z" },
];
const BACK_SIDE: Shape[] = [
  { muscle: "shoulders", d: DELT },
  { muscle: "lats", d: "M37.5,40 L43,37.5 L47.5,57 L46,73 C42,70.5 39,64.5 37,57 C36,51 36,45 37.5,40 Z" },
  { muscle: "triceps", d: UPPER_ARM },
  { muscle: "forearms", d: FOREARM },
  { d: HAND },
  { muscle: "lower back", d: "M45,62.5 L49.5,61.5 L49.5,81 L45,81 Z" },
  { muscle: "glutes", d: "M37.5,82 C42,80 48,81.5 49.5,85.5 L49.5,98 C45,102 39.5,100.5 37.5,96.5 C35.5,92 35.5,86 37.5,82 Z" },
  { muscle: "hamstrings", d: "M38,101.5 C42,103.5 46.5,103.5 48,103 C48,113 47,122 46,128 L39,128 C37,120 37,110 38,101.5 Z" },
  { d: KNEE },
  { muscle: "calves", d: "M38,134 C41,132 46,132 47,136 C47,146 45,156 43.5,166 L40,166 C37.5,156 36.5,144 38,134 Z" },
  { d: FOOT },
];

const LIME = "#c6f432";

function fill(muscle: string | undefined, primary: Set<string>, secondary: Set<string>) {
  if (!muscle) return { fill: "#27272a", opacity: 1 };
  if (primary.has(muscle)) return { fill: LIME, opacity: 1 };
  if (secondary.has(muscle)) return { fill: LIME, opacity: 0.4 };
  return { fill: "#3f3f46", opacity: 1 };
}

function Figure({ mid, side, x, primary, secondary }: { mid: Shape[]; side: Shape[]; x: number; primary: Set<string>; secondary: Set<string> }) {
  const draw = (s: Shape, i: number) => {
    const f = fill(s.muscle, primary, secondary);
    return <path key={i} d={s.d} fill={f.fill} fillOpacity={f.opacity} stroke="#000" strokeWidth="0.8" strokeLinejoin="round" />;
  };
  return (
    <g transform={`translate(${x},0)`}>
      {mid.slice(0, 1).map(draw)}
      {side.map(draw)}
      <g transform="translate(100,0) scale(-1,1)">{side.map(draw)}</g>
      {mid.slice(1).map((s, i) => draw(s, i + 100))}
    </g>
  );
}

const LABEL: Record<string, string> = {
  abdominals: "Abs",
  abductors: "Outer hips",
  adductors: "Inner thighs",
  "lower back": "Lower back",
  "middle back": "Mid back",
  quadriceps: "Quads",
  shoulders: "Delts",
};
export const muscleLabel = (m: string) => LABEL[m] ?? m.charAt(0).toUpperCase() + m.slice(1);

export function MuscleMap({
  primary,
  secondary,
  caption,
  compact = false,
}: {
  primary: Set<string>;
  secondary: Set<string>;
  caption?: string;
  compact?: boolean;
}) {
  const worked = [...primary].map(muscleLabel);
  return (
    <figure className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
      <svg viewBox="0 0 210 186" className={`mx-auto block w-full ${compact ? "max-w-[12.5rem]" : "max-w-[19rem]"}`} role="img" aria-label={`Muscles worked: ${worked.join(", ") || "none yet"}`}>
        <Figure mid={FRONT_MID} side={FRONT_SIDE} x={0} primary={primary} secondary={secondary} />
        <Figure mid={BACK_MID} side={BACK_SIDE} x={110} primary={primary} secondary={secondary} />
        <text x="50" y="185" textAnchor="middle" fill="#71717a" fontSize="7">Front</text>
        <text x="160" y="185" textAnchor="middle" fill="#71717a" fontSize="7">Back</text>
      </svg>
      <figcaption className="mt-2 text-center text-xs text-zinc-400">
        {caption && <span className="block text-zinc-300">{caption}</span>}
        {worked.length ? (
          <>
            <span className="font-semibold text-lime-300">{worked.join(" · ")}</span>
            {secondary.size > 0 && <span className="text-zinc-500"> · faded = helping muscles</span>}
          </>
        ) : (
          "No muscles trained yet"
        )}
      </figcaption>
    </figure>
  );
}
