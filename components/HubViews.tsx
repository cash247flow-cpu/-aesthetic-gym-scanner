"use client";

import { useEffect, useState } from "react";
import { MuscleMap } from "@/components/MuscleMap";
import { AccentLast, TITLE } from "@/components/ui";
import { HABITS, addDays, todayStr } from "@/lib/habits";
import { musclesFor } from "@/lib/muscles";
import { formatWeight, loadHistory } from "@/lib/wins";
import { loadUnit } from "@/components/SetLogger";
import { loadEntries } from "@/lib/bodyLog";
import { weekCounts, weekStatus } from "@/lib/missed";

type Row = { icon: string; label: string; sub?: string; onClick: () => void };

function HubRow({ icon, label, sub, onClick }: Row) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-left transition hover:border-lime-400/60 active:scale-[0.98]"
    >
      <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-zinc-800 text-lg">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        {sub && <span className="block truncate text-xs text-zinc-400">{sub}</span>}
      </span>
      <span aria-hidden className="text-zinc-500">
        ›
      </span>
    </button>
  );
}

/** Progress tab: muscles trained this week, then wins and the body tracker. */
export function ProgressHub({ onWins, onBody }: { onWins: () => void; onBody: () => void }) {
  const [week, setWeek] = useState<{ exercises: string[]; workouts: number; untracked: number } | null>(null);
  const [lastWeight, setLastWeight] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ done: number; madeUp: number; missed: number } | null>(null);

  useEffect(() => {
    const t = todayStr();
    const start = addDays(t, -new Date(t + "T12:00").getDay());
    const thisWeek = loadHistory().filter((h) => h.date >= start && h.date <= t && h.sets > 0);
    setWeek({
      exercises: thisWeek.flatMap((h) => h.exercises ?? []),
      workouts: thisWeek.length,
      untracked: thisWeek.filter((h) => !h.exercises).length,
    });
    setPlan(weekCounts(weekStatus()));
    const last = [...loadEntries()].sort((a, b) => a.date.localeCompare(b.date)).pop();
    setLastWeight(last ? `Last weigh-in ${formatWeight(last.weightLb, loadUnit())} · ${last.date}` : null);
  }, []);

  const muscles = musclesFor(week?.exercises ?? []);

  return (
    <section className="mt-2">
      <h1 className={TITLE}>
        <AccentLast text="Your progress" />
      </h1>
      <p className="mt-1 text-sm text-zinc-400">
        {week === null ? " " : week.workouts === 0 ? "No workouts logged this week yet." : `${week.workouts} workout${week.workouts === 1 ? "" : "s"} this week.`}
      </p>

      {plan && plan.done + plan.madeUp + plan.missed > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat value={plan.done} label="Done" tone="text-lime-300" />
          <Stat value={plan.madeUp} label="Made up" tone="text-emerald-300" />
          <Stat value={plan.missed} label="Missed" tone="text-amber-300" />
        </div>
      )}

      <div className="mt-4">
        <MuscleMap primary={muscles.primary} secondary={muscles.secondary} caption="Muscles trained this week" />
        {!!week?.untracked && (
          <p className="mt-1.5 text-center text-xs text-zinc-500">Workouts finished before this update aren&apos;t on the map.</p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2">
        <HubRow icon="🏆" label="Your wins" sub="Personal bests, badges and workout history" onClick={onWins} />
        <HubRow icon="📈" label="Body tracker" sub={lastWeight ?? "Weight goal, graph, scale photos and scan reports"} onClick={onBody} />
      </div>
    </section>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 py-2.5">
      <p className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-xs text-zinc-400">{label} this week</p>
    </div>
  );
}

/** More tab: everything that isn't on its own tab. */
export function MoreHub({
  onHabits,
  onSupps,
  onWeek,
  onSleep,
  onCardio,
}: {
  onHabits: () => void;
  onSupps: () => void;
  onWeek: () => void;
  onSleep: () => void;
  onCardio: () => void;
}) {
  return (
    <section className="mt-2">
      <h1 className={TITLE}>
        <AccentLast text="More" />
      </h1>
      <div className="mt-4 grid grid-cols-1 gap-2">
        <HubRow icon="✅" label="Daily habits" sub={HABITS.map((h) => h.title).join(" · ")} onClick={onHabits} />
        <HubRow icon="💊" label="Supplements" sub="Daily checklist and label check" onClick={onSupps} />
        <HubRow icon="🗓️" label="Your week" sub="Which session on which day, and ab days" onClick={onWeek} />
        <HubRow icon="😴" label="Sleep times" sub="Wake time and tonight's Sleep Lock timeline" onClick={onSleep} />
        <HubRow icon="🏃" label="Cardio Day" sub="Treadmill or StairMaster, no photo needed" onClick={onCardio} />
      </div>
    </section>
  );
}
