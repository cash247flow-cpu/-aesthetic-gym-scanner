"use client";

// "What should I eat now?" and the confirmed food log. Suggestions are computed on the phone from
// confirmed targets, today's confirmed intake and confirmed food — nothing is logged until the
// user confirms what they actually ate and how much.

import { useState } from "react";
import { FOOD_BY_KEY, matchFood, netCarbs, scale, type Per100, type RefFood } from "@/lib/nutrition/foods";
import { REF_VERSION, correctEntry, logMeal, saveLog, undoEntry, type LogEntry, type LoggedFood } from "@/lib/nutrition/log";
import { suggestMeals, type Hunger, type Suggestion } from "@/lib/nutrition/suggest";
import type { Prefs } from "@/lib/nutrition/prefs";
import type { InventoryItem } from "@/lib/nutrition/inventory";
import type { Today } from "@/lib/nutrition/today";
import { addGrocery, saveGrocery, type GroceryItem } from "@/lib/nutrition/grocery";
import { num } from "@/lib/nutrition/store";
import { BTN, BTN2, CARD, INPUT, LABEL, Note, SourceTag, macroLine } from "./ui";

const HUNGER: { v: Hunger; label: string }[] = [
  { v: 1, label: "A bit" },
  { v: 2, label: "Hungry" },
  { v: 3, label: "Very hungry" },
];

export function TodaySummary({ today }: { today: Today }) {
  const t = today.target;
  const e = today.intake.totals;
  const r = today.remaining;
  return (
    <section aria-label="Today so far" className={`${CARD} mt-4`}>
      <p className={LABEL}>Today so far</p>
      <p className="mt-1 text-sm text-zinc-200">Eaten (confirmed): {macroLine(e)}</p>
      {t && r && (
        <p className="mt-1 text-sm text-zinc-400">
          Left of your targets: ≈{Math.max(r.kcal, 0)} kcal · {Math.max(r.protein, 0)} g protein · {Math.max(r.carbs, 0)} g net carbs · {Math.max(r.fat, 0)} g fat
        </p>
      )}
      {today.intake.note && <p className="mt-2 text-xs text-zinc-500">{today.intake.note}</p>}
    </section>
  );
}

export function EatNow({
  today,
  prefs,
  inventory,
  grocery,
  onGrocery,
  log,
  onLog,
  initialHunger = 2,
  initialPrep,
  onFridge,
}: {
  today: Today;
  prefs: Prefs;
  inventory: InventoryItem[];
  grocery: GroceryItem[];
  onGrocery: (g: GroceryItem[]) => void;
  log: LogEntry[];
  onLog: (l: LogEntry[]) => void;
  initialHunger?: Hunger;
  initialPrep?: number;
  onFridge: () => void;
}) {
  const [hunger, setHunger] = useState<Hunger>(initialHunger);
  const [prep, setPrep] = useState(initialPrep ?? prefs.prepMin);
  // A snapshot: cards don't shift under you after logging; tap "Suggest" again to refresh.
  const [result, setResult] = useState<ReturnType<typeof suggestMeals> | null>(null);
  const [confirming, setConfirming] = useState<Suggestion | null>(null);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "warn"; undo?: string } | null>(null);

  function save(s: { title: string; sourceKey: string; foods: LoggedFood[] }) {
    const r = logMeal(log, s);
    if (!r.ok) {
      if (r.reason === "duplicate") setMsg({ text: `Already logged today at ${new Date(r.existing.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. Edit or undo it in today's log instead of adding it twice.`, tone: "warn" });
      else setMsg({ text: "Add at least one food with an amount.", tone: "warn" });
      return;
    }
    saveLog(r.log);
    onLog(r.log);
    setConfirming(null);
    setMsg({ text: `Logged “${r.entry.title}”. Your food list wasn't changed — update it if you used something up.`, tone: "ok", undo: r.entry.id });
  }

  function addMissing(s: Suggestion) {
    let next = grocery;
    for (const ing of s.ingredients.filter((x) => x.have === "missing")) next = addGrocery(next, { name: ing.name.replace(/\s*\(.*\)\s*$/, ""), qty: ing.grams, unit: "g", from: "meal", note: `for ${s.title}` });
    saveGrocery(next);
    onGrocery(next);
    setMsg({ text: `Added ${s.missing.join(", ")} to your grocery list.`, tone: "ok" });
  }

  return (
    <div>
      <TodaySummary today={today} />
      <section aria-label="Suggestion settings" className={`${CARD} mt-3 grid grid-cols-1 gap-3`}>
        <fieldset>
          <legend className={LABEL}>How hungry are you?</legend>
          <div className="mt-1.5 flex gap-1.5">
            {HUNGER.map((h) => (
              <button
                key={h.v}
                type="button"
                aria-pressed={hunger === h.v}
                onClick={() => setHunger(h.v)}
                className={`h-10 flex-1 rounded-full border text-sm font-semibold ${hunger === h.v ? "border-lime-400 bg-lime-400/10 text-lime-200" : "border-zinc-700 text-zinc-300"}`}
              >
                {h.label}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="grid grid-cols-1 gap-1">
          <span className={LABEL}>Time to make it</span>
          <select value={prep} onChange={(e) => setPrep(Number(e.target.value))} className={INPUT}>
            {[5, 15, 30, 45].map((m) => (
              <option key={m} value={m}>
                Up to {m} min
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={BTN} onClick={() => setResult(suggestMeals({ remaining: today.remaining, prefs, inventory, maxPrep: prep, hunger, date: today.date }))}>
          {result ? "Suggest again" : "Suggest two meals"}
        </button>
      </section>

      {msg && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Note tone={msg.tone} label="Log status">
            {msg.text}
          </Note>
          {msg.undo && (
            <button
              type="button"
              className={BTN2}
              onClick={() => {
                const next = undoEntry(log, msg.undo!);
                saveLog(next);
                onLog(next);
                setMsg({ text: "Undone — that meal is no longer in today's log.", tone: "ok" });
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}

      {result?.status === "ok" && (
        <div className="mt-4 grid grid-cols-1 gap-3">
          {!inventory.length && (
            <Note>
              You haven&apos;t saved any food yet, so these use common staples you&apos;d need to buy.{" "}
              <button type="button" className="font-semibold text-lime-300 underline" onClick={onFridge}>
                Add what you have
              </button>
            </Note>
          )}
          {result.tradeoff && <p className="text-sm text-zinc-400">{result.tradeoff}</p>}
          {result.meals.map((m, i) => (
            <MealCard key={m.key} n={i + 1} meal={m} onAte={() => setConfirming(m)} onAddMissing={() => addMissing(m)} />
          ))}
          {result.askAmounts.map((q) => (
            <Note key={q}>{q}</Note>
          ))}
          {result.excluded.length > 0 && (
            <details className="text-sm text-zinc-400">
              <summary className="cursor-pointer">Left out ({result.excluded.length})</summary>
              <ul className="mt-1 grid grid-cols-1 gap-1">
                {result.excluded.map((x) => (
                  <li key={x.name}>
                    <b className="text-zinc-300">{x.name}</b>: {x.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="text-xs text-zinc-500">Estimates use USDA FoodData Central reference values (per 100 g, in the state shown); your brand, cut, cooking and portion will differ. Values from your own label are marked.</p>
        </div>
      )}

      {confirming && <ConfirmEaten meal={confirming} onSave={save} onCancel={() => setConfirming(null)} />}

      <LogList log={log} date={today.date} onLog={onLog} />
      <LogOther onSave={save} />
    </div>
  );
}

function MealCard({ n, meal, onAte, onAddMissing }: { n: number; meal: Suggestion; onAte: () => void; onAddMissing: () => void }) {
  return (
    <article aria-label={`Suggestion ${n}: ${meal.title}`} className={CARD}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug">{meal.title}</h3>
        <span className="shrink-0 text-xs text-zinc-400">~{meal.prepMin} min</span>
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-200">
        {macroLine(meal.totals)} <SourceTag source={meal.source} />
      </p>
      <ul className="mt-2 grid grid-cols-1 gap-1 text-sm">
        {meal.ingredients.map((x) => (
          <li key={x.key} className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold text-zinc-100">{x.display}</span>
            {!x.display.toLowerCase().includes(x.name.toLowerCase().replace(/s$/, "")) && <span className="text-zinc-300">{x.name}</span>}
            {x.have === "missing" && <span className="rounded-full bg-amber-400/15 px-2 text-[11px] font-semibold text-amber-200">need to buy</span>}
          </li>
        ))}
      </ul>
      <ul className="mt-2 grid grid-cols-1 gap-1 text-sm text-zinc-400">
        {meal.why.map((w) => (
          <li key={w}>• {w}</li>
        ))}
      </ul>
      <details className="mt-2 text-sm text-zinc-300">
        <summary className="cursor-pointer font-semibold text-zinc-200">How to make it</summary>
        <ol className="mt-1 list-decimal pl-5">
          {meal.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </details>
      <details className="mt-1 text-xs text-zinc-400">
        <summary className="cursor-pointer font-semibold text-zinc-300">Where the numbers come from</summary>
        <ul className="mt-1 grid gap-0.5">
          {meal.ingredients.map((x) => {
            const ref = FOOD_BY_KEY.get(x.key);
            return (
              <li key={x.key}>
                {x.name}: {x.source === "label" ? "your label values" : `USDA FoodData Central ${x.fdcId} — “${ref?.source.description}”`}, per 100 g, {x.weighed}
                {x.netCarbsBasis === "fiber-not-reported-total-used" ? "; no fiber value reported, so net carbs = total carbs (upper bound)" : ""}.
              </li>
            );
          })}
        </ul>
        <p className="mt-1">These are still estimates: your brand, cut, cooking and portion will differ from the reference food.</p>
      </details>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={BTN} onClick={onAte}>
          I ate this
        </button>
        {meal.missing.length > 0 && (
          <button type="button" className={BTN2} onClick={onAddMissing}>
            Add missing to grocery list
          </button>
        )}
      </div>
    </article>
  );
}

/** Portions start at the suggestion; the user changes them to what they actually ate. */
function ConfirmEaten({ meal, onSave, onCancel }: { meal: Suggestion; onSave: (s: { title: string; sourceKey: string; foods: LoggedFood[] }) => void; onCancel: () => void }) {
  const [grams, setGrams] = useState<Record<string, string>>(Object.fromEntries(meal.ingredients.map((x) => [x.key, String(x.grams)])));
  const foods: LoggedFood[] = meal.ingredients
    .map((x) => {
      const g = num(grams[x.key], 0, 5000) ?? 0;
      // Same per-100 g values the suggestion used, with their source recorded on the entry.
      const f: LoggedFood = { name: x.name, grams: g, totals: scale(x.per100, g), source: x.source, fdcId: x.fdcId, weighed: x.weighed, netCarbsBasis: x.netCarbsBasis, refVersion: x.refVersion };
      return f;
    })
    .filter((f) => f.grams > 0);
  const total = foods.reduce((t, f) => ({ kcal: t.kcal + f.totals.kcal, protein: t.protein + f.totals.protein, carbs: t.carbs + f.totals.carbs, fat: t.fat + f.totals.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  return (
    <form
      aria-label="Confirm what you ate"
      className={`${CARD} mt-4 grid grid-cols-1 gap-2 border-lime-400/40`}
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ title: meal.title, sourceKey: meal.key, foods });
      }}
    >
      <h2 className="font-semibold">What did you actually eat?</h2>
      <p className="text-sm text-zinc-400">Change the grams to what you ate. Set a food to 0 if you skipped it.</p>
      {meal.ingredients.map((x) => (
        <label key={x.key} className="flex items-center gap-2 text-sm">
          <span className="min-w-0 flex-1 truncate">
            {x.name} <span className="text-xs text-zinc-500">({x.weighed})</span>
          </span>
          <input aria-label={`${x.name} grams eaten`} inputMode="decimal" value={grams[x.key]} onChange={(e) => setGrams({ ...grams, [x.key]: e.target.value })} className={`${INPUT} w-24 text-right`} />
          <span className="text-zinc-500">g</span>
        </label>
      ))}
      <p className="text-sm text-zinc-200">{macroLine(total)}</p>
      <div className="flex gap-2">
        <button type="submit" className={`${BTN} flex-1`}>
          Save to today&apos;s log
        </button>
        <button type="button" className={BTN2} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function LogList({ log, date, onLog }: { log: LogEntry[]; date: string; onLog: (l: LogEntry[]) => void }) {
  const todays = log.filter((e) => e.date === date);
  const [editing, setEditing] = useState<string | null>(null);
  if (!todays.length) return null;
  return (
    <section aria-label="Today's log" className="mt-5">
      <h2 className={LABEL}>Today&apos;s log</h2>
      <ul className="mt-2 grid grid-cols-1 gap-1.5">
        {todays.map((e) => (
          <li key={e.id} className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{e.title}</p>
                <p className="text-xs text-zinc-400">
                  {macroLine(e.totals)} · <SourceTag source={e.source} />
                  {e.foods.some((f) => f.source === "estimate" && !f.refVersion) && (
                    <span className="ml-1 text-zinc-500">· earlier reference values (logged before 2026-11-01)</span>
                  )}
                </p>
              </div>
              <button type="button" className="text-xs font-semibold text-zinc-300" onClick={() => setEditing(editing === e.id ? null : e.id)}>
                Edit
              </button>
              <button
                type="button"
                aria-label={`Remove ${e.title} from today's log`}
                className="text-xs font-semibold text-zinc-400"
                onClick={() => {
                  const next = undoEntry(log, e.id);
                  saveLog(next);
                  onLog(next);
                }}
              >
                Remove
              </button>
            </div>
            {editing === e.id && (
              <EntryEditor
                entry={e}
                onSave={(foods) => {
                  const next = correctEntry(log, e.id, foods);
                  saveLog(next);
                  onLog(next);
                  setEditing(null);
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function EntryEditor({ entry, onSave }: { entry: LogEntry; onSave: (foods: LoggedFood[]) => void }) {
  const [grams, setGrams] = useState(entry.foods.map((f) => String(f.grams)));
  return (
    <form
      aria-label={`Correct ${entry.title}`}
      className="mt-2 grid grid-cols-1 gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(
          entry.foods.map((f, i) => {
            const g = num(grams[i], 0, 5000) ?? 0;
            // Rescales the entry's OWN stored values (whatever reference produced them) — a
            // correction never swaps in newer reference values behind the user's back.
            const per = (v: number) => (v / f.grams) * 100;
            return { ...f, grams: g, totals: scale({ kcal: per(f.totals.kcal), protein: per(f.totals.protein), carbs: per(f.totals.carbs), fat: per(f.totals.fat), fiber: f.totals.fiber === null ? null : per(f.totals.fiber) }, g) };
          }),
        );
      }}
    >
      {entry.foods.map((f, i) => (
        <label key={f.name} className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate">{f.name}</span>
          <input aria-label={`${f.name} grams`} inputMode="decimal" value={grams[i]} onChange={(e) => setGrams(grams.map((g, j) => (j === i ? e.target.value : g)))} className={`${INPUT} h-9 w-20 text-right`} />
          <span className="text-zinc-500">g</span>
        </label>
      ))}
      <button type="submit" className={`${BTN} h-9 justify-self-start`}>
        Save correction
      </button>
    </form>
  );
}

/**
 * Log something that wasn't a suggestion. An exact reference match uses its FDC-sourced values; an
 * ambiguous name asks which reference food it is; anything else needs the label numbers (TOTAL carbs
 * as printed, plus fiber if shown — net carbs are worked out once).
 */
function LogOther({ onSave }: { onSave: (s: { title: string; sourceKey: string; foods: LoggedFood[] }) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [grams, setGrams] = useState("");
  const [choice, setChoice] = useState("");
  const [vals, setVals] = useState({ kcal: "", protein: "", carbs: "", fiber: "", fat: "" });
  const [err, setErr] = useState<string | null>(null);
  const m = name.trim() ? matchFood(name) : null;
  const chosen = choice && choice !== "label" ? FOOD_BY_KEY.get(choice) : undefined;
  const food: RefFood | null = m?.status === "match" ? m.food : (chosen ?? null);
  const useLabel = !food && !!m && (m.status === "unknown" || choice === "label");
  const g = num(grams, 1, 5000);
  if (!open)
    return (
      <button type="button" className={`${BTN2} mt-4`} onClick={() => setOpen(true)}>
        + Log something else
      </button>
    );
  return (
    <form
      aria-label="Log something else"
      className={`${CARD} mt-4 grid grid-cols-1 gap-2`}
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        if (!name.trim() || g === null) return setErr("Enter a name and the grams you ate.");
        let entry: LoggedFood;
        if (food) {
          entry = { name: name.trim(), grams: g, totals: scale(food.per100, g), source: "estimate", fdcId: food.source.fdcId, weighed: food.weighed, netCarbsBasis: food.netCarbsBasis, refVersion: REF_VERSION };
        } else if (useLabel) {
          const k = num(vals.kcal, 0, 5000);
          const p = num(vals.protein, 0, 500);
          const c = num(vals.carbs, 0, 500);
          const fat = num(vals.fat, 0, 500);
          const fib = vals.fiber.trim() === "" ? null : num(vals.fiber, 0, 500);
          if (k === null || p === null || c === null || fat === null || (vals.fiber.trim() !== "" && fib === null)) return setErr("Enter calories, protein, total carbs and fat from the label.");
          if (fib !== null && fib > c) return setErr("Fiber can't be more than total carbs — check the label.");
          const net = netCarbs({ carbs: c, fiber: fib });
          const totals: Per100 = { kcal: k, protein: p, carbs: net.value!, fat, fiber: fib };
          entry = { name: name.trim(), grams: g, totals, source: "label", netCarbsBasis: net.basis! };
        } else return setErr("Choose which food it is, or use the label values.");
        onSave({ title: name.trim(), sourceKey: `manual:${Date.now()}`, foods: [entry] });
        setOpen(false);
        setName("");
        setGrams("");
        setChoice("");
      }}
    >
      <h2 className="font-semibold">Log something else</h2>
      <div className="flex gap-2">
        <input aria-label="Food name" value={name} onChange={(e) => { setName(e.target.value); setChoice(""); }} placeholder="Food" className={`${INPUT} flex-1`} />
        <input aria-label="Grams eaten" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} placeholder="g" className={`${INPUT} w-20`} />
      </div>
      {m?.status === "confirm" && (
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-amber-200">{m.question}</span>
          <select aria-label="Which food is it?" value={choice} onChange={(e) => setChoice(e.target.value)} className={INPUT}>
            <option value="">Choose…</option>
            {m.options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.name}
              </option>
            ))}
            <option value="label">None of these — use the label</option>
          </select>
        </label>
      )}
      {useLabel && (
        <>
          <p className="text-xs text-amber-200">
            {m?.status === "unknown" ? m.reason : "Using the label."} Enter the label&apos;s totals for the amount you ate: total carbs as printed, and fiber if it&apos;s shown.
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {(["kcal", "protein", "carbs", "fiber", "fat"] as const).map((k) => (
              <input key={k} aria-label={k === "carbs" ? "total carbs" : k} inputMode="decimal" placeholder={k === "carbs" ? "carbs" : k} value={vals[k]} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} className={`${INPUT} px-2`} />
            ))}
          </div>
        </>
      )}
      {food && g !== null && (
        <p className="text-sm text-zinc-300">
          {macroLine(scale(food.per100, g))} <SourceTag source="estimate" />{" "}
          <span className="text-xs text-zinc-500">
            ({food.name}, {food.weighed} · USDA FDC {food.source.fdcId})
          </span>
        </p>
      )}
      {err && <Note tone="warn">{err}</Note>}
      <div className="flex gap-2">
        <button type="submit" className={BTN}>
          Save to today&apos;s log
        </button>
        <button type="button" className={BTN2} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
