"use client";

import { useEffect, useState } from "react";
import { RESUME_WARNING, painHold, resumeProgression } from "@/lib/review/pain";

/**
 * Status of the pain hold and the only way to lift it: an explicit confirmation, worded so it
 * can't be mistaken for medical clearance. Renders nothing when progression isn't held.
 */
export function PainHoldControl({ compact = false }: { compact?: boolean }) {
  const [hold, setHold] = useState(() => painHold());
  const [asking, setAsking] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const refresh = () => setHold(painHold());
    window.addEventListener("ags:progression-resumed", refresh);
    window.addEventListener("ags:pain-reported", refresh);
    return () => {
      window.removeEventListener("ags:progression-resumed", refresh);
      window.removeEventListener("ags:pain-reported", refresh);
    };
  }, []);

  if (done)
    return (
      <p role="status" className="mt-1.5 text-xs text-zinc-300">
        Progression suggestions are back on from your next workout. Today&apos;s boxes stay as they are.
      </p>
    );
  if (!hold.held) return null;
  const since = new Date(hold.since!).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div aria-label="Progression hold" className={compact ? "mt-1.5" : "mt-2 rounded-lg border border-amber-300/30 bg-amber-300/5 p-2.5"}>
      {!compact && <p className="text-xs text-amber-100">Weight and rep increases are paused since you reported pain on {since}. They stay paused until you turn them back on.</p>}
      {!asking ? (
        <button type="button" onClick={() => setAsking(true)} className="mt-1 text-xs font-semibold text-amber-200 underline underline-offset-2">
          Resume progression suggestions…
        </button>
      ) : (
        <div role="group" aria-label="Confirm resuming progression" className="mt-1.5 rounded-lg bg-zinc-900 p-2.5 text-xs text-zinc-200">
          <p>{RESUME_WARNING}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                resumeProgression();
                setAsking(false);
                setDone(true);
              }}
              className="h-9 rounded-full bg-amber-300 px-3 font-semibold text-zinc-950"
            >
              Resume suggestions
            </button>
            <button type="button" onClick={() => setAsking(false)} className="h-9 rounded-full border border-zinc-600 px-3 font-semibold">
              Keep holding
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
