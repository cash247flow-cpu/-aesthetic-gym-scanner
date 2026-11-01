"use client";

import { useRef, useState } from "react";
import type { Food, FoodKind, Meal } from "@/lib/meals";
import { LIMITS, checkDraft, type MealContent } from "@/lib/mealEdits";
import { nutritionLine, parseCronometerFoods, type MealNutrition } from "@/lib/cronometerMeals";

const KIND_LABEL: Record<FoodKind, string> = { P: "Protein", F: "Fiber", C: "Carbs", note: "Psyllium / note" };
type Row = Food;

/**
 * Edit one meal: its name and food list (add, remove, reorder, tag). Optionally take the name and
 * nutrition totals from a Cronometer recipe export — read on the phone, never uploaded. The export
 * has no ingredient list, so the food list is never changed by it. Nothing is saved until Save.
 */
export function MealEditor({
  meal,
  isDefault,
  onSave,
  onCancel,
  onReset,
}: {
  meal: Meal & { nutrition?: MealNutrition };
  isDefault: boolean;
  onSave: (next: MealContent) => void;
  onCancel: () => void;
  onReset: () => void;
}) {
  const [title, setTitle] = useState(meal.title);
  const [rows, setRows] = useState<Row[]>(meal.foods.map((f) => ({ ...f })));
  const [error, setError] = useState<string | null>(null);
  const [nutrition, setNutrition] = useState<MealNutrition | undefined>(meal.nutrition);
  const [choices, setChoices] = useState<MealNutrition[] | null>(null);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
  };

  function applyRecipe(n: MealNutrition) {
    setNutrition(n);
    setTitle(n.recipe);
    setNote({ text: `Name and nutrition from your Cronometer recipe “${n.recipe}”. Its export has no ingredient list, so the food list stays as it is. Check, then Save.`, ok: true });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const r = parseCronometerFoods(await file.text());
    if ("error" in r) return setNote({ text: r.error, ok: false });
    if (r.foods.length === 1) {
      setChoices(null);
      return applyRecipe(r.foods[0]);
    }
    setChoices(r.foods);
    setNote({ text: `That file has ${r.foods.length} foods or recipes — pick the one for this meal.`, ok: true });
  }

  function save() {
    const r = checkDraft({ title, foods: rows.map(({ kind, text }) => ({ kind, text })), ...(nutrition ? { nutrition } : {}) });
    if (!r.ok) return setError(r.error);
    onSave(r.value);
  }

  return (
    <form
      aria-label={`Edit ${meal.when}`}
      className="mt-2 grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className="grid gap-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Meal name
        <input
          value={title}
          maxLength={LIMITS.title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-11 rounded-lg bg-zinc-800 px-3 text-base font-normal normal-case tracking-normal text-zinc-100 focus:outline-none focus:ring-2 focus:ring-lime-400"
        />
      </label>

      <ol className="grid gap-2">
        {rows.map((row, i) => (
          <li key={i} className="rounded-lg bg-zinc-800/60 p-2">
            <div className="flex items-center gap-1.5">
              <select
                aria-label={`Food ${i + 1} type`}
                value={row.kind}
                onChange={(e) => setRow(i, { kind: e.target.value as FoodKind })}
                className="h-9 min-w-0 flex-1 rounded-md bg-zinc-900 px-2 text-sm text-zinc-100"
              >
                {(Object.keys(KIND_LABEL) as FoodKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              <button type="button" aria-label={`Move food ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)} className="h-9 w-9 shrink-0 rounded-md bg-zinc-900 text-zinc-300 disabled:opacity-30">
                ↑
              </button>
              <button type="button" aria-label={`Move food ${i + 1} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="h-9 w-9 shrink-0 rounded-md bg-zinc-900 text-zinc-300 disabled:opacity-30">
                ↓
              </button>
              <button type="button" aria-label={`Remove food ${i + 1}`} onClick={() => setRows(rows.filter((_, j) => j !== i))} className="h-9 w-9 shrink-0 rounded-md bg-zinc-900 text-zinc-300">
                ✕
              </button>
            </div>
            <input
              aria-label={`Food ${i + 1}`}
              value={row.text}
              maxLength={LIMITS.foodText}
              placeholder="e.g. 180 g salmon"
              onChange={(e) => setRow(i, { text: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-md bg-zinc-900 px-2.5 text-base text-zinc-100 focus:outline-none focus:ring-2 focus:ring-lime-400"
            />
          </li>
        ))}
      </ol>
      <button
        type="button"
        disabled={rows.length >= LIMITS.foods}
        onClick={() => setRows([...rows, { kind: "P", text: "" }])}
        className="h-10 rounded-lg bg-zinc-800 text-sm font-semibold text-zinc-200 disabled:opacity-40"
      >
        + Add food
      </button>

      <div aria-label="Cronometer nutrition" className="rounded-lg border border-orange-400/30 p-2.5 text-xs text-zinc-300">
        <p>
          From Cronometer: export the recipe for this meal (<b>Foods</b> → your recipe → export) and pick the file. It sets the meal&apos;s name and
          nutrition; the file is read on this phone only.
        </p>
        {nutrition && (
          <p className="mt-1.5 text-zinc-100">
            {nutrition.serving ? `${nutrition.serving}: ` : ""}
            {nutritionLine(nutrition)}{" "}
            <button type="button" onClick={() => { setNutrition(undefined); setNote(null); }} className="font-semibold text-zinc-400 underline underline-offset-2">
              Remove
            </button>
          </p>
        )}
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" aria-label="Cronometer recipe file" onChange={onFile} />
        <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 h-9 rounded-full bg-orange-400 px-3 font-semibold text-zinc-950">
          {nutrition ? "Replace from Cronometer CSV" : "Fill from Cronometer CSV"}
        </button>
        {choices && (
          <label className="mt-2 grid gap-1">
            Recipe
            <select
              aria-label="Cronometer recipe"
              defaultValue=""
              onChange={(e) => {
                const n = choices[Number(e.target.value)];
                if (n) applyRecipe(n);
              }}
              className="h-9 rounded-md bg-zinc-900 px-2 text-sm"
            >
              <option value="" disabled>
                Choose…
              </option>
              {choices.map((c, i) => (
                <option key={i} value={i}>
                  {c.recipe}
                </option>
              ))}
            </select>
          </label>
        )}
        {note && (
          <p role="status" className={`mt-2 ${note.ok ? "text-lime-200" : "text-amber-300"}`}>
            {note.text}
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-amber-300">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className="h-11 flex-1 rounded-xl bg-lime-400 text-sm font-semibold text-zinc-950">
          Save meal
        </button>
        <button type="button" onClick={onCancel} className="h-11 rounded-xl px-4 text-sm text-zinc-300">
          Cancel
        </button>
      </div>
      {!isDefault && (
        <button type="button" onClick={onReset} className="justify-self-start text-xs text-zinc-500 hover:text-zinc-300">
          Reset to the plan&apos;s default
        </button>
      )}
    </form>
  );
}
