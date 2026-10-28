"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { Alternative, PlannedExercise, PlanResult } from "@/lib/plan";
import { loadSwaps, saveSwaps, type SavedSwaps } from "@/lib/swaps";
import { MuscleMap } from "@/components/MuscleMap";
import { musclesFor } from "@/lib/muscles";
import { CANONICAL_EQUIPMENT } from "@/lib/equipment";
import { RestTimer, defaultRestSeconds, unlockAudio, type RestRequest } from "@/components/RestTimer";
import { SetLogger, loadUnit, saveUnit, type Unit } from "@/components/SetLogger";
import {
  CardioCard,
  DEFAULT_CARDIO,
  MACHINE_LABEL,
  loadCardioPlan,
  saveCardioPlan,
  type CardioPlan,
  type CardioPosition,
} from "@/components/CardioCard";
import { Celebrate } from "@/components/Celebrate";
import { PreWorkoutReminder } from "@/components/PreWorkoutReminder";
import { ExerciseGuide, hasGuide } from "@/components/ExerciseGuide";
import { finishWorkout, type Summary } from "@/lib/wins";
import type { MakeupFor } from "@/lib/missed";
import { AccentLast, TITLE } from "@/components/ui";

export function formatRest(restSeconds: string): string {
  const nums = restSeconds.split(/[–-]/).map((n) => Number(n.trim()));
  if (nums.every((n) => Number.isFinite(n) && n >= 120 && n % 60 === 0)) {
    return `Rest ${nums.map((n) => n / 60).join("–")} min`;
  }
  return `Rest ${restSeconds}s`;
}

const plural = (n: number) => (n === 1 ? "exercise" : "exercises");

const CARDIO_KEY = "__cardio__";
const CARDIO_CHOICE =
  "rounded-full bg-sky-400 px-3 py-1.5 text-sm font-semibold text-zinc-950 transition hover:bg-sky-300 active:scale-95";

type Slide =
  | { kind: "lift"; key: string; ex: PlannedExercise; liftIndex: number }
  | { kind: "cardio"; key: string };

export function ResultView({
  plan,
  onReset,
  onEquipmentChange,
  onShowWins,
  makeup,
}: {
  plan: PlanResult;
  onReset: () => void;
  onEquipmentChange: (equipment: string[]) => Promise<void>;
  onShowWins: () => void;
  makeup?: MakeupFor; // set when this workout makes up a missed day
}) {
  const isLegs = plan.sessionLabel === "Legs & Abs";
  // Swap button choices, remembered between workouts (programmed exercise → chosen alternative).
  const [swaps, setSwaps] = useState<SavedSwaps>(loadSwaps);
  const exercises = applySwaps(plan.exercises, swaps);
  // Abs marker goes before the first abs card, but only if a non-abs card precedes it.
  const firstAbsIndex = exercises.findIndex((e) => e.abs === true);
  const [rest, setRest] = useState<RestRequest | null>(null);
  const [unit, setUnit] = useState<Unit>(loadUnit);
  const [cardio, setCardio] = useState<CardioPlan | null>(loadCardioPlan);
  const [choosingCardio, setChoosingCardio] = useState(false);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState<Record<string, { done: number; total: number }>>({});
  const trackRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // Pages in order: optional cardio, the lifts, optional cardio.
  const liftSlides: Slide[] = exercises.map((ex, i) => ({ kind: "lift", key: ex.name, ex, liftIndex: i }));
  const cardioSlide: Slide | null = cardio ? { kind: "cardio", key: CARDIO_KEY } : null;
  const slides: Slide[] = [
    ...(cardioSlide && cardio?.position === "before" ? [cardioSlide] : []),
    ...liftSlides,
    ...(cardioSlide && cardio?.position === "after" ? [cardioSlide] : []),
  ];
  const count = slides.length;
  const liftCount = exercises.length;
  const isComplete = (key: string) => {
    const p = progress[key];
    return !!p && p.total > 0 && p.done >= p.total;
  };
  const allComplete = count > 0 && slides.every((sl) => isComplete(sl.key));
  const current = slides[Math.min(active, count - 1)];
  const [summary, setSummary] = useState<Summary | null>(null);
  const anySetDone = Object.values(progress).some((p) => p.done > 0);

  const record = () =>
    finishWorkout({
      session: plan.sessionLabel,
      label: plan.sessionLabel,
      exercises: exercises.map((e) => e.name),
      unit,
      includeCardio: cardio !== null,
      makeupFor: makeup?.date,
    });

  function finish() {
    setRest(null);
    setSummary(record());
  }

  // Leaving (or closing the app) without tapping Finish still records the sets you logged,
  // so the day counts as trained. Same-day re-saves replace the entry; nothing is doubled.
  const leaveRef = useRef<() => void>(() => {});
  leaveRef.current = () => {
    if (anySetDone || (cardio && progress[CARDIO_KEY]?.done)) record();
  };
  useEffect(() => {
    const onHide = () => leaveRef.current();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      leaveRef.current();
    };
  }, []);

  // One exercise per page: the track scrolls horizontally and snaps to each card.
  const goTo = useCallback((i: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
  }, []);

  function onTrackScroll() {
    const track = trackRef.current;
    if (track && track.clientWidth > 0) setActive(Math.round(track.scrollLeft / track.clientWidth));
  }

  // Editing equipment or removing cardio can shorten the list; don't leave the view past the last card.
  useEffect(() => {
    if (active > count - 1) goTo(Math.max(0, count - 1));
  }, [active, count, goTo]);

  const reportProgress = useCallback((key: string, done: number, total: number) => {
    setProgress((prev) =>
      prev[key]?.done === done && prev[key]?.total === total ? prev : { ...prev, [key]: { done, total } },
    );
  }, []);

  // Finished a page: move on to the next one that still has work left (wrapping around).
  // Nothing left means the whole workout is done, so celebrate.
  function advanceFrom(i: number) {
    const next = Array.from({ length: count - 1 }, (_, k) => (i + 1 + k) % count).find(
      (j) => !isComplete(slides[j].key),
    );
    if (next === undefined) {
      setTimeout(finish, 900);
      return;
    }
    setTimeout(() => {
      goTo(next);
      // If you were down at the set rows, bring the new card's title back into view.
      const nav = navRef.current;
      if (nav && nav.getBoundingClientRect().top < 0) nav.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 450);
  }

  function onSetDone(slideIndex: number, ex: PlannedExercise, allDone: boolean) {
    startRest(ex);
    if (allDone) advanceFrom(slideIndex);
  }

  const onCardioFinishedChange = useCallback(
    (finished: boolean) => reportProgress(CARDIO_KEY, finished ? 1 : 0, 1),
    [reportProgress],
  );

  function updateCardio(next: CardioPlan | null) {
    const moved = next && cardio && next.position !== cardio.position;
    setCardio(next);
    saveCardioPlan(next);
    if (!next) {
      setProgress((prev) => {
        const next = { ...prev };
        delete next[CARDIO_KEY];
        return next;
      });
      return;
    }
    // Follow the cardio card to its new spot (or show it when first added).
    if (moved || !cardio) setTimeout(() => goTo(next.position === "before" ? 0 : liftCount), 50);
  }

  function addCardio(position: CardioPosition) {
    setChoosingCardio(false);
    updateCardio({ ...DEFAULT_CARDIO, position });
  }

  function changeUnit(u: Unit) {
    setUnit(u);
    saveUnit(u);
  }

  function swap(planned: PlannedExercise, from: string, to: string) {
    if (progress[from]?.done && !window.confirm(`Swap ${from} for ${to}? The sets you logged stay saved under ${from}.`)) {
      return;
    }
    const slot = planned.swappedFrom ?? planned.name;
    const next = { ...swaps };
    // Going back to the plan's own pick forgets the saved swap.
    if (to === planned.name) delete next[slot];
    else next[slot] = to;
    setSwaps(next);
    saveSwaps(next);
  }

  function startRest(ex: PlannedExercise) {
    unlockAudio(); // must happen inside the tap so the end-of-rest beep is allowed
    setRest({ id: Date.now(), label: ex.name, seconds: defaultRestSeconds(ex.restSeconds) });
  }

  return (
    <section className={`mt-2 ${rest ? "pb-44" : ""}`}>
      <header>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            {makeup && (
              <p className="mb-1 inline-block rounded-full bg-amber-400/15 px-2.5 py-0.5 text-xs font-semibold text-amber-200">
                ↺ Make-up for {makeup.label}
              </p>
            )}
            <h1 className={TITLE}><AccentLast text={plan.sessionLabel} /></h1>
          </div>
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
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          {isLegs
            ? `${plan.counts.leg} leg ${plural(plan.counts.leg)} + ${plan.counts.abs} ab ${plural(plan.counts.abs)} · ${plan.note}`
            : plan.counts.abs > 0 && plan.counts.leg > 0
              ? `${plan.note} · + ${plan.counts.abs} ab ${plural(plan.counts.abs)} at the end`
              : plan.note}
        </p>
      </header>

      <PreWorkoutReminder />

      <EquipmentEditor equipment={plan.equipment} onChange={onEquipmentChange} />

      {plan.missingNote && (
        <div role="status" className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-3 text-sm text-amber-200">
          {plan.missingNote}
        </div>
      )}

      <div className="mt-4">
        <MuscleMap {...musclesFor(exercises.map((e) => e.name))} compact />
      </div>

      {!cardio && (
        <div className="mt-4">
          {choosingCardio ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-400/5 p-2.5">
              <span className="px-1 text-sm text-zinc-300">Cardio:</span>
              <button type="button" onClick={() => addCardio("before")} className={CARDIO_CHOICE}>
                Before lifting
              </button>
              <button type="button" onClick={() => addCardio("after")} className={CARDIO_CHOICE}>
                After lifting
              </button>
              <button
                type="button"
                onClick={() => setChoosingCardio(false)}
                className="ml-auto px-2 text-sm text-zinc-500 hover:text-zinc-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setChoosingCardio(true)}
              className="rounded-full border border-dashed border-sky-400/60 px-3 py-1.5 text-sm font-medium text-sky-300 transition hover:bg-sky-400/10 active:scale-95"
            >
              + Add cardio (treadmill / StairMaster)
            </button>
          )}
        </div>
      )}

      {count > 0 && (
        <nav ref={navRef} aria-label="Exercises" className="mt-5 scroll-mt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {allComplete
                ? "Workout complete 💪"
                : current?.kind === "cardio"
                  ? `Cardio · ${cardio?.position === "before" ? "warm-up" : "finisher"}`
                  : `Exercise ${(current?.kind === "lift" ? current.liftIndex : 0) + 1} of ${liftCount}`}
            </p>
            <div className="flex gap-1.5">
              <ArrowButton dir="prev" disabled={active <= 0} onClick={() => goTo(active - 1)} />
              <ArrowButton dir="next" disabled={active >= count - 1} onClick={() => goTo(active + 1)} />
            </div>
          </div>
          <ol className="mt-2 flex flex-wrap items-center gap-1.5">
            {slides.map((sl, i) => {
              const done = isComplete(sl.key);
              const isCurrent = i === active;
              const isCardio = sl.kind === "cardio";
              return (
                <Fragment key={sl.key}>
                  {sl.kind === "lift" && sl.liftIndex === firstAbsIndex && sl.liftIndex > 0 && (
                    <li aria-hidden className="px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      Abs
                    </li>
                  )}
                  <li>
                    <button
                      type="button"
                      onClick={() => goTo(i)}
                      aria-label={`${isCardio && cardio ? `Cardio: ${MACHINE_LABEL[cardio.machine]}` : sl.kind === "lift" ? sl.ex.name : ""}${done ? " (done)" : ""}`}
                      aria-current={isCurrent ? "step" : undefined}
                      className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold tabular-nums transition active:scale-90 ${
                        done
                          ? isCardio
                            ? "bg-sky-400 text-zinc-950"
                            : "bg-lime-400 text-zinc-950"
                          : isCurrent
                            ? "bg-zinc-100 text-zinc-900"
                            : isCardio
                              ? "bg-sky-400/15 text-sky-300"
                              : "bg-zinc-800 text-zinc-400 hover:text-zinc-100"
                      } ${isCurrent && done ? "ring-2 ring-zinc-100 ring-offset-2 ring-offset-zinc-950" : ""}`}
                    >
                      {done ? "✓" : isCardio ? <RunIcon /> : sl.kind === "lift" ? sl.liftIndex + 1 : null}
                    </button>
                  </li>
                </Fragment>
              );
            })}
          </ol>
        </nav>
      )}

      <div
        ref={trackRef}
        onScroll={onTrackScroll}
        aria-roledescription="carousel"
        className="-mx-1 mt-3 flex snap-x snap-mandatory items-start overflow-x-auto overscroll-x-contain [overflow-anchor:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((sl, i) => (
          <div
            key={sl.key}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            className="w-full shrink-0 snap-center snap-always px-1"
          >
            {sl.kind === "cardio" && cardio ? (
              <CardioCard
                plan={cardio}
                unit={unit}
                onChange={updateCardio}
                onRemove={() => updateCardio(null)}
                onDone={() => advanceFrom(i)}
                onFinishedChange={onCardioFinishedChange}
              />
            ) : sl.kind === "lift" ? (
              <ExerciseCard
                ex={sl.ex}
                index={sl.liftIndex + 1}
                unit={unit}
                onStartRest={() => startRest(sl.ex)}
                onSetDone={(allDone) => onSetDone(i, sl.ex, allDone)}
                onProgress={reportProgress}
                onSwap={(to) => swap(plan.exercises[sl.liftIndex], sl.ex.name, to)}
              />
            ) : null}
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-sm text-zinc-400">
        Working sets to true failure. Keep these exercises ~8 weeks.
      </p>

      <button
        type="button"
        onClick={finish}
        disabled={!anySetDone}
        className="mt-4 h-12 w-full rounded-xl border border-lime-400/60 text-base font-semibold text-lime-300 transition hover:bg-lime-400/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-600"
      >
        🏁 Finish workout
      </button>

      <button
        type="button"
        onClick={onReset}
        className="mt-4 h-12 w-full rounded-xl bg-lime-400 text-base font-semibold text-zinc-950 transition hover:bg-lime-300 active:scale-[0.98]"
      >
        Scan another gym
      </button>

      {rest && <RestTimer key={rest.id} request={rest} onClose={() => setRest(null)} />}
      {summary && (
        <Celebrate summary={summary} unit={unit} onClose={() => setSummary(null)} onSeeAll={onShowWins} />
      )}
    </section>
  );
}

function EquipmentEditor({
  equipment,
  onChange,
}: {
  equipment: string[];
  onChange: (equipment: string[]) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = CANONICAL_EQUIPMENT.filter((e) => !equipment.includes(e));

  async function update(next: string[]) {
    setBusy(true);
    setError(null);
    try {
      await onChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the plan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Equipment found</h2>
        <span className="text-[11px] text-zinc-500" aria-live="polite">
          {busy ? "Updating…" : "Tap to remove"}
        </span>
      </div>

      <ul className={`mt-2 flex flex-wrap gap-1.5 ${busy ? "opacity-60" : ""}`}>
        {equipment.map((e) => (
          <li key={e}>
            <button
              type="button"
              disabled={busy}
              onClick={() => update(equipment.filter((x) => x !== e))}
              aria-label={`Remove ${e}`}
              className="flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 py-1 pl-2.5 pr-2 text-xs capitalize text-zinc-200 transition hover:border-red-400/60 active:scale-95"
            >
              {e}
              <span aria-hidden className="text-zinc-500">×</span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            disabled={busy}
            onClick={() => setAdding((v) => !v)}
            aria-expanded={adding}
            className="rounded-full border border-dashed border-lime-400/60 px-2.5 py-1 text-xs font-medium text-lime-300 transition hover:bg-lime-400/10 active:scale-95"
          >
            {adding ? "Done" : "+ Add equipment"}
          </button>
        </li>
      </ul>

      {equipment.length === 0 && !adding && (
        <p className="mt-2 text-sm text-zinc-400">Nothing recognizable — add equipment or try a wider shot.</p>
      )}

      {adding && (
        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
          <p className="text-xs text-zinc-400">Gemini missed something? Tap to add it.</p>
          <ul className={`mt-2 flex flex-wrap gap-1.5 ${busy ? "opacity-60" : ""}`}>
            {missing.map((e) => (
              <li key={e}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => update([...equipment, e])}
                  className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs capitalize text-zinc-400 transition hover:border-lime-400 hover:text-zinc-100 active:scale-95"
                >
                  + {e}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}

function ArrowButton({ dir, disabled, onClick }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Previous exercise" : "Next exercise"}
      className="grid h-8 w-8 place-items-center rounded-full bg-zinc-800 text-zinc-200 transition hover:bg-zinc-700 active:scale-90 disabled:opacity-30"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path d={dir === "prev" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
      </svg>
    </button>
  );
}

function ExerciseCard({
  ex,
  index,
  unit,
  onStartRest,
  onSetDone,
  onProgress,
  onSwap,
}: {
  ex: PlannedExercise;
  index: number;
  unit: Unit;
  onStartRest: () => void;
  onSetDone: (allDone: boolean) => void;
  onProgress: (name: string, done: number, total: number) => void;
  onSwap: (name: string) => void;
}) {
  const name = ex.name;
  const reportProgress = useCallback((done: number, total: number) => onProgress(name, done, total), [onProgress, name]);
  const [showGuide, setShowGuide] = useState(false);
  const closeGuide = useCallback(() => setShowGuide(false), []);
  const [swapping, setSwapping] = useState(false);
  const alternatives = ex.alternatives ?? [];

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-zinc-500">{String(index).padStart(2, "0")}</p>
          <h3 className="text-lg font-semibold leading-tight">{ex.name}</h3>
          {ex.swappedFrom && (
            <p className="mt-0.5 text-xs text-zinc-500">
              Swapped from {ex.swappedFrom}
              {ex.savedSwap && <span className="text-lime-300/80"> · your saved swap</span>}
            </p>
          )}
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-lime-400/15 px-2.5 py-1 text-xs font-semibold text-lime-300">
          {ex.badge}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-2xl font-bold tabular-nums">
          {ex.sets} × {ex.reps}
        </span>
        <button
          type="button"
          onClick={onStartRest}
          aria-label={`Start rest timer for ${ex.name}`}
          className="flex items-center gap-1.5 rounded-full border border-zinc-700 px-2.5 py-1 text-sm text-zinc-300 transition hover:border-lime-400 hover:text-lime-300 active:scale-95"
        >
          <TimerIcon />
          {formatRest(ex.restSeconds)}
        </button>
        {hasGuide(ex.name) && (
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            aria-label={`How to do ${ex.name}`}
            className="rounded-full border border-zinc-700 px-2.5 py-1 text-sm text-zinc-300 transition hover:border-lime-400 hover:text-lime-300 active:scale-95"
          >
            ▶ How to
          </button>
        )}
        {alternatives.length > 0 && (
          <button
            type="button"
            onClick={() => setSwapping((v) => !v)}
            aria-expanded={swapping}
            aria-label={`Swap ${ex.name}`}
            className={`rounded-full border px-2.5 py-1 text-sm transition active:scale-95 ${
              swapping
                ? "border-lime-400 text-lime-300"
                : "border-zinc-700 text-zinc-300 hover:border-lime-400 hover:text-lime-300"
            }`}
          >
            ⇄ Swap
          </button>
        )}
      </div>
      {swapping && (
        <div className="mt-3 rounded-xl border border-zinc-700 bg-zinc-950/60 p-2">
          <p className="px-1.5 pb-1.5 text-xs text-zinc-400">Machine taken? Pick another option from your program:</p>
          <ul className="grid grid-cols-1 gap-1.5">
            {alternatives.map((alt) => (
              <li key={alt.name}>
                <button
                  type="button"
                  onClick={() => {
                    setSwapping(false);
                    onSwap(alt.name);
                  }}
                  className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-left transition hover:bg-zinc-700 active:scale-[0.99]"
                >
                  <span className="block font-semibold text-zinc-100">{alt.name}</span>
                  <span className="mt-0.5 block text-xs text-zinc-400">{alt.cue}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {showGuide && <ExerciseGuide exercise={ex.name} onClose={closeGuide} />}

      <p className="mt-3 text-sm text-zinc-200">
        <span className="font-semibold text-zinc-400">Cue · </span>
        {ex.cue}
      </p>
      {ex.reason && <p className="mt-1.5 text-sm italic text-zinc-400">{ex.reason}</p>}

      <SetLogger
        exercise={ex.name}
        sets={ex.sets}
        reps={ex.reps}
        unit={unit}
        onSetDone={onSetDone}
        onProgress={reportProgress}
      />
    </div>
  );
}

/** Apply the Swap button's choices; each card's options never include a name another card shows. */
function applySwaps(planned: PlannedExercise[], swaps: SavedSwaps): PlannedExercise[] {
  // A saved swap is skipped when another card already shows that exercise.
  const taken = new Set(planned.map((ex) => ex.name));
  const chosen = planned.map(({ alternatives = [], ...programmed }) => {
    const options: Alternative[] = [programmed, ...alternatives];
    const want = swaps[programmed.swappedFrom ?? programmed.name];
    const saved = want && want !== programmed.name && !taken.has(want) ? options.find((o) => o.name === want) : undefined;
    if (saved) {
      taken.delete(programmed.name);
      taken.add(saved.name);
    }
    return { pick: saved ? { ...saved, savedSwap: true } : programmed, options };
  });
  const shown = new Set(chosen.map((c) => c.pick.name));
  return chosen.map(({ pick, options }) => ({ ...pick, alternatives: options.filter((o) => !shown.has(o.name)) }));
}

function TimerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M9 2h6" />
    </svg>
  );
}

function RunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="14" cy="4" r="2" />
      <path d="M8 21l3-6 3 2v5M6 12l3-4 4 1 3 4 3 1M9 8l-2 4" />
    </svg>
  );
}
