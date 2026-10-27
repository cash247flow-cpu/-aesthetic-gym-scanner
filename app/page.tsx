"use client";

import { useEffect, useRef, useState } from "react";
import type { PlanResult, SessionKey } from "@/lib/plan";
import { ResultView } from "@/components/ResultView";
import { CardioSession } from "@/components/CardioSession";

type View =
  | { state: "upload" }
  | { state: "loading" }
  | { state: "cardio" }
  | { state: "result"; plan: PlanResult; session: SessionKey };

const SESSION_BUTTONS: { key: SessionKey; label: string; hint: string }[] = [
  { key: "push", label: "Push", hint: "Chest · Shoulders · Triceps" },
  { key: "pull", label: "Pull", hint: "Back · Rear delts · Biceps" },
  { key: "legs", label: "Legs", hint: "Quads · Hams · Calves · Abs" },
];

export default function Home() {
  const [view, setView] = useState<View>({ state: "upload" });
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  async function run(session: SessionKey) {
    if (!photo) return;
    setError(null);
    setView({ state: "loading" });
    try {
      const form = new FormData();
      form.append("image", await shrinkImage(photo), "gym.jpg");
      const idRes = await fetch("/api/identify", { method: "POST", body: form });
      const idData = await idRes.json();
      if (!idRes.ok) throw new Error(idData.error || "Couldn't read the photo.");

      const plan = await fetchPlan(session, idData.equipment);
      setView({ state: "result", plan, session });
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setView({ state: "upload" });
    }
  }

  // Rebuild the plan after the user adds/removes equipment chips. No new photo or Gemini call.
  async function changeEquipment(session: SessionKey, equipment: string[]) {
    const plan = await fetchPlan(session, equipment);
    setView({ state: "result", plan, session });
  }

  // Back from a cardio-only day: keep the photo so a lifting session can still be picked.
  function backToSessions() {
    setView({ state: "upload" });
    window.scrollTo({ top: 0 });
  }

  function reset() {
    setPhoto(null);
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    setView({ state: "upload" });
    window.scrollTo({ top: 0 });
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-4 pb-10 pt-6 sm:pt-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lime-400">
        Aesthetic Gym Scanner
      </p>

      {view.state === "upload" && (
        <section className="mt-2">
          <h1 className="text-3xl font-bold tracking-tight">Scan your gym</h1>
          <p className="mt-1 text-sm text-zinc-400">
            One photo of the floor. Pick a session. Get your Natty Blueprint workout with only the
            equipment you have.
          </p>

          <input
            ref={inputRef}
            id="photo"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPick}
            className="sr-only"
          />

          {preview ? (
            <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Selected gym photo" className="aspect-[4/3] w-full object-cover" />
            </div>
          ) : (
            <label
              htmlFor="photo"
              className="mt-5 flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-700 bg-zinc-900/60 text-zinc-400 transition hover:border-lime-400/60 hover:text-zinc-200"
            >
              <CameraIcon />
              <span className="text-sm">No photo yet</span>
            </label>
          )}

          <label
            htmlFor="photo"
            className="mt-3 flex h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-zinc-100 text-base font-semibold text-zinc-900 transition active:scale-[0.98] hover:bg-white"
          >
            {photo ? "Retake / change photo" : "Take / Upload photo"}
          </label>

          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <h2 className="mt-7 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Choose today&apos;s session
          </h2>
          <div className="mt-2 grid gap-3">
            {SESSION_BUTTONS.map((s) => (
              <button
                key={s.key}
                type="button"
                disabled={!photo}
                onClick={() => run(s.key)}
                className="flex h-16 w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-5 text-left transition enabled:hover:border-lime-400 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="text-xl font-bold">{s.label}</span>
                <span className="text-xs text-zinc-400">{s.hint}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setView({ state: "cardio" });
                window.scrollTo({ top: 0 });
              }}
              className="flex h-16 w-full items-center justify-between rounded-xl border border-sky-400/30 bg-zinc-900 px-5 text-left transition hover:border-sky-400 active:scale-[0.98]"
            >
              <span className="text-xl font-bold text-sky-300">Cardio</span>
              <span className="text-right text-xs text-zinc-400">
                Treadmill · StairMaster
                <br />
                <span className="text-zinc-500">No photo needed</span>
              </span>
            </button>
          </div>
        </section>
      )}

      {view.state === "cardio" && <CardioSession onBack={backToSessions} />}

      {view.state === "loading" && (
        <section className="flex min-h-[60dvh] flex-col items-center justify-center gap-4" aria-live="polite">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-700 border-t-lime-400" />
          <p className="text-lg font-medium">Reading the gym…</p>
        </section>
      )}

      {view.state === "result" && (
        <ResultView
          plan={view.plan}
          onReset={reset}
          onEquipmentChange={(eq) => changeEquipment(view.session, eq)}
        />
      )}
    </main>
  );
}

async function fetchPlan(session: SessionKey, equipment: string[]): Promise<PlanResult> {
  const res = await fetch("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session, equipment }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Couldn't build the plan.");
  return data;
}

/** Downscale phone photos (often 5–15 MB) to ~1600px JPEG before upload. */
async function shrinkImage(file: File, maxSide = 1600): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file; // e.g. HEIC on a browser that can't decode it — let the server try.
  }
}

function CameraIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
