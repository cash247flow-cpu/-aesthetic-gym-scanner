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
import { loadOverload, saveOverload } from "@/lib/overload";
import { statsTotal, weekStartOf } from "@/lib/cardioStats";
import { EVENT_LABEL, loadEvents, type EventName } from "@/lib/events";
import { referralUrl } from "@/lib/achievements/sharePrefs";
import { requestPersistentStorage, storageStatus, type StorageStatus } from "@/lib/storageInfo";

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
export function ProgressHub({ onWins, onBody, onReview, onPhotos }: { onWins: () => void; onBody: () => void; onReview: () => void; onPhotos: () => void }) {
  const [week, setWeek] = useState<{ exercises: string[]; workouts: number; untracked: number } | null>(null);
  const [lastWeight, setLastWeight] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ done: number; madeUp: number; missed: number } | null>(null);
  const [cardioStats, setCardioStats] = useState<{ steps: number; floors: number } | null>(null);

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
    setCardioStats(statsTotal(weekStartOf(todayStr())));
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

      {cardioStats && (cardioStats.steps > 0 || cardioStats.floors > 0) && (
        <p className="mt-3 rounded-2xl border border-sky-400/30 bg-sky-400/5 px-4 py-2.5 text-sm text-sky-100">
          👟 Cardio this week:{" "}
          <span className="font-bold">
            {[cardioStats.steps > 0 && `${cardioStats.steps.toLocaleString()} steps`, cardioStats.floors > 0 && `${cardioStats.floors} floors`]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </p>
      )}

      <div className="mt-4">
        <MuscleMap primary={muscles.primary} secondary={muscles.secondary} caption="Muscles trained this week" />
        {!!week?.untracked && (
          <p className="mt-1.5 text-center text-xs text-zinc-500">Workouts finished before this update aren&apos;t on the map.</p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2">
        <HubRow icon="📊" label="Weekly evolution" sub="Weekly review and coaching summary" onClick={onReview} />
        <HubRow icon="📸" label="Visual evolution" sub="Private progress photos and comparisons" onClick={onPhotos} />
        <HubRow icon="🏆" label="Your wins" sub="Trophies, certificates, personal bests and history" onClick={onWins} />
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

/** A setting row with an on/off switch. */
function SwitchRow({ label, desc, on, onChange }: { label: string; desc: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        <span className="block text-xs text-zinc-400">{desc}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label.replace(/^\S+\s/, "")}
        onClick={() => onChange(!on)}
        className={`relative h-8 w-14 shrink-0 rounded-full transition ${on ? "bg-lime-400" : "bg-zinc-700"}`}
      >
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-zinc-950 shadow transition-all ${on ? "left-7" : "left-1"}`} />
      </button>
    </div>
  );
}

/** More tab: everything that isn't on its own tab. */
export function MoreHub({
  scanMode,
  onScanMode,
  onHabits,
  onSupps,
  onWeek,
  onSleep,
  onCardio,
  onActivity,
  onData,
}: {
  scanMode: boolean;
  onScanMode: (on: boolean) => void;
  onHabits: () => void;
  onSupps: () => void;
  onWeek: () => void;
  onSleep: () => void;
  onCardio: () => void;
  onActivity: () => void;
  onData: () => void;
}) {
  const [overload, setOverload] = useState(true);
  useEffect(() => setOverload(loadOverload()), []);

  return (
    <section className="mt-2">
      <h1 className={TITLE}>
        <AccentLast text="More" />
      </h1>
      <div className="mt-4 grid grid-cols-1 gap-2">
        <SwitchRow
          label="📷 Scan gym equipment"
          desc={scanMode ? "Workouts use only the equipment in your gym photo." : "Off: your standard S-tier program — no photo needed."}
          on={scanMode}
          onChange={onScanMode}
        />
        <SwitchRow
          label="📈 Progressive overload"
          desc={
            overload
              ? "Sets are pre-filled with this session's targets: +1 rep, or more weight once you hit the top of the range."
              : "Off: set boxes start empty (Previous still shows last time)."
          }
          on={overload}
          onChange={(on) => {
            setOverload(on);
            saveOverload(on);
          }}
        />
        <HubRow icon="✅" label="Daily habits" sub={HABITS.map((h) => h.title).join(" · ")} onClick={onHabits} />
        <HubRow icon="💊" label="Supplements" sub="Daily checklist and label check" onClick={onSupps} />
        <HubRow icon="🗓️" label="Your week" sub="Which session on which day, and ab days" onClick={onWeek} />
        <HubRow icon="😴" label="Sleep times" sub="Wake time and tonight's Sleep Lock timeline" onClick={onSleep} />
        <HubRow icon="🏃" label="Cardio Day" sub="Treadmill or StairMaster, no photo needed" onClick={onCardio} />
        <HubRow icon="💾" label="Data on this phone" sub="Where your records live, storage status, and backups" onClick={onData} />
        <HubRow icon="📈" label="Sharing activity" sub="Reviews, saved images and shares — counted on this phone only" onClick={onActivity} />
      </div>
    </section>
  );
}

/** Lightweight metrics view: what was counted on this phone. No server, so no visits or signups. */
export function ActivityView({ onBack }: { onBack: () => void }) {
  const [ev, setEv] = useState<ReturnType<typeof loadEvents> | null>(null);
  useEffect(() => setEv(loadEvents()), []);
  const ref = referralUrl();
  return (
    <section className="mt-2">
      <button type="button" onClick={onBack} className="text-sm text-zinc-400">
        ← Back
      </button>
      <h1 className={`${TITLE} mt-2`}>
        <AccentLast text="Sharing activity" />
      </h1>
      <p className="mt-1 text-sm text-zinc-400">Counted on this phone only{ev ? ` since ${ev.since}` : ""}. Nothing here is sent anywhere.</p>
      <ul className="mt-4 grid gap-1.5">
        {(Object.keys(EVENT_LABEL) as EventName[]).map((k) => (
          <li key={k} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm">
            <span className="min-w-0">{EVENT_LABEL[k]}</span>
            <span className="shrink-0 font-semibold tabular-nums">{ev?.counts[k] ?? 0}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3.5 text-xs text-zinc-400">
        <p>
          Opening the share sheet isn&apos;t proof anything was posted — the app can&apos;t see what happens in Instagram or other apps.
        </p>
        <p className="mt-1.5">
          {ref
            ? `Referral link: ${new URL(ref).host}. Link visits, signups and active referred users can only be counted by that site — not by this app.`
            : "Referral links and QR codes are off: no signup page is configured (NEXT_PUBLIC_REFERRAL_URL)."}
        </p>
      </div>
    </section>
  );
}

/** Honest status of on-phone storage. Nothing here moves, migrates or deletes data. */
export function DataView({ onBack }: { onBack: () => void }) {
  const [st, setSt] = useState<StorageStatus | null>(null);
  useEffect(() => {
    requestPersistentStorage().finally(() => storageStatus().then(setSt));
  }, []);
  return (
    <section className="mt-2">
      <button type="button" onClick={onBack} className="text-sm text-zinc-400">
        ← Back
      </button>
      <h1 className={`${TITLE} mt-2`}>
        <AccentLast text="Data on this phone" />
      </h1>
      <div className="mt-4 grid gap-3 text-sm">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5">
          <p className="font-semibold">Where your data lives</p>
          <ul className="mt-1.5 grid list-disc gap-1 pl-5 text-zinc-300">
            <li>Workouts, nutrition, body entries, habits, reviews, awards and progress photos are stored in this browser on this phone.</li>
            <li>There are no accounts and no cloud copy.</li>
            <li>Scale photos, reports, cardio and gym photos are sent to Google Gemini only when you confirm reading them with AI.</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5" aria-label="Storage status">
          <p className="font-semibold">Storage status</p>
          <p className="mt-1 text-zinc-300">
            {st === null
              ? "Checking…"
              : !st.supported
                ? "This browser doesn't report storage status."
                : st.persisted
                  ? "Protected from automatic cleanup: the browser has agreed not to clear this app's data on its own when space runs low."
                  : "Not protected from automatic cleanup: the browser may clear this app's data if the phone runs low on space. Installing the app to your home screen often helps."}
          </p>
          {st?.usageMB != null && <p className="mt-1 text-xs text-zinc-500">Using about {st.usageMB} MB.</p>}
          <p className="mt-2 text-xs text-zinc-400">
            Even when protected, data is still lost if you clear site data or browsing data, uninstall the app, or lose or reset the phone.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-300/40 bg-amber-300/5 p-3.5">
          <p className="font-semibold text-amber-100">No backup yet</p>
          <p className="mt-1 text-zinc-300">
            AESTHETIQ can&apos;t back up or restore your data yet. To keep important progress photos, open them in Visual evolution and use
            &ldquo;Save copy&rdquo;. Export and restore are planned.
          </p>
        </div>
      </div>
    </section>
  );
}
