"use client";

import { useEffect, useRef, useState } from "react";
import type { PlanResult, SessionKey } from "@/lib/plan";
import { ResultView } from "@/components/ResultView";
import { CardioSession } from "@/components/CardioSession";
import { WinsView } from "@/components/WinsView";
import { BodyTracker } from "@/components/BodyTracker";
import { TodayCard } from "@/components/TodayCard";
import { HabitsView } from "@/components/HabitsView";
import { MealPlanView } from "@/components/MealPlanView";
import { MEALS, loadEaten, loadPhase } from "@/lib/meals";
import { SupplementsView } from "@/components/SupplementsView";
import { loadCleared, loadTaken, takenCount } from "@/lib/supplements";
import { HABITS, doneCount, loadHabitLogs, streak, todayStr } from "@/lib/habits";
import { WeekEditor } from "@/components/WeekEditor";
import { DEFAULT_WEEK, loadWeek, saveWeek, type WeekPlan } from "@/lib/schedule";
import { shrinkImage } from "@/lib/image";
import { WeekStrip } from "@/components/WeekStrip";
import { TabBar, type Tab } from "@/components/TabBar";
import { MoreHub, ProgressHub } from "@/components/HubViews";
import { SleepHelper } from "@/components/SleepHelper";
import { loadSleep, type SleepSettings } from "@/lib/sleep";
import { Accent, Brand, TITLE } from "@/components/ui";
import { MissedCard } from "@/components/MissedCard";
import { migrateRenamedExercises } from "@/lib/renames";
import { dayName, type DayItem, type MakeupFor } from "@/lib/missed";

type View =
  | { state: "upload" }
  | { state: "loading" }
  | { state: "cardio" }
  | { state: "body" }
  | { state: "week" }
  | { state: "habits" }
  | { state: "meals" }
  | { state: "supps" }
  | { state: "sleep" }
  | { state: "progress" }
  | { state: "more" }
  | { state: "wins"; back: View }
  | { state: "result"; plan: PlanResult; session: SessionKey; withAbs: boolean };

const SESSION_BUTTONS: { key: SessionKey; label: string; hint: string }[] = [
  { key: "push", label: "Push", hint: "Chest · Shoulders · Triceps" },
  { key: "pull", label: "Pull", hint: "Back · Rear delts · Biceps" },
  { key: "legs", label: "Legs", hint: "Quads · Hams · Calves · Abs" },
  { key: "pump", label: "Pump", hint: "Chest · Rear delts · Biceps" },
  { key: "abs", label: "Abs", hint: "Leg raises · Crunches" },
];

export default function Home() {
  const [view, setView] = useState<View>({ state: "upload" });
  // Where a screen opened from the Progress or More tab goes back to.
  const [returnTo, setReturnTo] = useState<View>({ state: "upload" });
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A session tapped before there's a gym photo: it starts as soon as the photo is taken.
  const [pending, setPending] = useState<{ session: SessionKey; withAbs: boolean } | null>(null);
  // Set while making up a missed day; the workout or cardio is then recorded against that day.
  const [makeup, setMakeup] = useState<MakeupFor | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // The saved week and today's date only exist in the browser; the page is prerendered.
  const [week, setWeek] = useState<WeekPlan>(DEFAULT_WEEK);
  const [todayIdx, setTodayIdx] = useState<number | null>(null);
  const [sleep, setSleep] = useState<SleepSettings | null>(null);
  useEffect(() => {
    migrateRenamedExercises();
    setWeek(loadWeek());
    setTodayIdx(new Date().getDay());
  }, []);
  const todayChoice = todayIdx === null ? null : week[todayIdx].choice;
  // Today's habit, meal and supplement progress for the home tiles; re-read whenever home shows.
  const [habitSummary, setHabitSummary] = useState<{ done: number; streak: number } | null>(null);
  const [mealsEaten, setMealsEaten] = useState<number | null>(null);
  const [supps, setSupps] = useState<{ taken: number; total: number } | null>(null);
  useEffect(() => {
    if (view.state !== "upload") return;
    const logs = loadHabitLogs();
    setHabitSummary({ done: doneCount(logs[todayStr()]), streak: streak(logs, "all") });
    const eaten = loadEaten()[todayStr()] ?? {};
    setMealsEaten(MEALS[loadPhase()].filter((m) => eaten[m.id]).length);
    setSupps(takenCount(loadTaken(), todayStr(), loadCleared()));
  }, [view.state]);

  // Closing the camera without a photo cancels the session that was waiting for it.
  useEffect(() => {
    const input = inputRef.current;
    const onCancel = () => setPending(null);
    input?.addEventListener("cancel", onCancel);
    return () => input?.removeEventListener("cancel", onCancel);
  }, []);

  function changeWeek(next: WeekPlan | null) {
    setWeek(next ?? DEFAULT_WEEK);
    saveWeek(next);
  }

  function show(next: View) {
    setView(next);
    window.scrollTo({ top: 0 });
  }

  function go(state: "cardio" | "body" | "week" | "habits" | "meals" | "supps" | "sleep") {
    const hub = view.state === "progress" || view.state === "more" ? view : ({ state: "upload" } as View);
    setReturnTo(hub);
    if (state === "sleep") setSleep(loadSleep());
    show({ state });
  }

  function onTab(tab: Tab) {
    if (tab === "meals") {
      setReturnTo({ state: "upload" });
      show({ state: "meals" });
    } else show({ state: tab === "home" ? "upload" : tab });
  }

  function openCamera() {
    inputRef.current?.click();
  }

  function scan() {
    setPending(null);
    setMakeup(null);
    if (view.state !== "upload") show({ state: "upload" });
    openCamera();
  }

  // Start a session: right away with a gym photo, or open the camera and start once it's taken.
  function start(session: SessionKey, withAbs = false, makeupFor: MakeupFor | null = null) {
    setMakeup(makeupFor);
    if (photo) return void run(session, withAbs, photo);
    setPending({ session, withAbs });
    openCamera();
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
    if (pending) {
      setPending(null);
      void run(pending.session, pending.withAbs, file);
    }
  }

  async function run(session: SessionKey, withAbs: boolean, file: File) {
    setError(null);
    setView({ state: "loading" });
    try {
      const form = new FormData();
      form.append("image", await shrinkImage(file), "gym.jpg");
      const idRes = await fetch("/api/identify", { method: "POST", body: form });
      const idData = await idRes.json();
      if (!idRes.ok) throw new Error(idData.error || "Couldn't read the photo.");

      const plan = await fetchPlan(session, idData.equipment, withAbs);
      show({ state: "result", plan, session, withAbs });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setView({ state: "upload" });
    }
  }

  // Rebuild the plan after the user adds/removes equipment chips. No new photo or Gemini call.
  async function changeEquipment(session: SessionKey, withAbs: boolean, equipment: string[]) {
    const plan = await fetchPlan(session, equipment, withAbs);
    setView({ state: "result", plan, session, withAbs });
  }

  // Back from a screen: to the tab it was opened from. Keeps the photo so a session can still be picked.
  function back() {
    show(returnTo);
  }

  function showWins() {
    setView((v) => ({ state: "wins", back: v.state === "wins" ? v.back : v }));
    window.scrollTo({ top: 0 });
  }

  function openCardio(makeupFor: MakeupFor | null = null) {
    setMakeup(makeupFor);
    go("cardio");
  }

  function makeUp(item: DayItem) {
    const label = { date: item.date, label: `${dayName(item.date)} · ${item.label}` };
    if (item.kind === "cardio") openCardio(label);
    else start(item.session ?? "push", false, label);
  }

  function reset() {
    setMakeup(null);
    setPhoto(null);
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    show({ state: "upload" });
  }

  const tab: Tab | null =
    view.state === "upload"
      ? "home"
      : view.state === "meals"
        ? "meals"
        : ["progress", "wins", "body"].includes(view.state)
          ? "progress"
          : ["more", "habits", "supps", "week", "sleep"].includes(view.state)
            ? "more"
            : null;
  // Workouts, cardio and loading get the whole screen.
  const showTabs = !["loading", "result", "cardio"].includes(view.state);

  return (
    <main className={`mx-auto min-h-dvh w-full max-w-md px-4 pt-6 sm:pt-10 ${showTabs ? "pb-32" : "pb-10"}`}>
      <Brand />

      <input
        ref={inputRef}
        id="photo"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPick}
        className="sr-only"
      />

      {view.state === "upload" && (
        <section className="mt-2">
          <p className="text-sm text-zinc-400">Hello 👋</p>
          <h1 className={TITLE}>
            Build Your Ideal <Accent>Physique</Accent>
          </h1>

          <WeekStrip />

          <TodayCard week={week} hasPhoto={!!photo} onStart={start} onCardio={() => openCardio()} onEditWeek={() => go("week")} />

          <MissedCard onMakeUp={makeUp} />

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Tile
              icon="✅"
              label="Habits"
              value={habitSummary ? `${habitSummary.done}/${HABITS.length}` : ""}
              extra={habitSummary && habitSummary.streak > 0 ? `🔥 ${habitSummary.streak}` : undefined}
              onClick={() => go("habits")}
            />
            <Tile icon="🍽️" label="Meals" value={mealsEaten !== null ? `${mealsEaten}/3` : ""} onClick={() => go("meals")} />
            <Tile icon="💊" label="Supps" value={supps ? `${supps.taken}/${supps.total}` : ""} onClick={() => go("supps")} />
          </div>

          <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-zinc-500">Pick a session</h2>
          <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SESSION_BUTTONS.map((s) => {
              const isToday = todayChoice === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => start(s.key)}
                  aria-label={`${s.label}: ${s.hint}${isToday ? " (today)" : ""}`}
                  className={`h-11 shrink-0 rounded-full border px-5 text-sm font-semibold transition active:scale-95 ${
                    isToday ? "border-lime-400 bg-lime-400/10 text-lime-300" : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => openCardio()}
              className="h-11 shrink-0 rounded-full border border-sky-400/50 bg-zinc-900 px-5 text-sm font-semibold text-sky-300 transition hover:border-sky-400 active:scale-95"
            >
              Cardio
            </button>
          </div>

          {preview ? (
            <div className="relative mt-4 overflow-hidden rounded-2xl border border-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Selected gym photo" className="h-40 w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/90 to-transparent px-3 pb-2.5 pt-8">
                <span className="text-sm font-semibold text-lime-300">Gym scanned ✓ · pick a session</span>
                <label htmlFor="photo" className="cursor-pointer rounded-full bg-zinc-100/90 px-3 py-1 text-xs font-semibold text-zinc-900">
                  Retake
                </label>
              </div>
            </div>
          ) : (
            <label
              htmlFor="photo"
              onClick={() => setPending(null)}
              className="mt-4 flex w-full cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-zinc-700 bg-zinc-900/60 p-4 text-zinc-300 transition hover:border-lime-400/60"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-zinc-800 text-lime-300">
                <CameraIcon />
              </span>
              <span className="min-w-0 text-sm">
                <span className="block font-semibold text-zinc-100">Scan your gym</span>
                One photo of the floor — your workout only uses the equipment in it.
              </span>
            </label>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
        </section>
      )}

      {view.state === "progress" && <ProgressHub onWins={showWins} onBody={() => go("body")} />}

      {view.state === "more" && (
        <MoreHub
          onHabits={() => go("habits")}
          onSupps={() => go("supps")}
          onWeek={() => go("week")}
          onSleep={() => go("sleep")}
          onCardio={() => openCardio()}
        />
      )}

      {view.state === "cardio" && <CardioSession onBack={back} onShowWins={showWins} makeup={makeup ?? undefined} />}

      {view.state === "body" && <BodyTracker onBack={back} />}

      {view.state === "week" && <WeekEditor week={week} onChange={changeWeek} onBack={back} />}

      {view.state === "habits" && <HabitsView onBack={back} />}

      {view.state === "sleep" && sleep && <SleepHelper settings={sleep} onChange={setSleep} onBack={back} />}

      {view.state === "meals" && <MealPlanView onBack={back} />}

      {view.state === "supps" && <SupplementsView onBack={back} />}

      {view.state === "wins" && <WinsView onBack={() => show(view.back)} />}

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
          onEquipmentChange={(eq) => changeEquipment(view.session, view.withAbs, eq)}
          onShowWins={showWins}
          makeup={makeup ?? undefined}
        />
      )}

      {showTabs && <TabBar active={tab} onTab={onTab} onScan={scan} />}
    </main>
  );
}

function Tile({ icon, label, value, extra, onClick }: { icon: string; label: string; value: string; extra?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-left transition hover:border-lime-400/60 active:scale-[0.97]"
    >
      <span aria-hidden className="text-lg">
        {icon}
      </span>
      <span className="mt-1 text-xs text-zinc-400">{label}</span>
      <span className="flex items-baseline gap-1.5 text-base font-bold tabular-nums">
        {value}
        {extra && <span className="text-xs font-semibold text-amber-300">{extra}</span>}
      </span>
    </button>
  );
}

async function fetchPlan(session: SessionKey, equipment: string[], withAbs = false): Promise<PlanResult> {
  const res = await fetch("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session, equipment, withAbs }),
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
