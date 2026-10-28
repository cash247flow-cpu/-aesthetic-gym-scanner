"use client";

import { useState } from "react";
import { CardioCard, DEFAULT_CARDIO, type CardioPlan } from "@/components/CardioCard";
import { loadUnit } from "@/components/SetLogger";
import { Celebrate } from "@/components/Celebrate";
import { finishWorkout, type Summary } from "@/lib/wins";
import type { MakeupFor } from "@/lib/missed";
import { AccentLast, TITLE } from "@/components/ui";

// Cardio-only days keep their own machine/duration, separate from cardio added to a lifting day.
// v2: starts from the plan's StairMaster default rather than older saved settings.
const SOLO_KEY = "ags:cardio:solo:v2";
const DEFAULT_PLAN: CardioPlan = DEFAULT_CARDIO;

function loadSoloPlan(): CardioPlan {
  try {
    const raw = localStorage.getItem(SOLO_KEY);
    return raw ? { ...DEFAULT_PLAN, ...(JSON.parse(raw) as Partial<CardioPlan>) } : DEFAULT_PLAN;
  } catch {
    return DEFAULT_PLAN;
  }
}

function saveSoloPlan(plan: CardioPlan) {
  try {
    localStorage.setItem(SOLO_KEY, JSON.stringify(plan));
  } catch {
    /* ignore */
  }
}

export function CardioSession({
  onBack,
  onShowWins,
  makeup,
}: {
  onBack: () => void;
  onShowWins: () => void;
  makeup?: MakeupFor; // set when this cardio makes up a missed day
}) {
  const [plan, setPlan] = useState<CardioPlan>(loadSoloPlan);
  const [unit] = useState(loadUnit);
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  function celebrate() {
    setSummary(
      finishWorkout({ session: "Cardio Day", label: "Cardio Day", exercises: [], unit, includeCardio: true, makeupFor: makeup?.date }),
    );
  }

  function change(next: CardioPlan) {
    setPlan(next);
    saveSoloPlan(next);
  }

  return (
    <section className="mt-2">
      <header>
        {makeup && (
          <p className="mb-1 inline-block rounded-full bg-amber-400/15 px-2.5 py-0.5 text-xs font-semibold text-amber-200">
            ↺ Make-up for {makeup.label}
          </p>
        )}
        <h1 className={TITLE}><AccentLast text="Cardio Day" /></h1>
        <p className="mt-1 text-sm text-zinc-400">
          {done ? "Cardio complete 💪" : "Pick a machine and a duration, then hit Start."}
        </p>
      </header>

      <div className="mt-5">
        <CardioCard
          standalone
          plan={plan}
          unit={unit}
          onChange={change}
          onRemove={onBack}
          onDone={() => {
            setDone(true);
            setTimeout(celebrate, 900);
          }}
          onFinishedChange={setDone}
        />
      </div>

      {done && (
        <button
          type="button"
          onClick={celebrate}
          className="mt-6 h-12 w-full rounded-xl border border-sky-400/60 text-base font-semibold text-sky-300 transition hover:bg-sky-400/10 active:scale-[0.98]"
        >
          🏆 See today&apos;s wins
        </button>
      )}

      <button
        type="button"
        onClick={onBack}
        className="mt-3 h-12 w-full rounded-xl bg-zinc-800 text-base font-semibold text-zinc-100 transition hover:bg-zinc-700 active:scale-[0.98]"
      >
        Back to sessions
      </button>

      {summary && <Celebrate summary={summary} unit={unit} onClose={() => setSummary(null)} onSeeAll={onShowWins} />}
    </section>
  );
}
