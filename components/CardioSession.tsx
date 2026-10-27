"use client";

import { useState } from "react";
import { CardioCard, type CardioPlan } from "@/components/CardioCard";
import { loadUnit } from "@/components/SetLogger";

// Cardio-only days keep their own machine/duration, separate from cardio added to a lifting day.
const SOLO_KEY = "ags:cardio:solo";
const DEFAULT_PLAN: CardioPlan = { position: "after", machine: "treadmill", minutes: 20 };

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

export function CardioSession({ onBack }: { onBack: () => void }) {
  const [plan, setPlan] = useState<CardioPlan>(loadSoloPlan);
  const [unit] = useState(loadUnit);
  const [done, setDone] = useState(false);

  function change(next: CardioPlan) {
    setPlan(next);
    saveSoloPlan(next);
  }

  return (
    <section className="mt-2">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Cardio Day</h1>
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
          onDone={() => setDone(true)}
          onFinishedChange={setDone}
        />
      </div>

      <button
        type="button"
        onClick={onBack}
        className="mt-6 h-12 w-full rounded-xl bg-zinc-800 text-base font-semibold text-zinc-100 transition hover:bg-zinc-700 active:scale-[0.98]"
      >
        Back to sessions
      </button>
    </section>
  );
}
