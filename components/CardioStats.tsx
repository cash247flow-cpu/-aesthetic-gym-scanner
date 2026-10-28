"use client";

import { useEffect, useRef, useState } from "react";
import { loadCardioStats, saveCardioStats, type CardioReading, type StatsSource } from "@/lib/cardioStats";
import { todayStr } from "@/lib/habits";
import { shrinkImage } from "@/lib/image";

const SOURCES: [StatsSource, string][] = [
  ["machine", "Machine"],
  ["watch", "Watch"],
  ["photo", "Photo"],
];

/**
 * Today's steps and floors for this machine: typed from the console or a smart watch, or read
 * from a photo (console, watch or Samsung Health screenshot). Saved as you type.
 */
export function CardioStats({ machine }: { machine: string }) {
  const [steps, setSteps] = useState("");
  const [floors, setFloors] = useState("");
  const [source, setSource] = useState<StatsSource>("machine");
  const [reading, setReading] = useState<{ busy: boolean; note?: string; error?: string }>({ busy: false });
  const fileRef = useRef<HTMLInputElement>(null);
  const showFloors = machine === "stairmaster";

  useEffect(() => {
    const s = loadCardioStats(todayStr(), machine);
    setSteps(s?.steps ? String(s.steps) : "");
    setFloors(s?.floors ? String(s.floors) : "");
    setSource(s?.source ?? "machine");
    setReading({ busy: false });
  }, [machine]);

  function save(next: { steps?: string; floors?: string; source?: StatsSource }) {
    const st = next.steps ?? steps;
    const fl = next.floors ?? floors;
    const src = next.source ?? source;
    if (next.steps !== undefined) setSteps(st);
    if (next.floors !== undefined) setFloors(fl);
    if (next.source !== undefined) setSource(src);
    saveCardioStats(todayStr(), machine, { steps: Number(st) || 0, floors: Number(fl) || 0, source: src });
  }

  async function readPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setReading({ busy: true });
    try {
      const form = new FormData();
      form.append("image", await shrinkImage(file), "cardio.jpg");
      const res = await fetch("/api/read-cardio", { method: "POST", body: form });
      const data = (await res.json()) as CardioReading & { error?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't read the photo.");
      if (data.steps === null && data.floors === null) {
        setReading({ busy: false, error: "No steps or floors found in that photo — type them in instead." });
        return;
      }
      save({
        ...(data.steps !== null ? { steps: String(data.steps) } : {}),
        ...(showFloors && data.floors !== null ? { floors: String(data.floors) } : {}),
        source: "photo",
      });
      const seen = [
        data.steps !== null && `${data.steps.toLocaleString()} steps`,
        data.floors !== null && `${data.floors} floors`,
        data.minutes !== null && `${data.minutes} min`,
        data.calories !== null && `${data.calories} cal`,
      ].filter(Boolean);
      setReading({ busy: false, note: `Read from photo: ${seen.join(" · ")}. Check the numbers and edit if needed.` });
    } catch (err) {
      setReading({ busy: false, error: err instanceof Error ? err.message : "Couldn't read the photo." });
    }
  }

  const input =
    "mt-1 h-10 w-full rounded-lg bg-zinc-800 px-3 text-base tabular-nums text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-sky-400";

  return (
    <section aria-label="Steps and floors" className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          {showFloors ? "Steps & floors" : "Steps"}
        </p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={reading.busy}
          className="rounded-full border border-sky-400/50 px-3 py-1 text-xs font-semibold text-sky-300 transition hover:bg-sky-400/10 active:scale-95 disabled:opacity-50"
        >
          {reading.busy ? "Reading…" : "📷 Read from photo"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={readPhoto} className="sr-only" aria-label="Photo of cardio screen" />
      </div>

      <div className={`mt-2 grid gap-2 ${showFloors ? "grid-cols-2" : "grid-cols-1"}`}>
        <label className="block">
          <span className="text-xs text-zinc-400">Steps</span>
          <input
            inputMode="numeric"
            aria-label="Steps"
            value={steps}
            placeholder="e.g. 4200"
            onChange={(e) => save({ steps: e.target.value.replace(/\D/g, "").slice(0, 6) })}
            className={input}
          />
        </label>
        {showFloors && (
          <label className="block">
            <span className="text-xs text-zinc-400">Floors</span>
            <input
              inputMode="numeric"
              aria-label="Floors"
              value={floors}
              placeholder="e.g. 55"
              onChange={(e) => save({ floors: e.target.value.replace(/\D/g, "").slice(0, 4) })}
              className={input}
            />
          </label>
        )}
      </div>

      <div role="group" aria-label="Counted by" className="mt-2 flex items-center gap-1.5 text-xs">
        <span className="shrink-0 text-zinc-500">Counted by:</span>
        {SOURCES.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => save({ source: id })}
            aria-pressed={source === id}
            className={`rounded-full px-2.5 py-1 font-semibold transition ${
              source === id ? "bg-sky-400/20 text-sky-200" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {reading.note && <p className="mt-2 text-xs text-sky-200">{reading.note}</p>}
      {reading.error && (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {reading.error}
        </p>
      )}
      <p className="mt-2 text-[11px] text-zinc-500">
        Photo works with the machine screen, your watch or a Samsung Health screenshot.
      </p>
    </section>
  );
}
