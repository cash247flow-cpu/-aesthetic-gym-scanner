"use client";

// Targets confirmation, food preferences and reminder settings for the nutrition coach.

import { useState } from "react";
import { ALLERGENS, type Allergen } from "@/lib/nutrition/foods";
import { PREP_LIMITS, parseAvoidList, savePrefs, type PrepLimit, type Prefs } from "@/lib/nutrition/prefs";
import { confirmTargets } from "@/lib/nutrition/targets";
import type { Today } from "@/lib/nutrition/today";
import { WEEKDAYS, deviceTimeZone, saveReminders, type Reminders } from "@/lib/nutrition/reminders";
import { BTN, BTN2, CARD, INPUT, LABEL, Note, macroLine } from "./ui";

/** Shown instead of suggestions until the user confirms targets (never invented here). */
export function TargetsGate({ today, onConfirmed, onEditTargets }: { today: Today; onConfirmed: () => void; onEditTargets: () => void }) {
  const d = today.defaults;
  return (
    <section aria-label="Confirm your targets" className={`${CARD} mt-4`}>
      <h2 className="font-semibold">First, confirm today&apos;s targets</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Suggestions are built around the targets you&apos;ve set — not around a body-fat goal, which on its own isn&apos;t enough to set calories. Your plan&apos;s targets for this phase are:
      </p>
      <p className="mt-2 text-sm font-semibold text-zinc-100">{macroLine({ kcal: d.kcal, protein: d.protein, carbs: d.carbs, fat: d.fat })}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={BTN}
          onClick={() => {
            confirmTargets(today.phase);
            onConfirmed();
          }}
        >
          Use these targets
        </button>
        <button type="button" className={BTN2} onClick={onEditTargets}>
          Edit my targets
        </button>
      </div>
    </section>
  );
}

export function PrefsForm({ prefs, onSaved, compact = false }: { prefs: Prefs | null; onSaved: (p: Prefs) => void; compact?: boolean }) {
  const [allergies, setAllergies] = useState<Allergen[]>(prefs?.allergies ?? []);
  const [avoid, setAvoid] = useState((prefs?.avoid ?? []).join(", "));
  const [prepMin, setPrep] = useState<PrepLimit>(prefs?.prepMin ?? 15);
  const [budget, setBudget] = useState(prefs?.budget ?? false);
  const toggle = (a: Allergen) => setAllergies((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));
  return (
    <form
      aria-label="Food preferences"
      className={`${CARD} mt-4 grid grid-cols-1 gap-3`}
      onSubmit={(e) => {
        e.preventDefault();
        onSaved(savePrefs({ allergies, avoid: parseAvoidList(avoid), prepMin, budget }));
      }}
    >
      {!compact && (
        <div>
          <h2 className="font-semibold">Allergies and foods you avoid</h2>
          <p className="mt-1 text-sm text-zinc-400">Suggestions leave these out. If you have none, just save.</p>
        </div>
      )}
      <fieldset>
        <legend className={LABEL}>Allergies</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {ALLERGENS.map((a) => (
            <label key={a} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${allergies.includes(a) ? "border-amber-400 bg-amber-400/15 text-amber-100" : "border-zinc-700 text-zinc-300"}`}>
              <input type="checkbox" className="sr-only" checked={allergies.includes(a)} onChange={() => toggle(a)} />
              {a}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="grid grid-cols-1 gap-1">
        <span className={LABEL}>Foods you don&apos;t eat (comma-separated)</span>
        <input value={avoid} onChange={(e) => setAvoid(e.target.value)} placeholder="e.g. pork, mushrooms" className={INPUT} />
      </label>
      <label className="grid grid-cols-1 gap-1">
        <span className={LABEL}>Usual time to make a meal</span>
        <select value={prepMin} onChange={(e) => setPrep(Number(e.target.value) as PrepLimit)} className={INPUT}>
          {PREP_LIMITS.map((m) => (
            <option key={m} value={m}>
              Up to {m} min
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input type="checkbox" checked={budget} onChange={(e) => setBudget(e.target.checked)} className="h-5 w-5 accent-lime-400" />
        Show lower-cost swaps on the grocery list
      </label>
      <button type="submit" className={`${BTN} justify-self-start`}>
        Save preferences
      </button>
    </form>
  );
}

export function RemindersForm({ value, onChange }: { value: Reminders; onChange: (r: Reminders) => void }) {
  const [r, setR] = useState(value);
  const [saved, setSaved] = useState(false);
  const set = (next: Reminders) => {
    setR(next);
    setSaved(false);
  };
  return (
    <form
      aria-label="Reminders"
      className={`${CARD} mt-4 grid grid-cols-1 gap-3`}
      onSubmit={(e) => {
        e.preventDefault();
        const next = { ...r, timeZone: deviceTimeZone() };
        saveReminders(next);
        onChange(next);
        setSaved(true);
      }}
    >
      <div>
        <h2 className="font-semibold">Reminders</h2>
        <p className="mt-1 text-sm text-zinc-400">
          These show <b>inside the app</b> when you open it after the time you pick. AESTHETIQ can&apos;t notify you while it&apos;s closed yet, so nothing will pop up on your lock screen.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={r.grocery.on} onChange={(e) => set({ ...r, grocery: { ...r.grocery, on: e.target.checked } })} className="h-5 w-5 accent-lime-400" />
        Grocery reminder
      </label>
      {r.grocery.on && (
        <div className="flex gap-2">
          <select aria-label="Grocery reminder day" value={String(r.grocery.day)} onChange={(e) => set({ ...r, grocery: { ...r.grocery, day: e.target.value === "daily" ? "daily" : Number(e.target.value) } })} className={`${INPUT} flex-1`}>
            <option value="daily">Every day</option>
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
          <input aria-label="Grocery reminder time" type="time" value={r.grocery.time} onChange={(e) => set({ ...r, grocery: { ...r.grocery, time: e.target.value } })} className={INPUT} />
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={r.evening.on} onChange={(e) => set({ ...r, evening: { ...r.evening, on: e.target.checked } })} className="h-5 w-5 accent-lime-400" />
        Evening check-in
      </label>
      {r.evening.on && <input aria-label="Evening check-in time" type="time" value={r.evening.time} onChange={(e) => set({ ...r, evening: { ...r.evening, time: e.target.value } })} className={`${INPUT} justify-self-start`} />}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={r.quiet.on} onChange={(e) => set({ ...r, quiet: { ...r.quiet, on: e.target.checked } })} className="h-5 w-5 accent-lime-400" />
        Quiet hours (no reminders)
      </label>
      {r.quiet.on && (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <input aria-label="Quiet hours start" type="time" value={r.quiet.start} onChange={(e) => set({ ...r, quiet: { ...r.quiet, start: e.target.value } })} className={INPUT} />
          to
          <input aria-label="Quiet hours end" type="time" value={r.quiet.end} onChange={(e) => set({ ...r, quiet: { ...r.quiet, end: e.target.value } })} className={INPUT} />
        </div>
      )}
      <p className="text-xs text-zinc-500">Times use this phone&apos;s time zone ({deviceTimeZone()}).</p>
      <button type="submit" className={`${BTN} justify-self-start`}>
        Save reminders
      </button>
      {saved && <Note tone="ok">Saved. They&apos;ll appear on the home screen at those times — only while you have the app open.</Note>}
    </form>
  );
}
