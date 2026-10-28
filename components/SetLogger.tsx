"use client";

import { useEffect, useState } from "react";
import { loadOverload, overloadPlan } from "@/lib/overload";

export type Unit = "lb" | "kg";
export type Row = { weight: string; reps: string; done: boolean };
// One record per exercise: today's sets plus the last earlier session's sets ("Previous").
export type LogRecord = { date: string; sets: Row[]; prevSets: Row[] };

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
    const prev = (isToday ? rec?.prevSets : rec?.sets)?.filter(hasData) ?? [];
    const count = targetSetCount(sets);
    // Progressive overload: today's targets from last session, prefilled but editable.
    const plan = loadOverload() ? overloadPlan(prev, reps, unit, isToday && rec?.sets.length ? rec.sets.length : count) : null;
    const rows =
      isToday && rec?.sets.length
        ? rec.sets
        : plan
          ? plan.targets.map((t) => ({ weight: t.weight, reps: t.reps, done: false }))
          : Array.from({ length: count }, emptyRow);
    return { prev, rows, plan };
  });
  const prev = initial.prev;
  const plan = initial.plan;
  const isTarget = (i: number, field: "weight" | "reps", value: string) =>
    !!plan?.targets[i] && plan.targets[i][field] === value && value !== "";
  const [rows, setRows] = useState<Row[]>(initial.rows);

  const doneCount = rows.filter((r) => r.done).length;
  useEffect(() => {
    onProgress?.(doneCount, rows.length);
  }, [doneCount, rows.length, onProgress]);

  const repsHint = /fail/i.test(reps) ? "max" : reps.split(/[–-]/)[0]?.trim() || "";

  function commit(next: Row[]) {
    setRows(next);
    saveRecord(exercise, { date: today(), sets: next, prevSets: prev });
  }

  function update(i: number, patch: Partial<Row>) {
    commit(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function fillFromPrevious(i: number) {
    const p = prev[i];
    if (p) update(i, { weight: p.weight, reps: p.reps });
  }

  function toggleDone(i: number) {
    const row = rows[i];
    if (row.done) return update(i, { done: false });
    // Like Strong/Hevy: an empty field takes last session's value when you tick the set.
    const p = prev[i];
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
      <div className="grid grid-cols-[1.75rem_1fr_4.25rem_3.5rem_2.5rem] items-center gap-x-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        <span>Set</span>
        <span>Previous</span>
        <span className="text-center">{unit}</span>
        <span className="text-center">Reps</span>
        <span className="text-center">✓</span>
      </div>

      <ol className="mt-1.5 grid gap-1.5">
        {rows.map((row, i) => {
          const p = prev[i];
          return (
            <li
              key={i}
              className={`grid grid-cols-[1.75rem_1fr_4.25rem_3.5rem_2.5rem] items-center gap-x-2 rounded-lg px-1 py-1 transition ${
                row.done ? "bg-lime-400/10" : ""
              }`}
            >
              <span className="text-center text-sm font-semibold text-zinc-300">{i + 1}</span>
              <button
                type="button"
                onClick={() => fillFromPrevious(i)}
                disabled={!p}
                aria-label={p ? `Use previous: ${p.weight} ${unit} for ${p.reps} reps` : "No previous set"}
                className="truncate text-left text-sm tabular-nums text-zinc-500 enabled:hover:text-zinc-300"
              >
                {p ? `${p.weight || "—"} × ${p.reps || "—"}` : "—"}
              </button>
              <input
                inputMode="decimal"
                aria-label={`Set ${i + 1} weight in ${unit}`}
                value={row.weight}
                placeholder={p?.weight || "0"}
                onChange={(e) => update(i, { weight: e.target.value.replace(/[^\d.,]/g, "") })}
                className={`h-9 w-full rounded-lg bg-zinc-800 text-center text-base tabular-nums placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-lime-400 ${
                  !row.done && isTarget(i, "weight", row.weight) ? "text-lime-300" : "text-zinc-100"
                }`}
              />
              <input
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
                aria-label={row.done ? `Set ${i + 1} done — tap to undo` : `Mark set ${i + 1} done`}
                aria-pressed={row.done}
                className={`grid h-9 w-full place-items-center rounded-lg text-base font-bold transition active:scale-90 ${
                  row.done ? "bg-lime-400 text-zinc-950" : "bg-zinc-800 text-zinc-500 hover:text-zinc-200"
                }`}
              >
                ✓
              </button>
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
