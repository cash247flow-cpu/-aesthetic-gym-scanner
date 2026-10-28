"use client";

import { useRef, useState } from "react";
import {
  DEFAULT_TARGETS,
  MEALS,
  PHASES,
  kcalOf,
  loadEaten,
  loadPhase,
  loadTargets,
  sameMacros,
  saveEaten,
  savePhase,
  saveTargets,
  type Targets,
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
  const [targets, setTargets] = useState<Targets>(loadTargets);
  const macros = targets[phase];
  const meals = MEALS[phase];
  const eatenCount = meals.filter((m) => todayEaten[m.id]).length;

  function choosePhase(p: MealPhase) {
    setPhase(p);
    savePhase(p);
  }

  function changeTargets(next: Macros | null) {
    const all = { ...targets, [phase]: next ?? DEFAULT_TARGETS[phase] };
    setTargets(all);
    const isDefault = (Object.keys(all) as MealPhase[]).every((p) => sameMacros(all[p], DEFAULT_TARGETS[p]));
    saveTargets(isDefault ? null : all);
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
            {PHASES[p].label} · {targets[p].carbs} g net carbs
          </button>
        ))}
      </div>

      <MacroTargets
        macros={macros}
        phaseLabel={PHASES[phase].label}
        isDefault={sameMacros(macros, DEFAULT_TARGETS[phase])}
        onChange={changeTargets}
      />

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

const MACRO_FIELDS: { key: keyof Macros; label: string; className: string }[] = [
  { key: "protein", label: "Protein", className: "text-rose-200" },
  { key: "carbs", label: "Net carbs", className: "text-amber-200" },
  { key: "fat", label: "Fat", className: "text-lime-200" },
];

/** Daily targets for the chosen phase, with an editor so each person sets their own. */
function MacroTargets({
  macros,
  phaseLabel,
  isDefault,
  onChange,
}: {
  macros: Macros;
  phaseLabel: string;
  isDefault: boolean;
  onChange: (next: Macros | null) => void;
}) {
  const [draft, setDraft] = useState<Record<keyof Macros, string> | null>(null);

  if (draft) {
    const parsed = Object.fromEntries(MACRO_FIELDS.map((f) => [f.key, Number(draft[f.key])])) as Macros;
    const valid = MACRO_FIELDS.every((f) => draft[f.key].trim() !== "" && parsed[f.key] <= 1000);
    return (
      <form
        className="mt-3 rounded-2xl border border-lime-400/40 bg-zinc-900 p-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          onChange(parsed);
          setDraft(null);
        }}
      >
        <p className="text-sm font-semibold">Your daily targets · {phaseLabel}</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {MACRO_FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${f.className}`}>{f.label} (g)</span>
              <input
                inputMode="numeric"
                aria-label={`${f.label} grams`}
                value={draft[f.key]}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                className="mt-1 h-11 w-full rounded-lg bg-zinc-800 text-center text-base tabular-nums text-zinc-100 focus:outline-none focus:ring-2 focus:ring-lime-400"
              />
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          ≈ <span className="font-semibold text-zinc-200">{valid ? kcalOf(parsed).toLocaleString() : "—"} kcal</span>, worked out
          from your macros (protein and carbs 4 kcal/g, fat 9 kcal/g). Carbs are net carbs, like Cronometer.
        </p>
        <div className="mt-3 flex gap-2">
          <button type="submit" disabled={!valid} className="h-10 flex-1 rounded-lg bg-lime-400 text-sm font-semibold text-zinc-950 disabled:opacity-40">
            Save targets
          </button>
          <button type="button" onClick={() => setDraft(null)} className="h-10 rounded-lg px-3 text-sm text-zinc-400 hover:text-zinc-100">
            Cancel
          </button>
        </div>
        {!isDefault && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setDraft(null);
            }}
            className="mt-2 text-xs text-zinc-500 hover:text-zinc-300"
          >
            Reset to the plan&apos;s defaults
          </button>
        )}
      </form>
    );
  }

  return (
    <>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        {MACRO_FIELDS.map((f) => (
          <div key={f.key} className="rounded-xl border border-zinc-800 bg-zinc-900 py-2.5">
            <p className={`text-lg font-bold tabular-nums ${f.className}`}>{macros[f.key]} g</p>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">{f.label}</p>
          </div>
        ))}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 py-2.5">
          <p className="text-lg font-bold tabular-nums">≈{kcalOf(macros).toLocaleString()}</p>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">kcal</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setDraft({ protein: String(macros.protein), carbs: String(macros.carbs), fat: String(macros.fat) })}
        className="mt-1.5 px-1 text-xs font-semibold text-lime-300/90 hover:text-lime-200"
      >
        ✎ Edit my targets{isDefault ? " (using the plan's defaults)" : ""}
      </button>
    </>
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
