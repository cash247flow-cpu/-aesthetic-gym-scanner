// What goes on a shared certificate. Private by default: body measurements, coach branding and
// the referral QR are off until the user turns them on; nothing is ever published online.

export type SharePrefs = {
  name: string;
  showName: boolean;
  showExercise: boolean;
  showPerformance: boolean;
  showDate: boolean;
  showMeasurements: boolean;
  coach: string;
  showCoach: boolean;
  showQr: boolean;
};

const KEY = "ags:cert:prefs";
export const DEFAULT_PREFS: SharePrefs = {
  name: "",
  showName: true,
  showExercise: true,
  showPerformance: true,
  showDate: true,
  showMeasurements: false,
  coach: "",
  showCoach: false,
  showQr: false,
};

export function loadPrefs(): SharePrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<SharePrefs>;
    // Body measurements are opt-in per certificate, so that choice is never remembered.
    return { ...DEFAULT_PREFS, ...saved, showMeasurements: false };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: SharePrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...p, showMeasurements: false }));
  } catch {
    /* ignore */
  }
}

/**
 * Referral link for the QR code, only if one is configured (NEXT_PUBLIC_REFERRAL_URL, https).
 * No production URL is assumed; without it the QR option is hidden.
 */
export function referralUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_REFERRAL_URL?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
