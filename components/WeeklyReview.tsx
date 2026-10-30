"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AccentLast, TITLE } from "@/components/ui";
import { loadUnit } from "@/components/SetLogger";
import { fmtWaist } from "@/components/PhotoCompare";
import { WeeklyWinsShare } from "@/components/WeeklyWinsShare";
import { lastBackupText } from "@/components/BackupPanel";
import { daysSince, loadLastBackup, type LastBackup } from "@/lib/backupStore";
import { fmtDate, fmtWeight } from "@/lib/achievements/format";
import { TIERS } from "@/lib/achievements/config";
import { DAY_NAMES } from "@/lib/schedule";
import { todayStr } from "@/lib/habits";
import { track } from "@/lib/events";
import { STATUS_LABEL, type CheckIn, type CoachResult } from "@/lib/review/coach";
import type { WeekMetrics } from "@/lib/review/metrics";
import { lastCompleted, periodFor, periodLabel, previousPeriod, type Period } from "@/lib/review/period";
import {
  decide,
  decisionHistory,
  fingerprint,
  giveFeedback,
  liveReview,
  loadReviews,
  loadStartDay,
  saveReview,
  saveStartDay,
  type ReviewRecord,
} from "@/lib/review/store";

const pct = (r: number | null) => (r == null ? "—" : `${Math.round(r * 100)}%`);
const next = (p: Period): Period => ({ start: shift(p.start, 7), end: shift(p.end, 7) });
function shift(d: string, n: number) {
  const x = new Date(d + "T12:00");
  x.setDate(x.getDate() + n);
  return x.toLocaleDateString("en-CA");
}

/** Weekly Progress Review — what happened, what changed, what to do next. */
export function WeeklyReview({
  onBack,
  onPhotos,
  onTargets,
  onBackup,
}: {
  onBack: () => void;
  onPhotos: () => void;
  onTargets: () => void;
  onBackup: () => void;
}) {
  const [startDay, setStartDay] = useState(0);
  const [period, setPeriod] = useState<Period | null>(null);
  const [reviews, setReviews] = useState<Record<string, ReviewRecord>>({});
  const [checkIn, setCheckIn] = useState<CheckIn>({});
  const [live, setLive] = useState<{ metrics: WeekMetrics; coach: CoachResult } | null>(null);
  const [showLive, setShowLive] = useState(false);
  const [sharing, setSharing] = useState<WeekMetrics | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const unit = loadUnit();
  const today = todayStr();

  useEffect(() => {
    const d = loadStartDay();
    setStartDay(d);
    setPeriod(lastCompleted(today, d));
    setReviews(loadReviews());
    track("review_opened");
  }, [today]);

  const record = period ? reviews[period.start] : undefined;
  useEffect(() => {
    if (!period) return;
    const rec = loadReviews()[period.start];
    setCheckIn(rec?.checkIn ?? {});
    setShowLive(false);
    setSaved(null);
  }, [period]);
  useEffect(() => {
    if (period) setLive(liveReview(period, checkIn));
  }, [period, checkIn, reviews]);

  const snapshot = record?.versions[record.versions.length - 1];
  const changed = !!(snapshot && live && fingerprint(snapshot.metrics) !== fingerprint(live.metrics));
  const shown = snapshot && !showLive ? snapshot : live;
  const inProgress = period ? period.end >= today : false;
  const current = periodFor(today, startDay);

  // The focus approved in the previous review, to ask whether it helped.
  const prevRecord = period ? reviews[previousPeriod(period).start] : undefined;
  const lastFocus = prevRecord?.decision?.decision === "approved" ? prevRecord.decision.focus : null;
  const history = useMemo(() => Object.values(reviews).sort((a, b) => b.start.localeCompare(a.start)), [reviews]);
  const decisions = useMemo(() => (reviews ? decisionHistory() : []), [reviews]);

  if (!period || !shown) return <div className="h-40" aria-hidden />;
  const m = shown.metrics;
  const c = shown.coach;

  function save() {
    if (!period || !live) return;
    saveReview(period, live, checkIn);
    track("review_saved");
    setReviews(loadReviews());
    setShowLive(false);
    setSaved(record ? "Review updated — the earlier version is kept." : "Week reviewed.");
  }

  return (
    <section className="mt-2">
      <button type="button" onClick={onBack} className="text-sm text-zinc-400">
        ← Back
      </button>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300">Your weekly evolution</p>
      <h1 className={TITLE}>
        <AccentLast text="Weekly review" />
      </h1>
      <p className="mt-1 text-sm text-zinc-400">Progress is more than a number.</p>

      {/* Period */}
      <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-2">
        <button type="button" aria-label="Previous week" onClick={() => setPeriod(previousPeriod(period))} className="grid h-10 w-10 place-items-center rounded-full bg-zinc-800">
          ‹
        </button>
        <div className="min-w-0 text-center">
          <p className="truncate font-semibold">{periodLabel(period)}</p>
          <p className="text-xs text-zinc-400">
            {inProgress ? "In progress" : record ? `Reviewed${record.versions.length > 1 ? ` (version ${record.versions.length})` : ""} · ${fmtDate(new Date(snapshot!.savedAt).toLocaleDateString("en-CA"))}` : "Not reviewed yet"}
          </p>
        </div>
        <button
          type="button"
          aria-label="Next week"
          disabled={period.start >= current.start}
          onClick={() => setPeriod(next(period))}
          className="grid h-10 w-10 place-items-center rounded-full bg-zinc-800 disabled:opacity-30"
        >
          ›
        </button>
      </div>
      <label className="mt-2 flex items-center justify-end gap-2 text-xs text-zinc-400">
        Review weeks start on
        <select
          value={startDay}
          onChange={(e) => {
            const d = Number(e.target.value);
            setStartDay(d);
            saveStartDay(d);
            setPeriod(lastCompleted(today, d));
          }}
          className="h-8 rounded-lg bg-zinc-800 px-2 text-xs text-zinc-100"
        >
          {DAY_NAMES.map((n, i) => (
            <option key={n} value={i}>
              {n}
            </option>
          ))}
        </select>
      </label>

      {changed && (
        <div role="status" className="mt-3 rounded-2xl border border-sky-400/40 bg-sky-400/10 p-3 text-sm text-sky-100">
          Your records for this week changed after you saved this review (for example a corrected weigh-in).{" "}
          {showLive ? "Showing the updated numbers." : "Showing what was known when you reviewed it."}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowLive((v) => !v)} className="h-8 rounded-full bg-zinc-800 px-3 text-xs font-semibold">
              {showLive ? "Show saved review" : "Show updated numbers"}
            </button>
            <button type="button" onClick={save} className="h-8 rounded-full bg-sky-300 px-3 text-xs font-semibold text-zinc-950">
              Save updated review
            </button>
          </div>
        </div>
      )}

      {/* Available / missing data */}
      <div aria-label="Data this week" className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
        <Chip ok={m.workouts.scheduled != null || m.workouts.sessions > 0}>Workouts</Chip>
        <Chip ok={m.body.weighIns >= 2}>{m.body.weighIns ? `${m.body.weighIns} weigh-in${m.body.weighIns === 1 ? "" : "s"}` : "Weigh-ins"}</Chip>
        <Chip ok={!!m.body.waist}>Waist</Chip>
        <Chip ok={m.habits.tracked && m.habits.done > 0}>Habits</Chip>
        <Chip ok={m.nutrition.intakeDays > 0}>{m.nutrition.intakeDays ? `Food log ${m.nutrition.intakeDays}d` : "Food log"}</Chip>
        <Chip ok={m.photos.count > 0}>{m.photos.count ? `${m.photos.count} photo${m.photos.count === 1 ? "" : "s"}` : "Photos"}</Chip>
        <Chip ok={false}>Sleep hours (not tracked)</Chip>
      </div>

      <Card title="This week's wins">
        {m.awards.length === 0 && m.workouts.sessions === 0 ? (
          <p className="text-zinc-400">No awards or workouts recorded this week.</p>
        ) : (
          <ul className="grid gap-1">
            {m.workouts.sessions > 0 && <li>🏋️ {m.workouts.sessions} workout{m.workouts.sessions === 1 ? "" : "s"} · {m.workouts.sets} sets</li>}
            {m.awards.map((a) => (
              <li key={a.id}>
                🏆 {a.title}
                {a.exerciseName ? ` · ${a.exerciseName}` : ""} <span className="text-xs uppercase text-zinc-500">({a.tier} · {TIERS[a.tier].collection})</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Body progress">
        <ul className="grid gap-1">
          <li>
            Weight:{" "}
            {m.body.avgLb != null
              ? `average ${fmtWeight(m.body.avgLb, unit)} from ${m.body.weighIns} weigh-ins${m.body.avgChangeLb != null ? ` (${m.body.avgChangeLb > 0 ? "+" : m.body.avgChangeLb < 0 ? "−" : "±"}${fmtWeight(Math.abs(m.body.avgChangeLb), unit)} vs last week's average)` : " — no average for last week to compare"}`
              : m.body.weighIns === 1 && m.body.weight == null
                ? "one weigh-in — not enough for a weekly average"
                : "not recorded this week"}
          </li>
          {m.body.weight && <li className="text-xs text-zinc-400">Single weigh-ins: {fmtWeight(m.body.weight.first, unit)} ({fmtDate(m.body.weight.firstDate)}) → {fmtWeight(m.body.weight.last, unit)} ({fmtDate(m.body.weight.lastDate)})</li>}
          <li>Waist: {m.body.waist ? `${fmtWaist(m.body.waist.first, unit)} → ${fmtWaist(m.body.waist.last, unit)}` : "not measured twice this week"}</li>
          {m.body.bodyFat && <li>Body fat (scale estimate): {m.body.bodyFat.first}% → {m.body.bodyFat.last}%</li>}
          {m.body.muscle && <li>Muscle (scale estimate): {fmtWeight(m.body.muscle.first, unit)} → {fmtWeight(m.body.muscle.last, unit)}</li>}
          <li>
            Progress photos: {m.photos.count ? `${m.photos.count} (${m.photos.views.join(", ")})` : "none this week"}{" "}
            <button type="button" onClick={onPhotos} className="font-semibold text-amber-300">
              {m.photos.count ? "View" : "Add photos"} →
            </button>
          </li>
        </ul>
      </Card>

      <Card title="Strength progress">
        <ul className="grid gap-1">
          <li>
            {m.strength.prs.length ? `${m.strength.prs.length} new personal record${m.strength.prs.length === 1 ? "" : "s"}:` : "No new personal records this week."}
          </li>
          {m.strength.prs.map((a) => (
            <li key={a.id} className="text-xs text-zinc-300">
              · {a.exerciseName} — {a.type.replace("-pr", "").replace("bodyweight", "bodyweight reps")} record
            </li>
          ))}
          <li>
            Volume: {m.workouts.volumeLb ? fmtWeight(m.workouts.volumeLb, unit) : "none logged"}
            {m.strength.volumeChangePct != null ? ` (${m.strength.volumeChangePct > 0 ? "+" : ""}${m.strength.volumeChangePct}% vs last week)` : ""}
          </li>
        </ul>
      </Card>

      <Card title="Consistency">
        <ul className="grid gap-1">
          <li>
            Planned sessions:{" "}
            {m.workouts.rate != null ? `${m.workouts.completed} of ${m.workouts.scheduled} (${pct(m.workouts.rate)})${m.workouts.missed ? ` · ${m.workouts.missed} missed` : ""}` : "plan for this week isn't on record"}
          </li>
          <li>Habits: {m.habits.rate != null ? `${m.habits.done} of ${m.habits.eligible} (${pct(m.habits.rate)}) · ${m.habits.perfectDays} perfect day${m.habits.perfectDays === 1 ? "" : "s"}` : "not tracked yet"}</li>
          <li>Cardio: {m.cardio.minutes ? `${m.cardio.minutes} min in ${m.cardio.sessions} session${m.cardio.sessions === 1 ? "" : "s"}${m.cardio.steps ? ` · ${m.cardio.steps.toLocaleString()} steps` : ""}` : "none logged"}</li>
          <li>
            Meals: {m.nutrition.mealsChecked != null ? `${m.nutrition.mealsChecked} plan meals ticked as eaten` : "no meals ticked"}
            <span className="block text-xs text-zinc-500">Ticks show you followed the meal plan, not exactly what or how much you ate.</span>
          </li>
          <li>
            Food log:{" "}
            {m.nutrition.intakeDays
              ? `${m.nutrition.intakeDays} day${m.nutrition.intakeDays === 1 ? "" : "s"} imported · avg ${m.nutrition.avgKcal?.toLocaleString()} kcal (target ≈${m.nutrition.targetKcal.toLocaleString()})${m.nutrition.proteinHitDays != null ? ` · protein target hit ${m.nutrition.proteinHitDays} day${m.nutrition.proteinHitDays === 1 ? "" : "s"}` : ""}`
              : "no Cronometer days imported"}
          </li>
          <li>Sleep Lock routine: {m.sleep.routineNights} night{m.sleep.routineNights === 1 ? "" : "s"} <span className="text-xs text-zinc-500">(the bedtime routine — hours slept aren&apos;t recorded)</span></li>
        </ul>
      </Card>

      {/* Check-in */}
      {!snapshot || showLive || !record ? (
        <Card title="How did the week feel? (optional)">
          <p className="text-xs text-zinc-400">Energy this week</p>
          <div role="group" aria-label="Energy" className="mt-1 grid grid-cols-5 gap-1">
            {([1, 2, 3, 4, 5] as const).map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={checkIn.energy === e}
                onClick={() => setCheckIn((c) => ({ ...c, energy: c.energy === e ? undefined : e }))}
                className={`h-9 rounded-lg text-sm font-semibold ${checkIn.energy === e ? "bg-amber-300 text-zinc-950" : "bg-zinc-800 text-zinc-300"}`}
              >
                {e}
              </button>
            ))}
          </div>
          <p className="mt-1 flex justify-between text-[10px] text-zinc-500">
            <span>Drained</span>
            <span>Great</span>
          </p>
          <label className="mt-2 flex items-center gap-2.5">
            <input type="checkbox" checked={!!checkIn.pain} onChange={(e) => setCheckIn((c) => ({ ...c, pain: e.target.checked }))} className="h-5 w-5 accent-amber-300" />
            Pain or a possible injury this week
          </label>
        </Card>
      ) : null}

      {/* Coach */}
      <section aria-label="Coach's observations" className="mt-4 rounded-2xl border border-amber-300/30 bg-gradient-to-b from-amber-300/10 to-transparent p-3.5 text-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">Coach&apos;s observations</p>
        <p className="mt-1 font-semibold">{STATUS_LABEL[c.status]}</p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">What the data shows</p>
        <ul className="mt-1 grid list-disc gap-0.5 pl-5 text-zinc-200">
          {c.shows.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">What it may mean</p>
        <p className="mt-1 text-zinc-200">{c.means}</p>
        {c.flags.map((f) => (
          <p key={f} role="note" className="mt-2 rounded-lg border border-red-400/40 bg-red-400/10 p-2 text-red-100">
            ⚠️ {f}
          </p>
        ))}
        <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">What to do next</p>
        <p className="mt-1 font-semibold text-lime-300">{c.next.text}</p>
        <p className="text-xs text-zinc-400">{c.next.why}</p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">When to review again</p>
        <p className="mt-1 text-zinc-200">{c.reviewAgain}</p>
        <p className="mt-3 text-[11px] text-zinc-500">Based only on your records and simple, conservative rules. Not medical advice.</p>

        {c.proposal && (
          <div className="mt-3 rounded-xl border border-zinc-700 p-2.5">
            <p className="text-xs text-zinc-300">Suggested plan review — nothing changes unless you do it:</p>
            <button type="button" onClick={onTargets} className="mt-2 h-9 rounded-full border border-zinc-600 px-3 text-xs font-semibold">
              Open my macro targets
            </button>
          </div>
        )}

        {record && !inProgress && (
          <div className="mt-3 border-t border-zinc-800 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Next week&apos;s focus</p>
            {record.decision ? (
              <p className="mt-1">
                {record.decision.decision === "approved" ? "✓ Your focus: " : "Dismissed: "}
                {record.decision.focus.text}{" "}
                <button type="button" onClick={() => (decide(period, record.decision!.focus, record.decision!.decision === "approved" ? "dismissed" : "approved"), setReviews(loadReviews()))} className="text-xs font-semibold text-zinc-400 underline">
                  change
                </button>
              </p>
            ) : (
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => (decide(period, c.next, "approved"), setReviews(loadReviews()))} className="h-9 rounded-full bg-lime-400 px-3 text-xs font-semibold text-zinc-950">
                  Make this my focus
                </button>
                <button type="button" onClick={() => (decide(period, c.next, "dismissed"), setReviews(loadReviews()))} className="h-9 rounded-full border border-zinc-600 px-3 text-xs font-semibold">
                  Not now
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <BackupReminder onBackup={onBackup} />

      {lastFocus && record && (
        <Card title="Last week's focus">
          <p>{lastFocus.text}</p>
          {record.feedback ? (
            <p className="mt-1 text-xs text-zinc-400">You said: {record.feedback.answer === "helped" ? "it helped" : record.feedback.answer === "not" ? "it didn't help" : "not sure"}.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ["helped", "It helped"],
                  ["not", "Didn't help"],
                  ["unsure", "Not sure"],
                ] as const
              ).map(([k, label]) => (
                <button key={k} type="button" onClick={() => (giveFeedback(period, lastFocus.id, k), setReviews(loadReviews()))} className="h-8 rounded-full border border-zinc-600 px-3 text-xs font-semibold">
                  {label}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="mt-4 grid gap-2">
        {!inProgress && (!record || (changed && showLive)) && (
          <button type="button" onClick={save} className="h-12 rounded-xl bg-lime-400 font-semibold text-zinc-950">
            {record ? "Save updated review" : "✓ Mark week as reviewed"}
          </button>
        )}
        {inProgress && <p className="text-center text-xs text-zinc-500">This week isn&apos;t over yet — you can review it from {DAY_NAMES[startDay]}.</p>}
        {saved && (
          <p role="status" className="text-center text-sm text-lime-300">
            {saved}
          </p>
        )}
        <button type="button" onClick={() => setSharing(m)} className="h-12 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-200 font-semibold text-zinc-950">
          ✦ Share Weekly Wins
        </button>
      </div>

      {history.length > 0 && (
        <section aria-label="Past reviews" className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Past reviews</h2>
          <ul className="mt-2 grid gap-1.5">
            {history.map((r) => {
              const s = r.versions[r.versions.length - 1];
              return (
                <li key={r.start}>
                  <button type="button" onClick={() => (setPeriod({ start: r.start, end: r.end }), window.scrollTo({ top: 0 }))} className="flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-left text-sm">
                    <span className="min-w-0">
                      <span className="block font-semibold">{periodLabel({ start: r.start, end: r.end })}</span>
                      <span className="block truncate text-xs text-zinc-400">{STATUS_LABEL[s.coach.status]}</span>
                    </span>
                    <span className="shrink-0 text-xs text-zinc-500">{pct(s.metrics.workouts.rate)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {decisions.length > 0 && (
        <section aria-label="Your decisions" className="mt-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Suggestions you approved or dismissed</h2>
          <ul className="mt-2 grid gap-1 text-xs text-zinc-300">
            {decisions.map((d) => (
              <li key={d.start}>
                {fmtDate(d.start)}: {d.decision === "approved" ? "✓" : "✕"} {d.focus.text}
                {d.feedback ? ` — ${d.feedback.answer === "helped" ? "helped" : d.feedback.answer === "not" ? "didn't help" : "not sure"}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {sharing && <WeeklyWinsShare metrics={sharing} onClose={() => setSharing(null)} />}
    </section>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5 text-sm">
      <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
      {children}
    </section>
  );
}

function Chip({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 ${ok ? "border-lime-400/40 text-lime-200" : "border-zinc-700 text-zinc-500"}`}>
      {ok ? "✓" : "—"} {children}
    </span>
  );
}

/** Weekly nudge: your data lives only on this phone until it's backed up. */
function BackupReminder({ onBackup }: { onBackup: () => void }) {
  const [last, setLast] = useState<LastBackup | null | undefined>(undefined);
  useEffect(() => setLast(loadLastBackup()), []);
  if (last === undefined) return null;
  const overdue = !last || daysSince(last.at) > 7;
  return (
    <section
      aria-label="Backup"
      className={`mt-4 flex items-center gap-3 rounded-2xl border p-3.5 text-sm ${overdue ? "border-amber-300/40 bg-amber-300/5" : "border-zinc-800 bg-zinc-900"}`}
    >
      <span aria-hidden className="text-xl">
        💾
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{overdue ? "Time for a backup" : "Backed up"}</span>
        <span className="block text-xs text-zinc-400">{lastBackupText(last)}</span>
      </span>
      <button type="button" onClick={onBackup} className={`h-9 shrink-0 rounded-full px-3 text-xs font-semibold ${overdue ? "bg-amber-300 text-zinc-950" : "border border-zinc-600"}`}>
        {overdue ? "Back up now" : "Backups"}
      </button>
    </section>
  );
}
