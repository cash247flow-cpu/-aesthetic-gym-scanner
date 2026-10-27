"use client";

import { useEffect, useRef, useState } from "react";
import { loadUnit, saveUnit, type Unit } from "@/components/SetLogger";
import { BodyChart, type BodyMetric } from "@/components/BodyChart";
import {
  deleteFile,
  getFile,
  loadEntries,
  loadGoal,
  newId,
  putFile,
  saveEntries,
  saveGoal,
  type BodyEntry,
  type BodyGoal,
  type BodySource,
  type GoalType,
} from "@/lib/bodyLog";
import { shrinkImage } from "@/lib/image";
import { fromLb } from "@/lib/wins";
import type { ScaleReading } from "@/lib/scaleReading";

const LB_PER_KG = 2.20462;
const today = () => new Date().toLocaleDateString("en-CA");
const toLb = (v: number, unit: Unit) => (unit === "kg" ? v * LB_PER_KG : v);
const fmt = (lb: number, unit: Unit) => `${fromLb(lb, unit).toFixed(1)} ${unit}`;
const shortDate = (d: string) =>
  new Date(d + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
const num = (s: string) => {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const SOURCE_ICON: Record<BodySource, string> = { manual: "✍️", scale: "📷", report: "📄" };
const METRIC_LABEL: Record<BodyMetric, string> = { weight: "Weight", fat: "Body fat %", muscle: "Muscle" };

type Draft = {
  source: BodySource;
  date: string;
  weight: string;
  bodyFat: string;
  muscle: string;
  bmi: string;
  visceral: string;
  bmr: string;
  file?: Blob;
  previewUrl?: string;
  reading: boolean;
  note?: { text: string; tone: "ok" | "warn" };
};

const emptyDraft = (source: BodySource): Draft => ({
  source,
  date: today(),
  weight: "",
  bodyFat: "",
  muscle: "",
  bmi: "",
  visceral: "",
  bmr: "",
  reading: false,
});

export function BodyTracker({ onBack }: { onBack: () => void }) {
  const [unit, setUnit] = useState<Unit>(loadUnit);
  const [entries, setEntries] = useState<BodyEntry[]>(loadEntries);
  const [goal, setGoal] = useState<BodyGoal | null>(loadGoal);
  const [metric, setMetric] = useState<BodyMetric>("weight");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [viewing, setViewing] = useState<{ url: string; title: string } | null>(null);
  const scaleInput = useRef<HTMLInputElement>(null);
  const reportInput = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const latest = entries[entries.length - 1];

  function changeUnit(u: Unit) {
    setUnit(u);
    saveUnit(u);
  }

  function openDraft(d: Draft) {
    if (draft?.previewUrl) URL.revokeObjectURL(draft.previewUrl);
    setDraft(d);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function closeDraft() {
    if (draft?.previewUrl) URL.revokeObjectURL(draft.previewUrl);
    setDraft(null);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>, source: BodySource) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    const isPdf = picked.type === "application/pdf";
    // Reports keep more pixels so small print stays readable for Gemini and for you later.
    const file = isPdf ? picked : await shrinkImage(picked, source === "report" ? 2200 : 1280, 0.85);
    const base: Draft = {
      ...emptyDraft(source),
      file,
      previewUrl: isPdf ? undefined : URL.createObjectURL(file),
      reading: true,
    };
    openDraft(base);

    try {
      const form = new FormData();
      form.append("image", file, isPdf ? "report.pdf" : "scale.jpg");
      const res = await fetch("/api/read-scale", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't read it.");
      const r = data as ScaleReading;
      const show = (lb: number | null) => (lb == null ? "" : fromLb(lb, unit).toFixed(1));
      const found = r.weightLb != null || r.bodyFatPct != null;
      setDraft((d) =>
        d && d.file === file
          ? {
              ...d,
              reading: false,
              date: r.date ?? d.date,
              weight: show(r.weightLb),
              bodyFat: r.bodyFatPct?.toString() ?? "",
              muscle: show(r.muscleLb),
              bmi: r.bmi?.toString() ?? "",
              visceral: r.visceralFat?.toString() ?? "",
              bmr: r.bmr?.toString() ?? "",
              note: found
                ? { text: "Read by Gemini — check the numbers before saving.", tone: "ok" }
                : { text: "Couldn't find the numbers — type them in. The file will still be saved.", tone: "warn" },
            }
          : d,
      );
    } catch (err) {
      setDraft((d) =>
        d && d.file === file
          ? {
              ...d,
              reading: false,
              note: {
                text: `${err instanceof Error ? err.message : "Couldn't read it."} You can type the numbers in — the file will still be saved.`,
                tone: "warn",
              },
            }
          : d,
      );
    }
  }

  async function saveDraft() {
    if (!draft) return;
    const weight = num(draft.weight);
    if (!weight) return;
    let fileId: string | undefined;
    if (draft.file) {
      try {
        fileId = await putFile(draft.file);
      } catch {
        fileId = undefined; // storage full/blocked: keep the numbers anyway
      }
    }
    const opt = (s: string) => num(s) ?? undefined;
    const entry: BodyEntry = {
      id: newId(),
      date: draft.date || today(),
      weightLb: Math.round(toLb(weight, unit) * 10) / 10,
      bodyFatPct: opt(draft.bodyFat),
      muscleLb: opt(draft.muscle) !== undefined ? Math.round(toLb(num(draft.muscle)!, unit) * 10) / 10 : undefined,
      bmi: opt(draft.bmi),
      visceralFat: opt(draft.visceral),
      bmr: opt(draft.bmr),
      source: draft.source,
      fileId,
      fileType: draft.file?.type,
    };
    const next = [...entries, entry].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    setEntries(next);
    saveEntries(next);
    closeDraft();
  }

  async function removeEntry(e: BodyEntry) {
    if (!window.confirm(`Delete the ${shortDate(e.date)} entry${e.fileId ? " and its saved file" : ""}?`)) return;
    const next = entries.filter((x) => x.id !== e.id);
    setEntries(next);
    saveEntries(next);
    if (e.fileId) await deleteFile(e.fileId);
  }

  async function viewFile(e: BodyEntry) {
    if (!e.fileId) return;
    const blob = await getFile(e.fileId);
    if (!blob) return window.alert("That file is no longer on this device.");
    const url = URL.createObjectURL(blob);
    if (blob.type === "application/pdf") {
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } else {
      setViewing({ url, title: `${e.source === "report" ? "Report" : "Scale photo"} · ${shortDate(e.date)}` });
    }
  }

  function updateGoal(g: BodyGoal | null) {
    setGoal(g);
    saveGoal(g);
  }

  return (
    <section className="mt-2">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Body tracker</h1>
        <div role="group" aria-label="Weight unit" className="flex shrink-0 rounded-full border border-zinc-700 p-0.5 text-xs font-semibold">
          {(["lb", "kg"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => changeUnit(u)}
              aria-pressed={unit === u}
              className={`rounded-full px-3 py-1 transition ${unit === u ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              {u}
            </button>
          ))}
        </div>
      </header>
      <p className="mt-1 text-sm text-zinc-400">
        {latest
          ? `Latest ${fmt(latest.weightLb, unit)}${latest.bodyFatPct != null ? ` · ${latest.bodyFatPct}% fat` : ""} · ${shortDate(latest.date)}`
          : "Log your weight to track your cut or bulk."}
      </p>

      <GoalCard goal={goal} entries={entries} unit={unit} onChange={updateGoal} />

      <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div role="group" aria-label="Chart metric" className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-800 p-1">
          {(Object.keys(METRIC_LABEL) as BodyMetric[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              aria-pressed={metric === m}
              className={`h-8 rounded-lg text-xs font-semibold transition ${
                metric === m ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {METRIC_LABEL[m]}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <BodyChart entries={entries} metric={metric} unit={unit} goalLb={goal?.type !== "maintain" ? goal?.targetLb : undefined} />
        </div>
      </div>

      <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-zinc-500">Add a measurement</h2>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <AddButton icon="✍️" label="Type it in" onClick={() => openDraft(emptyDraft("manual"))} />
        <AddButton icon="📷" label="Scale photo" onClick={() => scaleInput.current?.click()} />
        <AddButton icon="📄" label="Scan report" onClick={() => reportInput.current?.click()} />
      </div>
      <input ref={scaleInput} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onFile(e, "scale")} />
      <input ref={reportInput} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => onFile(e, "report")} />

      {draft && (
        <div ref={formRef} className="mt-4 scroll-mt-4">
          <EntryForm draft={draft} unit={unit} onChange={setDraft} onCancel={closeDraft} onSave={saveDraft} />
        </div>
      )}

      <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-zinc-500">History</h2>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">No entries yet.</p>
      ) : (
        <ul className="mt-2 grid grid-cols-1 gap-2">
          {[...entries].reverse().map((e, i, arr) => {
            const prev = arr[i + 1];
            const delta = prev ? fromLb(e.weightLb - prev.weightLb, unit) : null;
            const good = delta !== null && goal && ((goal.type === "lose" && delta < 0) || (goal.type === "gain" && delta > 0));
            return (
              <li key={e.id} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5">
                <span className="text-lg" aria-label={e.source}>
                  {SOURCE_ICON[e.source]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold tabular-nums">
                    {fmt(e.weightLb, unit)}
                    {delta !== null && Math.abs(delta) >= 0.05 && (
                      <span className={`ml-2 text-xs font-semibold ${good ? "text-lime-400" : "text-zinc-500"}`}>
                        {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {shortDate(e.date)}
                    {e.bodyFatPct != null && ` · ${e.bodyFatPct}% fat`}
                    {e.muscleLb != null && ` · ${fmt(e.muscleLb, unit)} muscle`}
                    {e.bmi != null && ` · BMI ${e.bmi}`}
                  </p>
                </div>
                {e.fileId && (
                  <button
                    type="button"
                    onClick={() => viewFile(e)}
                    className="rounded-lg bg-zinc-800 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
                  >
                    View
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeEntry(e)}
                  aria-label={`Delete ${shortDate(e.date)} entry`}
                  className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-red-300"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-xs text-zinc-500">
        Saved on this device only. Body-scan numbers are for reference — not a medical diagnosis.
      </p>

      <button
        type="button"
        onClick={onBack}
        className="mt-6 h-12 w-full rounded-xl bg-zinc-800 text-base font-semibold text-zinc-100 transition hover:bg-zinc-700 active:scale-[0.98]"
      >
        Back
      </button>

      {viewing && (
        <FileViewer
          url={viewing.url}
          title={viewing.title}
          onClose={() => {
            URL.revokeObjectURL(viewing.url);
            setViewing(null);
          }}
        />
      )}
    </section>
  );
}

function AddButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-20 flex-col items-center justify-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 text-sm font-semibold text-zinc-200 transition hover:border-lime-400 active:scale-[0.97]"
    >
      <span className="text-2xl" aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  );
}

function GoalCard({
  goal,
  entries,
  unit,
  onChange,
}: {
  goal: BodyGoal | null;
  entries: BodyEntry[];
  unit: Unit;
  onChange: (g: BodyGoal | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState<GoalType>(goal?.type ?? "lose");
  const [target, setTarget] = useState(goal ? fromLb(goal.targetLb, unit).toFixed(1) : "");

  useEffect(() => {
    if (!editing) {
      setType(goal?.type ?? "lose");
      setTarget(goal ? fromLb(goal.targetLb, unit).toFixed(1) : "");
    }
  }, [goal, unit, editing]);

  if (!goal || editing) {
    const t = num(target);
    return (
      <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="font-semibold">{goal ? "Edit goal" : "Set a goal"}</p>
        <div role="group" aria-label="Goal type" className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-zinc-800 p-1">
          {(["lose", "gain", "maintain"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setType(g)}
              aria-pressed={type === g}
              className={`h-9 rounded-lg text-sm font-semibold capitalize transition ${
                type === g ? "bg-lime-400 text-zinc-950" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {g === "lose" ? "Lose" : g === "gain" ? "Gain" : "Maintain"}
            </button>
          ))}
        </div>
        <label className="mt-3 block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Target weight ({unit})</span>
          <input
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value.replace(/[^\d.,]/g, ""))}
            placeholder={entries.length ? fromLb(entries[entries.length - 1].weightLb, unit).toFixed(0) : "170"}
            className="mt-1 h-11 w-full rounded-lg bg-zinc-800 px-3 text-base tabular-nums placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-lime-400"
          />
        </label>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={!t}
            onClick={() => {
              if (!t) return;
              onChange({ type, targetLb: Math.round(toLb(t, unit) * 10) / 10 });
              setEditing(false);
            }}
            className="h-11 flex-1 rounded-xl bg-lime-400 font-semibold text-zinc-950 transition hover:bg-lime-300 disabled:opacity-40"
          >
            Save goal
          </button>
          {goal && (
            <button type="button" onClick={() => setEditing(false)} className="h-11 rounded-xl px-4 text-zinc-400 hover:text-zinc-100">
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  const start = entries[0];
  const latest = entries[entries.length - 1];
  const verb = goal.type === "lose" ? "Lose" : goal.type === "gain" ? "Gain" : "Maintain";
  let status = "Log a weigh-in to track progress.";
  let pct = 0;
  if (start && latest) {
    const change = latest.weightLb - start.weightLb;
    const toGo = goal.targetLb - latest.weightLb;
    if (goal.type === "maintain") {
      const off = Math.abs(toGo);
      pct = Math.max(0, 1 - off / 5);
      status = off <= 2 ? "On target — within 2 lb" : `${fmt(off, unit)} ${toGo < 0 ? "above" : "below"} target`;
    } else {
      const dir = goal.type === "lose" ? -1 : 1;
      const total = (goal.targetLb - start.weightLb) * dir;
      const doneAmt = change * dir;
      pct = total > 0 ? Math.min(1, Math.max(0, doneAmt / total)) : doneAmt >= 0 ? 1 : 0;
      const reached = toGo * dir <= 0;
      const moved = `${goal.type === "lose" ? (change <= 0 ? "Lost" : "Up") : change >= 0 ? "Gained" : "Down"} ${fmt(Math.abs(change), unit)}`;
      status = reached ? `Goal reached 🎉 · ${moved}` : `${moved} · ${fmt(Math.abs(toGo), unit)} to go`;
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-lime-400/30 bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-lime-300">Goal</p>
          <p className="text-lg font-semibold">
            {verb} {goal.type === "maintain" ? "at" : "to"} {fmt(goal.targetLb, unit)}
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <button type="button" onClick={() => setEditing(true)} className="text-zinc-400 hover:text-zinc-100">
            Edit
          </button>
          <button
            type="button"
            onClick={() => window.confirm("Remove your goal?") && onChange(null)}
            className="text-zinc-500 hover:text-red-300"
          >
            Remove
          </button>
        </div>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-lime-400 transition-[width]" style={{ width: `${pct * 100}%` }} />
      </div>
      <p className="mt-2 text-sm text-zinc-300">{status}</p>
      {start && latest && goal.type !== "maintain" && (
        <p className="mt-0.5 text-xs text-zinc-500">
          Start {fmt(start.weightLb, unit)} ({shortDate(start.date)}) → now {fmt(latest.weightLb, unit)}
        </p>
      )}
    </div>
  );
}

function EntryForm({
  draft,
  unit,
  onChange,
  onCancel,
  onSave,
}: {
  draft: Draft;
  unit: Unit;
  onChange: (d: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const set = (k: keyof Draft) => (v: string) => onChange({ ...draft, [k]: v });
  const canSave = !draft.reading && num(draft.weight) !== null;
  const title = draft.source === "manual" ? "New weigh-in" : draft.source === "scale" ? "Scale photo" : "Body-scan report";

  return (
    <div className="rounded-2xl border border-lime-400/40 bg-zinc-900 p-4">
      <p className="font-semibold">{title}</p>

      {draft.file && (
        <div className="mt-3 flex items-center gap-3">
          {draft.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.previewUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
          ) : (
            <div className="grid h-20 w-20 place-items-center rounded-lg bg-zinc-800 text-2xl">📄</div>
          )}
          <p className="text-sm text-zinc-400" aria-live="polite">
            {draft.reading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-lime-400" />
                Reading the numbers…
              </span>
            ) : (
              <span className={draft.note?.tone === "warn" ? "text-amber-300" : "text-lime-300"}>{draft.note?.text}</span>
            )}
          </p>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Field label="Date" type="date" value={draft.date} onChange={set("date")} />
        <Field label={`Weight (${unit})*`} value={draft.weight} onChange={set("weight")} placeholder="0.0" />
        <Field label="Body fat %" value={draft.bodyFat} onChange={set("bodyFat")} placeholder="optional" />
        <Field label={`Muscle (${unit})`} value={draft.muscle} onChange={set("muscle")} placeholder="optional" />
        {(draft.source === "report" || draft.bmi || draft.visceral || draft.bmr) && (
          <>
            <Field label="BMI" value={draft.bmi} onChange={set("bmi")} placeholder="optional" />
            <Field label="Visceral fat" value={draft.visceral} onChange={set("visceral")} placeholder="optional" />
            <Field label="BMR (kcal)" value={draft.bmr} onChange={set("bmr")} placeholder="optional" className="col-span-2" />
          </>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="h-11 flex-1 rounded-xl bg-lime-400 font-semibold text-zinc-950 transition hover:bg-lime-300 disabled:opacity-40"
        >
          Save entry
        </button>
        <button type="button" onClick={onCancel} className="h-11 rounded-xl px-4 text-zinc-400 hover:text-zinc-100">
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "date";
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
      <input
        type={type}
        inputMode={type === "date" ? undefined : "decimal"}
        value={value}
        max={type === "date" ? today() : undefined}
        placeholder={placeholder}
        onChange={(e) => onChange(type === "date" ? e.target.value : e.target.value.replace(/[^\d.,]/g, ""))}
        className="mt-1 h-11 w-full rounded-lg bg-zinc-800 px-3 text-base tabular-nums text-zinc-100 [color-scheme:dark] placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-lime-400"
      />
    </label>
  );
}

function FileViewer({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[60] overflow-y-auto bg-zinc-950/95">
      <div className="sticky top-0 flex items-center justify-between gap-3 bg-zinc-950/90 px-4 py-3 backdrop-blur">
        <p className="font-semibold">{title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-9 w-9 place-items-center rounded-full bg-zinc-800 text-lg text-zinc-200 hover:bg-zinc-700"
        >
          ×
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={title} className="mx-auto w-full max-w-3xl px-2 pb-8" />
    </div>
  );
}
