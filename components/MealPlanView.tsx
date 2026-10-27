"use client";

import { useRef, useState } from "react";
import {
  MEALS,
  PHASES,
  kcalOf,
  loadEaten,
  loadPhase,
  saveEaten,
  savePhase,
  type FoodKind,
  type MealId,
  type MealPhase,
  type Macros,
} from "@/lib/meals";
import { loadCronometer, parseCronometerDaily, saveCronometer, type DayTotals } from "@/lib/cronometer";
import { todayStr } from "@/lib/habits";
import { AccentLast, TITLE } from "@/components/ui";

const KIND_STYLE: Record<FoodKind, { tag: string; className: string }> = {
  P: { tag: "Protein", className: "bg-rose-400/15 text-rose-200" },
  F: { tag: "Fiber", className: "bg-lime-400/15 text-lime-200" },
  C: { tag: "Carbs", className: "bg-amber-400/15 text-amber-200" },
  note: { tag: "Psyllium", className: "bg-sky-400/15 text-sky-200" },
};

const shortDate = (d: string) => new Date(d + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function MealPlanView({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<MealPhase>(loadPhase);
  const [eaten, setEaten] = useState(loadEaten);
  const [cron, setCron] = useState<DayTotals[]>(loadCronometer);
  const [importMsg, setImportMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const today = todayStr();
  const todayEaten = eaten[today] ?? {};
  const macros = PHASES[phase].macros;
  const meals = MEALS[phase];
  const eatenCount = meals.filter((m) => todayEaten[m.id]).length;

  function choosePhase(p: MealPhase) {
    setPhase(p);
    savePhase(p);
  }

  function toggleMeal(id: MealId) {
    const next = { ...eaten, [today]: { ...todayEaten, [id]: !todayEaten[id] } };
    setEaten(next);
    saveEaten(next);
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const result = parseCronometerDaily(await file.text());
    if ("error" in result) return setImportMsg({ text: result.error, ok: false });
    setCron(saveCronometer(result.days));
    setImportMsg({ text: `Imported ${result.days.length} day${result.days.length === 1 ? "" : "s"} from Cronometer.`, ok: true });
  }

  return (
    <section className="mt-2">
      <h1 className={TITLE}><AccentLast text="Meal plan" /></h1>
      <p className="mt-1 text-sm text-zinc-400">
        Every meal in PFC order: protein first, fiber second, carbs last. {eatenCount}/{meals.length} eaten today.
      </p>

      <div role="group" aria-label="Nutrition phase" className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-zinc-800 p-1">
        {(Object.keys(PHASES) as MealPhase[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => choosePhase(p)}
            aria-pressed={phase === p}
            className={`h-10 rounded-lg text-sm font-semibold transition ${
              phase === p ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            {PHASES[p].label} · {PHASES[p].macros.carbs} g net carbs
          </button>
        ))}
      </div>

      <MacroTargets macros={macros} />

      <ol className="mt-4 grid grid-cols-1 gap-3">
        {meals.map((meal) => {
          const done = !!todayEaten[meal.id];
          return (
            <li key={meal.id} className={`rounded-2xl border bg-zinc-900 p-4 ${done ? "border-lime-400/50" : "border-zinc-800"}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{meal.when}</p>
              <p className="mt-0.5 font-semibold">{meal.title}</p>
              <ol className="mt-3 grid gap-1.5">
                {meal.foods.map((food, i) => (
                  <li key={food.text} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-0.5 w-4 shrink-0 text-right text-xs font-semibold tabular-nums text-zinc-500">{i + 1}</span>
                    <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${KIND_STYLE[food.kind].className}`}>
                      {KIND_STYLE[food.kind].tag}
                    </span>
                    <span className="text-zinc-200">{food.text}</span>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={() => toggleMeal(meal.id)}
                aria-pressed={done}
                className={`mt-3 h-11 w-full rounded-xl text-sm font-semibold transition active:scale-[0.98] ${
                  done ? "bg-lime-400 text-zinc-950" : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                }`}
              >
                {done ? "✓ Eaten" : "Mark eaten"}
              </button>
            </li>
          );
        })}
      </ol>

      <section className="mt-7 rounded-2xl border border-orange-400/30 bg-zinc-900 p-4">
        <p className="font-semibold">Compare with Cronometer</p>
        <p className="mt-1 text-sm text-zinc-400">
          Cronometer has no public connection for other apps, so this uses its export. In Cronometer on the web, open
          your account settings → <b>Export Data</b> → <b>Daily Nutrition</b>, then import the CSV here.
        </p>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={onImport} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-3 h-11 w-full rounded-xl bg-orange-400 text-sm font-semibold text-zinc-950 transition hover:bg-orange-300 active:scale-[0.98]"
        >
          Import Cronometer CSV
        </button>
        {importMsg && (
          <p role="status" className={`mt-2 text-sm ${importMsg.ok ? "text-lime-300" : "text-amber-300"}`}>
            {importMsg.text}
          </p>
        )}
        {cron.length > 0 && <CronometerTable days={cron.slice(0, 14)} target={macros} />}
      </section>

      <button
        type="button"
        onClick={onBack}
        className="mt-6 h-12 w-full rounded-xl bg-zinc-800 text-base font-semibold text-zinc-100 transition hover:bg-zinc-700 active:scale-[0.98]"
      >
        Back
      </button>
    </section>
  );
}

function MacroTargets({ macros }: { macros: Macros }) {
  const items = [
    { label: "Protein", value: macros.protein, className: "text-rose-200" },
    { label: "Net carbs", value: macros.carbs, className: "text-amber-200" },
    { label: "Fat", value: macros.fat, className: "text-lime-200" },
  ];
  return (
    <div className="mt-3 grid grid-cols-4 gap-2 text-center">
      {items.map((m) => (
        <div key={m.label} className="rounded-xl border border-zinc-800 bg-zinc-900 py-2.5">
          <p className={`text-lg font-bold tabular-nums ${m.className}`}>{m.value} g</p>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">{m.label}</p>
        </div>
      ))}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 py-2.5">
        <p className="text-lg font-bold tabular-nums">≈{kcalOf(macros).toLocaleString()}</p>
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">kcal</p>
      </div>
    </div>
  );
}

/**
 * Actual vs target; within ±10% of target counts as on track. On a day Cronometer marks as not
 * completed, being under target is expected (meals still to log), so it isn't flagged.
 */
function CronometerTable({ days, target }: { days: DayTotals[]; target: Macros }) {
  const cell = (actual: number | null, goal: number, inProgress: boolean) => {
    if (actual == null) return <span className="text-zinc-600">—</span>;
    const off = (actual - goal) / goal;
    const tone =
      Math.abs(off) <= 0.1 ? "text-lime-300" : off > 0 ? "text-amber-300" : inProgress ? "text-zinc-300" : "text-sky-300";
    return <span className={`font-semibold tabular-nums ${tone}`}>{Math.round(actual)}</span>;
  };
  return (
    <div className="mt-4">
      <div className="grid grid-cols-[1fr_3rem_3rem_3rem_3.5rem] gap-x-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        <span>Day</span>
        <span className="text-right">P</span>
        <span className="text-right">Net C</span>
        <span className="text-right">F</span>
        <span className="text-right">kcal</span>
      </div>
      <div className="mt-1 grid grid-cols-[1fr_3rem_3rem_3rem_3.5rem] gap-x-2 rounded-lg bg-zinc-800/60 px-1 py-1.5 text-xs text-zinc-400">
        <span>Target</span>
        <span className="text-right tabular-nums">{target.protein}</span>
        <span className="text-right tabular-nums">{target.carbs}</span>
        <span className="text-right tabular-nums">{target.fat}</span>
        <span className="text-right tabular-nums">{kcalOf(target).toLocaleString()}</span>
      </div>
      <ul className="mt-1 grid gap-0.5">
        {days.map((d) => {
          const inProgress = d.completed === false;
          return (
            <li key={d.date} className="grid grid-cols-[1fr_3rem_3rem_3rem_3.5rem] items-center gap-x-2 px-1 py-1.5 text-sm">
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-zinc-300">{shortDate(d.date)}</span>
                {inProgress && <span className="block text-[10px] text-zinc-500">in progress</span>}
              </span>
              <span className="text-right">{cell(d.protein, target.protein, inProgress)}</span>
              {/* Targets are net carbs (Cronometer is set to net); older imports may only have total. */}
              <span className="text-right">{cell(d.netCarbs ?? d.carbs, target.carbs, inProgress)}</span>
              <span className="text-right">{cell(d.fat, target.fat, inProgress)}</span>
              <span className="text-right">{cell(d.kcal, kcalOf(target), inProgress)}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-zinc-500">
        <span className="text-lime-300">Green</span> within 10% of target · <span className="text-sky-300">blue</span> under ·{" "}
        <span className="text-amber-300">amber</span> over. Days still being logged in Cronometer show “in progress”. Carbs
        are net carbs (total minus fiber), matching Cronometer.
      </p>
    </div>
  );
}
