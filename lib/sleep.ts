// Sleep Lock times from the training plan: to sleep N hours you need N + 1 hours in bed,
// stop eating 2–3 hours before bed, and no screens in the last hour. Same times every day.

export type SleepSettings = { wake: string; sleepHours: number }; // wake as "HH:MM" (24h)

export const SLEEP_OPTIONS = [7, 7.5, 8, 8.5, 9];
export const DEFAULT_SLEEP: SleepSettings = { wake: "06:00", sleepHours: 8 };
const FALL_ASLEEP_MIN = 60; // "Want 8 hours of sleep? You need 9 hours in bed."
const KEY = "ags:sleep";

export function loadSleep(): SleepSettings {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as SleepSettings) : null;
    if (s && /^\d{2}:\d{2}$/.test(s.wake) && SLEEP_OPTIONS.includes(s.sleepHours)) return s;
  } catch {
    /* fall through */
  }
  return DEFAULT_SLEEP;
}

export function saveSleep(s: SleepSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const wrap = (min: number) => ((min % 1440) + 1440) % 1440;

/** "21:00" → "9:00 PM" */
export function formatClockTime(min: number): string {
  const m = wrap(min);
  const h24 = Math.floor(m / 60);
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m % 60).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

export type SleepTimes = {
  lastMealEarliest: number; // 3 h before bed
  lastMealLatest: number; // 2 h before bed
  screensOff: number; // 1 h before bed
  inBed: number;
  asleepBy: number;
  wake: number;
  inBedHours: number;
};

/** All times are minutes after midnight (wrapped to 0–1439). */
export function sleepTimes({ wake, sleepHours }: SleepSettings): SleepTimes {
  const wakeMin = toMin(wake);
  const inBedMin = sleepHours * 60 + FALL_ASLEEP_MIN;
  const inBed = wrap(wakeMin - inBedMin);
  return {
    lastMealEarliest: wrap(inBed - 180),
    lastMealLatest: wrap(inBed - 120),
    screensOff: wrap(inBed - 60),
    inBed,
    asleepBy: wrap(inBed + FALL_ASLEEP_MIN),
    wake: wakeMin,
    inBedHours: inBedMin / 60,
  };
}
