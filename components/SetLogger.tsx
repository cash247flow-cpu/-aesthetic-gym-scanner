"use client";

import { useEffect, useState } from "react";
import { loadOverload, overloadPlan } from "@/lib/overload";
import { convertRows, countableSet, toLb, type Unit } from "@/lib/units";
import { recentPainReport } from "@/lib/review/pain";
import { PainHoldControl } from "@/components/PainHold";
import { resolveLog } from "@/lib/logUnits";
import { loadWorkouts } from "@/lib/achievements/workoutRecords";

export type { Unit };
export type Row = { weight: string; reps: string; done: boolean };
// One record per exercise: today's sets plus the last earlier session's sets ("Previous").
// `unit` / `prevUnit` say what unit the numbers were typed in. Logs saved before units were
// recorded have neither: their unit is matched against the finished workout or asked for
// (lib/logUnits.ts) — never assumed from the current toggle.
export type LogRecord = {
  date: string;
  sets: Row[];
  prevSets: Row[];
  unit?: Unit;
  prevUnit?: Unit;
  /** The user's answer for a legacy log, with the numbers exactly as they were — so it can be undone. */
  unitAnswer?: { unit: Unit; at: number; original: { sets: Row[]; prevSets: Row[]; date: string } };
};
const MAX_SETS = 10;
const emptyRow = (): Row => ({ weight: "", reps: "", done: false });
const hasData = (r: Row) => r.weight.trim() !== "" || r.reps.trim() !== "";
const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
const storageKey = (exercise: string) => `ags:log:${exercise}`;

// localStorage can throw (private mode, storage full) — logging should never break the page.
export function loadRecord(exercise: string): LogRecord | null {
  try {
    const raw = localStorage.getItem(storageKey(exercise));
    return raw ? (JSON.parse(raw) as LogRecord) : null;
  } catch {
    return null;
  }
}

function saveRecord(exercise: string, record: LogRecord) {
  try {
    localStorage.setItem(storageKey(exercise), JSON.stringify(record));
  } catch {
    /* ignore */
  }
}

export function loadUnit(): Unit {
  try {
    return localStorage.getItem("ags:unit") === "kg" ? "kg" : "lb";
  } catch {
    return "lb";
  }
}

export function saveUnit(unit: Unit) {
  try {
    localStorage.setItem("ags:unit", unit);
  } catch {
    /* ignore */
  }
}

/** "2–3" → 3, "3" → 3: start with the top of the programmed range. */
function targetSetCount(sets: string): number {
  const nums = sets.split(/[–-]/).map((n) => Number(n.trim())).filter((n) => Number.isFinite(n) && n > 0);
  return Math.min(MAX_SETS, nums.length ? nums[nums.length - 1] : 3);
}

export function SetLogger({
  exercise,
  sets,
  reps,
  unit,
  onSetDone,
  onProgress,
}: {
  exercise: string;
  sets: string;
  reps: string;
  unit: Unit;
  /** Called when a set is ticked; allDone is true when that was the last open set. */
  onSetDone: (allDone: boolean) => void;
  onProgress?: (done: number, total: number) => void;
}) {
  const [initial] = useState(() => {
    const rec = loadRecord(exercise);
    const isToday = rec?.date === today();
    // Units for a legacy log come from the finished workout or the user — never from the toggle.
    const res = rec ? resolveLog(rec, exercise, loadWorkouts()) : null;
    const prevRes = (isToday ? res?.prevSets : res?.sets) ?? { unit: null, source: "no-weights" as const };
    const todayRes = isToday ? res!.sets : { unit: null, source: "no-weights" as const };
    const prevRaw = (isToday ? rec?.prevSets : rec?.sets)?.filter(hasData) ?? [];
    // Everything known is shown in the current unit; ambiguous numbers are shown as typed.
    const prevUnit: Unit | null = prevRes.source === "ambiguous" ? null : (prevRes.unit ?? unit);
    const rowsUnit: Unit | null = todayRes.source === "ambiguous" ? null : (todayRes.unit ?? unit);
    const prev = prevUnit ? convertRows(prevRaw, prevUnit, unit) : prevRaw;
    const todayRows = isToday && rec?.sets.length ? (rowsUnit ? convertRows(rec.sets, rowsUnit, unit) : rec.sets) : null;
    return { rec, prev, prevUnit: prevUnit && unit, rowsUnit: rowsUnit && unit, todayRows };
  });
  const count = targetSetCount(sets);
  // Progressive overload: today's targets from last session, prefilled but editable. Held at
  // last time's numbers while a reported pain is unresolved (until the user resumes them).
  // No targets from a previous session whose unit is unknown.
  const makePlan = (prevRows: Row[], prevKnown: boolean, n: number) =>
    loadOverload() && prevKnown ? overloadPlan(prevRows, reps, unit, n, exercise, { hold: recentPainReport() }) : null;
  const [plan, setPlan] = useState(() => makePlan(initial.prev, initial.prevUnit !== null, initial.todayRows?.length || count));
  const [prev, setPrev] = useState<Row[]>(initial.prev);
  const [prevUnit, setPrevUnit] = useState<Unit | null>(initial.prevUnit);
  const [rows, setRows] = useState<Row[]>(
    () => initial.todayRows ?? (plan ? plan.targets.map((t) => ({ weight: t.weight, reps: t.reps, done: false })) : Array.from({ length: count }, emptyRow)),
  );
  const [rowsUnit, setRowsUnit] = useState<Unit | null>(initial.rowsUnit);
  const [answer, setAnswer] = useState<LogRecord["unitAnswer"]>(initial.rec?.date === today() ? initial.rec?.unitAnswer : undefined);
  const isTarget = (i: number, field: "weight" | "reps", value: string) =>
    !!plan?.targets[i] && plan.targets[i][field] === value && value !== "";
  const ambiguous = prevUnit === null || rowsUnit === null;

  // Switching lb/kg mid-workout converts what's typed, so the same lift is never recorded 2.2× off.
  // Numbers whose unit is unknown are left exactly as they are.
  useEffect(() => {
    if ((rowsUnit ?? unit) === unit && (prevUnit ?? unit) === unit) return;
    const nextRows = rowsUnit ? convertRows(rows, rowsUnit, unit) : rows;
    const nextPrev = prevUnit ? convertRows(prev, prevUnit, unit) : prev;
    const nextRowsUnit = rowsUnit && unit;
    const nextPrevUnit = prevUnit && unit;
    setRowsUnit(nextRowsUnit);
    setPrevUnit(nextPrevUnit);
    setPrev(nextPrev);
    setRows(nextRows);
    if (rows.some(hasData)) save(nextRows, nextPrev, nextRowsUnit, nextPrevUnit, answer);
  }, [unit, rowsUnit, prevUnit, rows, prev, exercise, answer]); // eslint-disable-line react-hooks/exhaustive-deps

  function save(sets: Row[], prevSets: Row[], u: Unit | null, pu: Unit | null, ans: LogRecord["unitAnswer"]) {
    saveRecord(exercise, {
      date: today(),
      sets,
      prevSets,
      ...(u ? { unit: u } : {}),
      ...(pu ? { prevUnit: pu } : {}),
      ...(ans ? { unitAnswer: ans } : {}),
    });
  }

  /** The user says which unit the legacy numbers were typed in. Originals are kept for Undo. */
  function confirmUnit(u: Unit) {
    const original = { sets: initial.rec?.date === today() ? rows : [], prevSets: prev, date: initial.rec?.date ?? today() };
    const ans = { unit: u, at: Date.now(), original };
    const nextPrev = prevUnit === null ? convertRows(prev, u, unit) : prev;
    const nextRows = rowsUnit === null ? convertRows(rows, u, unit) : rows;
    setAnswer(ans);
    setPrevUnit(unit);
    setRowsUnit(unit);
    setPrev(nextPrev);
    const freshPlan = !rows.some(hasData) ? makePlan(nextPrev, true, rows.length || count) : plan;
    setPlan(freshPlan);
    const finalRows = !rows.some(hasData) && freshPlan ? freshPlan.targets.map((t) => ({ weight: t.weight, reps: t.reps, done: false })) : nextRows;
    setRows(finalRows);
    save(finalRows, nextPrev, unit, unit, ans);
  }

  /** Undo the answer: the numbers go back exactly as they were, with the unit unknown again. */
  function undoUnit() {
    if (!answer) return;
    const { original } = answer;
    const backPrev = original.prevSets;
    // Today's own typing (already in a known unit) is left alone; only the legacy numbers revert.
    const backRows = original.sets.length ? original.sets : rows;
    setAnswer(undefined);
    setPrev(backPrev);
    setPrevUnit(null);
    if (original.sets.length) setRowsUnit(null);
    if (!rows.some(hasData)) setPlan(null);
    setRows(backRows);
    save(backRows, backPrev, original.sets.length ? null : rowsUnit, null, undefined);
  }

  const doneCount = rows.filter((r) => r.done).length;
  useEffect(() => {
    onProgress?.(doneCount, rows.length);
  }, [doneCount, rows.length, onProgress]);

  const repsHint = /fail/i.test(reps) ? "max" : reps.split(/[–-]/)[0]?.trim() || "";

  function commit(next: Row[]) {
    setRows(next);
    save(next, prev, rowsUnit, prevUnit, answer);
  }

  function update(i: number, patch: Partial<Row>) {
    commit(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function fillFromPrevious(i: number) {
    const p = prevUnit === null ? undefined : prev[i]; // never copy numbers whose unit is unknown
    if (p) update(i, { weight: p.weight, reps: p.reps });
  }

  function toggleDone(i: number) {
    const row = rows[i];
    if (row.done) return update(i, { done: false });
    // Like Strong/Hevy: an empty field takes last session's value when you tick the set
    // (only when that value's unit is known).
    const p = prevUnit === null ? undefined : prev[i];
    const next = rows.map((r, j) =>
      j === i ? { done: true, weight: r.weight || p?.weight || "", reps: r.reps || p?.reps || "" } : r,
    );
    commit(next);
    onSetDone(next.every((r) => r.done));
  }

  return (
    <div className="mt-4 border-t border-zinc-800 pt-3">
      {plan && (
        <p className="mb-2 rounded-lg bg-lime-400/10 px-2.5 py-1.5 text-xs text-lime-200">
          <span className="font-semibold">🎯 Progressive overload · </span>
          {plan.note} Targets are filled in — edit any box.
        </p>
      )}
      {plan?.held && <PainHoldControl compact />}
      {ambiguous && (
        <div role="group" aria-label="Unit of earlier sets" className="mb-2 rounded-lg border border-amber-300/40 bg-amber-300/10 px-2.5 py-2 text-xs text-amber-100">
          <p>
            {rowsUnit === null ? "Today's sets here" : "Your previous sets here"} were saved before the app recorded units, and the app can&apos;t
            tell whether they were lb or kg. Until you say, they&apos;re shown as typed (with a ?), and they don&apos;t count toward records or targets.
          </p>
          <div className="mt-1.5 flex gap-2">
            {(["lb", "kg"] as const).map((u) => (
              <button key={u} type="button" onClick={() => confirmUnit(u)} className="h-8 rounded-full border border-amber-300/60 px-3 font-semibold">
                They were {u}
              </button>
            ))}
          </div>
        </div>
      )}
      {answer && (
        <p className="mb-2 px-1 text-[11px] text-zinc-400">
          Earlier sets confirmed as {answer.unit} by you.{" "}
          <button type="button" onClick={undoUnit} className="font-semibold text-zinc-200 underline underline-offset-2">
            Undo
          </button>
        </p>
      )}
      <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_4.25rem_3.5rem_2.5rem] items-center gap-x-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        <span>Set</span>
        <span className="truncate">Previous</span>
        <span className="text-center">{unit}</span>
        <span className="text-center">Reps</span>
        <span className="text-center">✓</span>
      </div>

      <ol className="mt-1.5 grid gap-1.5">
        {rows.map((row, i) => {
          const p = prev[i];
          const w = Number(row.weight.replace(",", ".") || "0");
          const r = Number(row.reps || "0");
          const suspect = row.done && hasData(row) && (!r || (rowsUnit !== null && !countableSet(toLb(w, rowsUnit), r)));
          return (
            <li
              key={i}
              className={`grid grid-cols-[1.75rem_minmax(0,1fr)_4.25rem_3.5rem_2.5rem] items-center gap-x-2 rounded-lg px-1 py-1 transition ${
                row.done ? "bg-lime-400/10" : ""
              }`}
            >
              <span className="text-center text-sm font-semibold text-zinc-300">{i + 1}</span>
              <button
                type="button"
                onClick={() => fillFromPrevious(i)}
                disabled={!p || prevUnit === null}
                aria-label={p ? (prevUnit === null ? `Previous: ${p.weight} (unit unknown) for ${p.reps} reps` : `Use previous: ${p.weight} ${unit} for ${p.reps} reps`) : "No previous set"}
                className="truncate text-left text-sm tabular-nums text-zinc-500 enabled:hover:text-zinc-300"
              >
                {p ? `${p.weight || "—"}${prevUnit === null && p.weight ? "?" : ""} × ${p.reps || "—"}` : "—"}
              </button>
              <input
                disabled={rowsUnit === null}
                inputMode="decimal"
                aria-label={`Set ${i + 1} weight in ${unit}`}
                value={row.weight}
                placeholder={(prevUnit !== null && p?.weight) || "0"}
                onChange={(e) => update(i, { weight: e.target.value.replace(/[^\d.,]/g, "") })}
                className={`h-9 w-full rounded-lg bg-zinc-800 text-center text-base tabular-nums placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-lime-400 ${
                  !row.done && isTarget(i, "weight", row.weight) ? "text-lime-300" : "text-zinc-100"
                }`}
              />
              <input
                disabled={rowsUnit === null}
                inputMode="numeric"
                aria-label={`Set ${i + 1} reps`}
                value={row.reps}
                placeholder={p?.reps || repsHint}
                onChange={(e) => update(i, { reps: e.target.value.replace(/\D/g, "") })}
                className={`h-9 w-full rounded-lg bg-zinc-800 text-center text-base tabular-nums placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-lime-400 ${
                  !row.done && isTarget(i, "reps", row.reps) ? "text-lime-300" : "text-zinc-100"
                }`}
              />
              <button
                type="button"
                onClick={() => toggleDone(i)}
                disabled={rowsUnit === null}
                aria-label={row.done ? `Set ${i + 1} done — tap to undo` : `Mark set ${i + 1} done`}
                aria-pressed={row.done}
                className={`grid h-9 w-full place-items-center rounded-lg text-base font-bold transition active:scale-90 ${
                  row.done ? "bg-lime-400 text-zinc-950" : "bg-zinc-800 text-zinc-500 hover:text-zinc-200"
                }`}
              >
                ✓
              </button>
              {suspect && (
                <p role="note" className="col-span-5 px-1 pt-0.5 text-[11px] text-amber-300">
                  {!r ? "No reps logged — this set won't count toward records." : "Check this set — the numbers look like a typo (a typo screen, not a safety limit). It's kept as typed but won't count toward records."}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => commit([...rows, emptyRow()])}
          disabled={rows.length >= MAX_SETS}
          className="h-9 flex-1 rounded-lg bg-zinc-800/70 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-40"
        >
          + Add Set
        </button>
        {rows.length > 1 && (
          <button
            type="button"
            onClick={() => commit(rows.slice(0, -1))}
            className="h-9 rounded-lg px-3 text-sm text-zinc-500 transition hover:text-zinc-300"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
