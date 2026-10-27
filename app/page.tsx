"use client";

import { useEffect, useRef, useState } from "react";
import type { PlanResult, SessionKey } from "@/lib/plan";
import { ResultView } from "@/components/ResultView";
import { CardioSession } from "@/components/CardioSession";
import { WinsView } from "@/components/WinsView";
import { BodyTracker } from "@/components/BodyTracker";
import { TodayCard } from "@/components/TodayCard";
import { WeekEditor } from "@/components/WeekEditor";
import { DEFAULT_WEEK, loadWeek, saveWeek, type WeekPlan } from "@/lib/schedule";
import { shrinkImage } from "@/lib/image";

type View =
  | { state: "upload" }
  | { state: "loading" }
  | { state: "cardio" }
  | { state: "body" }
  | { state: "week" }
  | { state: "wins"; back: View }
  | { state: "result"; plan: PlanResult; session: SessionKey };

const SESSION_BUTTONS: { key: SessionKey; label: string; hint: string }[] = [
  { key: "push", label: "Push", hint: "Chest · Shoulders · Triceps" },
  { key: "pull", label: "Pull", hint: "Back · Rear delts · Biceps" },
  { key: "legs", label: "Legs", hint: "Quads · Hams · Calves · Abs" },
  { key: "pump", label: "Pump", hint: "Chest · Rear delts · Biceps" },
];

export default function Home() {
  const [view, setView] = useState<View>({ state: "upload" });
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // The saved week and today's date only exist in the browser; the page is prerendered.
  const [week, setWeek] = useState<WeekPlan>(DEFAULT_WEEK);
  const [todayIdx, setTodayIdx] = useState<number | null>(null);
  useEffect(() => {
    setWeek(loadWeek());
    setTodayIdx(new Date().getDay());
  }, []);
  const todayChoice = todayIdx === null ? null : week[todayIdx].choice;

  function changeWeek(next: WeekPlan | null) {
    setWeek(next ?? DEFAULT_WEEK);
    saveWeek(next);
  }

  function go(state: "cardio" | "body" | "week") {
    setView({ state });
    window.scrollTo({ top: 0 });
  }

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

  function showWins() {
    setView((v) => ({ state: "wins", back: v.state === "wins" ? v.back : v }));
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
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lime-400">Aesthetic Gym Scanner</p>
        {view.state === "upload" && (
          <button
            type="button"
            onClick={showWins}
            className="rounded-full border border-amber-400/40 px-3 py-1 text-xs font-semibold text-amber-300 transition hover:bg-amber-400/10 active:scale-95"
          >
            🏆 Your wins
          </button>
        )}
      </div>

      {view.state === "upload" && (
        <section className="mt-2">
          <h1 className="text-3xl font-bold tracking-tight">Scan your gym</h1>
          <p className="mt-1 text-sm text-zinc-400">
            One photo of the floor. Pick a session. Get your Natty Blueprint workout with only the
            equipment you have.
          </p>

          <TodayCard
            week={week}
            hasPhoto={!!photo}
            photoInputId="photo"
            onStart={run}
            onCardio={() => go("cardio")}
            onEditWeek={() => go("week")}
          />

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
            Or pick any session
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
                <span className="flex items-center gap-2 text-xl font-bold">
                  {s.label}
                  {todayChoice === s.key && (
                    <span className="rounded-full bg-lime-400/15 px-2 py-0.5 text-[11px] font-semibold text-lime-300">Today</span>
                  )}
                </span>
                <span className="text-xs text-zinc-400">{s.hint}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => go("cardio")}
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

          <h2 className="mt-7 text-xs font-semibold uppercase tracking-wider text-zinc-500">Track your body</h2>
          <div className="mt-2">
            <button
              type="button"
              onClick={() => go("body")}
              className="flex h-16 w-full items-center justify-between rounded-xl border border-violet-400/30 bg-zinc-900 px-5 text-left transition hover:border-violet-400 active:scale-[0.98]"
            >
              <span className="text-xl font-bold text-violet-300">📈 Body tracker</span>
              <span className="text-right text-xs text-zinc-400">
                Weight goal · graph
                <br />
                <span className="text-zinc-500">Scale photo · scan reports</span>
              </span>
            </button>
          </div>
        </section>
      )}

      {view.state === "cardio" && <CardioSession onBack={backToSessions} onShowWins={showWins} />}

      {view.state === "body" && <BodyTracker onBack={backToSessions} />}

      {view.state === "week" && <WeekEditor week={week} onChange={changeWeek} onBack={backToSessions} />}

      {view.state === "wins" && (
        <WinsView
          onBack={() => {
            setView(view.back);
            window.scrollTo({ top: 0 });
          }}
        />
      )}

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
          onShowWins={showWins}
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

function CameraIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
