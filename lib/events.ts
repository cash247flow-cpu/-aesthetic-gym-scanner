// Sharing activity counted on this phone only — nothing is sent anywhere. A "share started" is
// the user opening the share sheet; the app can't know whether anything was actually posted.

export type EventName =
  | "review_opened"
  | "review_saved"
  | "artifact_preview"
  | "artifact_saved"
  | "share_started"
  | "share_sheet_done"
  | "share_fallback_saved"
  | "referral_link_copied";
export type ArtifactKind = "certificate" | "weekly-wins" | "comparison";

type Store = { counts: Partial<Record<EventName, number>>; byKind: Partial<Record<string, number>>; since: string };
const KEY = "ags:events";

function load(): Store {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Store | null;
    if (s?.counts) return s;
  } catch {
    /* ignore */
  }
  return { counts: {}, byKind: {}, since: new Date().toLocaleDateString("en-CA") };
}

export function track(name: EventName, kind?: ArtifactKind) {
  const s = load();
  s.counts[name] = (s.counts[name] ?? 0) + 1;
  if (kind) s.byKind[`${name}:${kind}`] = (s.byKind[`${name}:${kind}`] ?? 0) + 1;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export const loadEvents = load;

export const EVENT_LABEL: Record<EventName, string> = {
  review_opened: "Weekly reviews opened",
  review_saved: "Weekly reviews saved",
  artifact_preview: "Images previewed",
  artifact_saved: "Images saved",
  share_started: "Share sheet opened",
  share_sheet_done: "Share sheet completed (not proof of a post)",
  share_fallback_saved: "Saved instead (sharing unavailable)",
  referral_link_copied: "Referral link copied",
};
