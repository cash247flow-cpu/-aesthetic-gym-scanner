"use client";

// Front and back body figures (male or female) made of muscle shapes; worked muscles light up in lime.
// Artwork: lib/bodyArt.ts (react-native-body-highlighter, MIT).

import { useEffect, useState } from "react";
import { BODY_ART, type BodySex, type BodyView } from "@/lib/bodyArt";
import { loadBodyFigure, saveBodyFigure } from "@/lib/bodyFigure";

const LIME = "#c6f432";
const MUSCLE = "#52525b"; // zinc-600
const JOINT = "#3f3f46"; // head, hands, feet, knees: zinc-700
const OTHER = "#46464d"; // drawn but not tracked (shins)
const GAP = "#09090b"; // the card's background, so shapes read as separate muscles

type Pick = { selected?: string | null; onPick?: (muscle: string) => void };

function View({ view, label, primary, secondary, selected, onPick }: { view: BodyView; label: string; primary: Set<string>; secondary: Set<string> } & Pick) {
  return (
    <figure className="m-0 min-w-0 flex-1">
      <svg viewBox={view.viewBox} className="block h-auto w-full" aria-hidden>
        {view.shapes.map((s, i) => {
          const muscle = s.m;
          const on = !!muscle && primary.has(muscle);
          const helping = !!muscle && !on && secondary.has(muscle);
          const picked = !!muscle && muscle === selected;
          return (
            <path
              key={i}
              d={s.d}
              data-muscle={muscle}
              fill={on || helping ? LIME : muscle ? MUSCLE : s.n ? JOINT : OTHER}
              fillOpacity={helping ? 0.4 : 1}
              stroke={picked ? "#ecfccb" : GAP}
              strokeWidth={picked ? 2.5 : 1.5}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              onClick={onPick && muscle ? () => onPick(muscle) : undefined}
              className={`motion-safe:transition-[fill,fill-opacity] motion-safe:duration-500 ${onPick && muscle ? "cursor-pointer" : ""}`}
            />
          );
        })}
        <path d={view.outline} fill="none" stroke="#71717a" strokeOpacity={0.6} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="mt-1 text-center text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</figcaption>
    </figure>
  );
}

/** The saved Male/Female choice, read after mount (browser-only). */
export function useBodyFigure(): [BodySex, (sex: BodySex) => void] {
  const [sex, setSex] = useState<BodySex>("male");
  useEffect(() => setSex(loadBodyFigure()), []);
  const change = (next: BodySex) => {
    setSex(next);
    saveBodyFigure(next);
  };
  return [sex, change];
}

export function FigureToggle({ sex, onChange }: { sex: BodySex; onChange: (sex: BodySex) => void }) {
  return (
    <div role="group" aria-label="Body figure" className="inline-flex rounded-full bg-zinc-800 p-0.5 text-xs font-semibold">
      {(["male", "female"] as const).map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={sex === s}
          onClick={() => onChange(s)}
          className={`rounded-full px-3 py-1 transition ${sex === s ? "bg-zinc-100 text-zinc-950" : "text-zinc-400 hover:text-zinc-200"}`}
        >
          {s === "male" ? "Male" : "Female"}
        </button>
      ))}
    </div>
  );
}

/** The front and back figures on their own. With onPick, each muscle can be tapped. */
export function BodyFigures({
  primary,
  secondary,
  label,
  className,
  selected,
  onPick,
  sex = "male",
}: { primary: Set<string>; secondary: Set<string>; label: string; className?: string; sex?: BodySex } & Pick) {
  const art = BODY_ART[sex];
  return (
    <div role="img" aria-label={label} data-figure={sex} className={`flex items-end gap-3 ${className ?? ""}`}>
      <View view={art.front} label="Front" primary={primary} secondary={secondary} selected={selected} onPick={onPick} />
      <View view={art.back} label="Back" primary={primary} secondary={secondary} selected={selected} onPick={onPick} />
    </div>
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
  toggle = false,
}: {
  primary: Set<string>;
  secondary: Set<string>;
  caption?: string;
  compact?: boolean;
  /** Show the Male/Female switch on the card. */
  toggle?: boolean;
}) {
  const [sex, setSex] = useBodyFigure();
  const worked = [...primary].map(muscleLabel);
  return (
    <figure className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
      {toggle && (
        <div className="mb-2">
          <FigureToggle sex={sex} onChange={setSex} />
        </div>
      )}
      <BodyFigures
        sex={sex}
        primary={primary}
        secondary={secondary}
        label={`Muscles worked: ${worked.join(", ") || "none yet"}`}
        className={`mx-auto w-full ${compact ? "max-w-[12.5rem]" : "max-w-[19rem]"}`}
      />
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
