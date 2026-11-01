// Safety signal shared outside the weekly review screen: has the user reported pain or a
// possible injury that they haven't yet confirmed is resolved for training purposes? While a
// report is unresolved, progressive-overload targets stop increasing load.
//
// Rules:
//  - A report is recorded the moment "Pain or a possible injury" is ticked (and also comes from
//    any saved weekly review whose check-in says pain).
//  - Nothing clears it automatically: not time passing, not unticking the box, not a later
//    check-in without pain. Only an explicit "resume progression suggestions" confirmation does.
//  - That confirmation only turns suggestions back on. It is NOT medical clearance; the app can't
//    assess pain or injury. The user can always type any numbers themselves.

const KEY = "ags:safety:pain";

export type PainEvent = { type: "reported" | "resumed"; at: number };
export type PainState = { events: PainEvent[] };
type Reviews = Record<string, { start: string; end: string; checkIn?: { pain?: boolean }; versions?: { savedAt: number }[] }>;

export const RESUME_WARNING =
  "This only turns weight and rep increases back on in this app. It isn't medical clearance — the app can't tell whether pain or an injury has resolved. If you're unsure, check with a doctor or physiotherapist first.";

function read<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
}

/** Reads the stored log, accepting the earlier `{ on, pain }` shape (a tick with only a date). */
export function loadPainState(raw: unknown = read<unknown>(KEY)): PainState {
  if (raw && typeof raw === "object" && Array.isArray((raw as PainState).events)) {
    return { events: (raw as PainState).events.filter((e) => (e?.type === "reported" || e?.type === "resumed") && Number.isFinite(e.at)) };
  }
  const old = raw as { on?: unknown; pain?: unknown } | null;
  if (old && typeof old.on === "string" && old.pain === true) return { events: [{ type: "reported", at: Date.parse(old.on + "T12:00") }] };
  return { events: [] };
}

function save(s: PainState) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ events: s.events.slice(-50) }));
  } catch {
    /* ignore */
  }
}

/** Ticking the box records a report. Unticking records nothing — it doesn't resume progression. */
export function setPainReport(pain: boolean, now = Date.now()) {
  if (!pain) return;
  save({ events: [...loadPainState().events, { type: "reported", at: now }] });
  try {
    window.dispatchEvent(new Event("ags:pain-reported"));
  } catch {
    /* not in a browser */
  }
}

/** The user's explicit confirmation that suggestions may resume (not medical clearance). */
export function resumeProgression(now = Date.now()) {
  save({ events: [...loadPainState().events, { type: "resumed", at: now }] });
  try {
    window.dispatchEvent(new Event("ags:progression-resumed"));
  } catch {
    /* not in a browser */
  }
}

/** Is progression held, and since when? Pure when both inputs are given. */
export function painHold(state: PainState = loadPainState(), reviews: Reviews | null = read<Reviews>("ags:reviews")): { held: boolean; since: number | null } {
  const reports = state.events.filter((e) => e.type === "reported").map((e) => e.at);
  for (const r of Object.values(reviews ?? {})) {
    if (!r?.checkIn?.pain) continue;
    const savedAt = r.versions?.length ? r.versions[r.versions.length - 1].savedAt : NaN;
    reports.push(Number.isFinite(savedAt) ? savedAt : Date.parse(`${r.end}T12:00`));
  }
  const lastReport = Math.max(-Infinity, ...reports.filter(Number.isFinite));
  const lastResume = Math.max(-Infinity, ...state.events.filter((e) => e.type === "resumed").map((e) => e.at));
  const held = Number.isFinite(lastReport) && lastReport > lastResume;
  return { held, since: held ? lastReport : null };
}

export const recentPainReport = () => painHold().held;
