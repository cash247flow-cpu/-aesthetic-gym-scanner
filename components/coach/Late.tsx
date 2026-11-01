"use client";

// "I'm working late" check-in. Optional, user-led, and never diagnostic: it offers one concrete
// next step. No restriction, compensation or exercise-as-punishment is ever suggested.

import { useState } from "react";
import type { Today } from "@/lib/nutrition/today";
import type { InventoryItem } from "@/lib/nutrition/inventory";
import type { Hunger } from "@/lib/nutrition/suggest";
import { KEYS, localDate, readJson, writeJson } from "@/lib/nutrition/store";
import { BTN, BTN2, CARD, INPUT, LABEL, Note } from "./ui";
import { TodaySummary } from "./Eat";

const STEPS = [
  { key: "meal", label: "Choose a simple meal" },
  { key: "prep", label: "Prepare tomorrow's food" },
  { key: "groceries", label: "Update groceries" },
  { key: "stop", label: "Choose a stopping time" },
] as const;

type Stop = { date: string; time: string } | null;
const parseStop = (raw: unknown): Stop =>
  raw && typeof raw === "object" && typeof (raw as Stop)!.date === "string" && /^\d{2}:\d{2}$/.test(String((raw as Stop)!.time)) ? (raw as Stop) : null;

export function LateCheckIn({ today, inventory, onMeal, onGroceries, onFridge, onMealPlan }: {
  today: Today;
  inventory: InventoryItem[];
  onMeal: (hunger: Hunger) => void;
  onGroceries: () => void;
  onFridge: () => void;
  onMealPlan: () => void;
}) {
  const [hunger, setHunger] = useState<Hunger>(2);
  const [sleep, setSleep] = useState("");
  const [step, setStep] = useState<(typeof STEPS)[number]["key"] | null>(null);
  const saved = readJson(KEYS.stopTime, parseStop);
  const [stop, setStop] = useState(saved?.date === localDate() ? saved.time : "23:00");
  const [stopSaved, setStopSaved] = useState(saved?.date === localDate());
  const over = today.remaining !== null && today.remaining.kcal <= 0;
  const sleepHours = Number(sleep);

  return (
    <div>
      <section className={`${CARD} mt-4`}>
        <p className="text-lg font-semibold leading-snug">Working late? Let&apos;s choose something easy before hunger makes the decision harder.</p>
        <p className="mt-1 text-sm text-zinc-400">
          What food do you have available?{" "}
          {inventory.length ? (
            <>
              You&apos;ve saved {inventory.length} item{inventory.length === 1 ? "" : "s"}.{" "}
            </>
          ) : (
            <>Nothing saved yet. </>
          )}
          <button type="button" className="font-semibold text-lime-300 underline" onClick={onFridge}>
            {inventory.length ? "Update it" : "Add what you have"}
          </button>
        </p>
      </section>
      <TodaySummary today={today} />
      {over && (
        <div className="mt-3">
          <Note>
            You&apos;re past today&apos;s calorie target — that happens, especially on long days. The next reasonable step is what matters: if you&apos;re hungry, choose something modest and protein-forward. Tomorrow starts from your normal targets; there&apos;s nothing to make up.
          </Note>
        </div>
      )}
      <section aria-label="Check-in" className={`${CARD} mt-3 grid grid-cols-1 gap-3`}>
        <fieldset>
          <legend className={LABEL}>How hungry are you?</legend>
          <div className="mt-1.5 flex gap-1.5">
            {([1, 2, 3] as Hunger[]).map((h) => (
              <button key={h} type="button" aria-pressed={hunger === h} onClick={() => setHunger(h)} className={`h-10 flex-1 rounded-full border text-sm font-semibold ${hunger === h ? "border-lime-400 bg-lime-400/10 text-lime-200" : "border-zinc-700 text-zinc-300"}`}>
                {h === 1 ? "A bit" : h === 2 ? "Hungry" : "Very hungry"}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="grid grid-cols-1 gap-1">
          <span className={LABEL}>Sleep last night (optional, hours)</span>
          <input inputMode="decimal" value={sleep} onChange={(e) => setSleep(e.target.value)} placeholder="e.g. 6" className={`${INPUT} w-28`} />
        </label>
        {sleep && Number.isFinite(sleepHours) && sleepHours > 0 && sleepHours < 7 && (
          <p className="text-xs text-zinc-400">Noted. Choosing a stopping time tonight can make tomorrow a little easier.</p>
        )}
      </section>

      <h2 className={`${LABEL} mt-5`}>Pick one next step</h2>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {STEPS.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={step === s.key}
            onClick={() => {
              if (s.key === "meal") return onMeal(hunger);
              if (s.key === "groceries") return onGroceries();
              setStep(s.key);
            }}
            className={`min-h-14 rounded-2xl border px-3 text-left text-sm font-semibold ${step === s.key ? "border-lime-400 bg-lime-400/10 text-lime-100" : "border-zinc-800 bg-zinc-900 text-zinc-200"}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {step === "prep" && (
        <section aria-label="Prepare tomorrow" className={`${CARD} mt-3 text-sm`}>
          <p className="font-semibold">Ten minutes for tomorrow</p>
          <ol className="mt-1 list-decimal pl-5 text-zinc-300">
            <li>Pick tomorrow&apos;s first meal (your plan&apos;s breakfast, or a meal idea).</li>
            <li>Portion its protein into a container, or set out what you&apos;ll cook.</li>
            <li>Put a quick backup in reach — fruit, yogurt or a can of tuna, whatever fits your list.</li>
          </ol>
          <button type="button" className={`${BTN2} mt-3`} onClick={onMealPlan}>
            Open my meal plan
          </button>
        </section>
      )}

      {step === "stop" && (
        <form
          aria-label="Stopping time"
          className={`${CARD} mt-3 grid grid-cols-1 gap-2 text-sm`}
          onSubmit={(e) => {
            e.preventDefault();
            writeJson(KEYS.stopTime, { date: localDate(), time: stop });
            setStopSaved(true);
          }}
        >
          <label className="grid grid-cols-1 gap-1">
            <span className={LABEL}>I&apos;ll stop working at</span>
            <input type="time" value={stop} onChange={(e) => { setStop(e.target.value); setStopSaved(false); }} className={`${INPUT} w-36`} />
          </label>
          <button type="submit" className={`${BTN} justify-self-start`}>
            Set it
          </button>
          {stopSaved && <Note tone="ok">Stopping at {stop} tonight. It&apos;s just for you — nothing will interrupt you.</Note>}
        </form>
      )}
    </div>
  );
}
