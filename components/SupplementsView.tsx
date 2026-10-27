"use client";

import { useState } from "react";
import {
  SLOTS,
  SUPPLEMENTS,
  loadCleared,
  loadTaken,
  saveCleared,
  saveTaken,
  takenCount,
  type Cleared,
  type Supplement,
} from "@/lib/supplements";
import { todayStr } from "@/lib/habits";

export function SupplementsView({ onBack }: { onBack: () => void }) {
  const [today] = useState(todayStr);
  const [taken, setTaken] = useState(loadTaken);
  const [cleared, setCleared] = useState<Cleared>(loadCleared);
  const [clearing, setClearing] = useState<string | null>(null);
  const day = taken[today] ?? {};
  const { taken: done, total } = takenCount(taken, today, cleared);
  const onHold = SUPPLEMENTS.filter((s) => s.hold && !cleared[s.id]);

  function toggle(id: string) {
    const next = { ...taken, [today]: { ...day, [id]: !day[id] } };
    setTaken(next);
    saveTaken(next);
  }

  function updateCleared(next: Cleared) {
    setCleared(next);
    saveCleared(next);
  }

  return (
    <section className="mt-2">
      <h1 className="text-3xl font-bold tracking-tight">Supplements</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {done}/{total} taken today
        {onHold.length > 0 && ` · ${onHold.length} on hold`}
      </p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-teal-400 transition-[width]" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>

      {onHold.length > 0 && (
        <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5 text-sm text-amber-100">
          Your plan holds {onHold.length} items for a dose review. Check them with your doctor before taking them — the
          app only unlocks an item once you mark it cleared.
        </p>
      )}

      {SLOTS.map((slot) => {
        const items = SUPPLEMENTS.filter((s) => s.slot === slot.id);
        return (
          <section key={slot.id} className="mt-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{slot.title}</h2>
            <p className="text-xs text-zinc-500">{slot.when}</p>
            <ul className="mt-2 grid grid-cols-1 gap-2">
              {items.map((s) => (
                <SupplementRow
                  key={s.id}
                  supp={s}
                  cleared={cleared[s.id]}
                  taken={!!day[s.id]}
                  clearing={clearing === s.id}
                  onToggle={() => toggle(s.id)}
                  onStartClear={() => setClearing(s.id)}
                  onCancelClear={() => setClearing(null)}
                  onClear={(dose) => {
                    updateCleared({ ...cleared, [s.id]: { dose, date: today } });
                    setClearing(null);
                  }}
                  onUnclear={() => {
                    if (!window.confirm(`Put ${s.name} back on hold?`)) return;
                    const next = { ...cleared };
                    delete next[s.id];
                    updateCleared(next);
                  }}
                />
              ))}
            </ul>
          </section>
        );
      })}

      <p className="mt-5 text-xs text-zinc-500">
        Reference list from your plan, not medical advice. Doses and timing are your clinician&apos;s call.
      </p>

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

function SupplementRow({
  supp,
  cleared,
  taken,
  clearing,
  onToggle,
  onStartClear,
  onCancelClear,
  onClear,
  onUnclear,
}: {
  supp: Supplement;
  cleared?: { dose: string; date: string };
  taken: boolean;
  clearing: boolean;
  onToggle: () => void;
  onStartClear: () => void;
  onCancelClear: () => void;
  onClear: (dose: string) => void;
  onUnclear: () => void;
}) {
  const [dose, setDose] = useState("");
  const held = !!supp.hold && !cleared;

  if (held) {
    return (
      <li className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 px-3.5 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-zinc-400">{supp.name}</p>
            <p className="mt-0.5 text-xs font-semibold text-amber-300">⏸ {supp.hold}</p>
            <p className="mt-0.5 text-xs text-zinc-500">Plan listed: {supp.dose}</p>
          </div>
          {!clearing && (
            <button type="button" onClick={onStartClear} className="shrink-0 text-xs font-semibold text-zinc-400 hover:text-zinc-100">
              Cleared?
            </button>
          )}
        </div>
        {clearing && (
          <div className="mt-3 rounded-lg bg-zinc-800 p-3">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Dose your clinician cleared
              </span>
              <input
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                placeholder="e.g. 2,000 IU, 1 cap"
                className="mt-1 h-10 w-full rounded-lg bg-zinc-900 px-3 text-base text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </label>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={!dose.trim()}
                onClick={() => onClear(dose.trim())}
                className="h-9 flex-1 rounded-lg bg-teal-400 text-sm font-semibold text-zinc-950 disabled:opacity-40"
              >
                Mark cleared
              </button>
              <button type="button" onClick={onCancelClear} className="h-9 rounded-lg px-3 text-sm text-zinc-400 hover:text-zinc-100">
                Cancel
              </button>
            </div>
          </div>
        )}
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={taken}
        className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition active:scale-[0.99] ${
          taken ? "border-teal-400/50 bg-teal-400/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
        }`}
      >
        <span
          className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-sm font-bold ${
            taken ? "bg-teal-400 text-zinc-950" : "border border-zinc-600"
          }`}
        >
          {taken ? "✓" : ""}
        </span>
        <span className="min-w-0">
          <span className="block font-semibold">{supp.name}</span>
          <span className="block text-sm text-zinc-300">{cleared ? cleared.dose : supp.dose}</span>
          {cleared && <span className="block text-xs text-teal-300">Cleared by clinician</span>}
          {supp.note && <span className="mt-0.5 block text-xs text-zinc-500">{supp.note}</span>}
        </span>
      </button>
      {cleared && (
        <button type="button" onClick={onUnclear} className="mt-1 px-1 text-xs text-zinc-500 hover:text-zinc-300">
          Put back on hold
        </button>
      )}
    </li>
  );
}
