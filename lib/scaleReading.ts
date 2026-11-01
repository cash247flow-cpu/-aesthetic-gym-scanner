// Turns Gemini's raw reading of a scale photo / body-scan report into checked numbers (lb).
// Anything missing, mis-typed or outside a plausible human range comes back as null. The ranges
// are shared with typed-in entries (lib/units.ts BODY_RANGES). The model's output is untrusted:
// only these fields are read, each type- and range-checked; anything else it returns is dropped.

import { BODY_RANGES as R, LB_PER_KG } from "@/lib/units";

export type ScaleReading = {
  kind: "scale" | "report" | "unknown";
  date: string | null; // YYYY-MM-DD printed on a report
  weightLb: number | null;
  bodyFatPct: number | null;
  muscleLb: number | null;
  bmi: number | null;
  visceralFat: number | null;
  bmr: number | null;
};

function numberIn(value: unknown, min: number, max: number): number | null {
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : value;
  return typeof n === "number" && Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 10) / 10 : null;
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(value + "T12:00");
  if (Number.isNaN(d.getTime())) return null;
  // Ignore misreads that land in the future or decades back.
  const now = Date.now();
  return d.getTime() <= now + 86_400_000 && d.getTime() >= now - 20 * 365 * 86_400_000 ? value : null;
}

export function normalizeScaleReading(raw: Record<string, unknown>): ScaleReading {
  const toLb = raw.unit === "kg" ? LB_PER_KG : 1;
  const lb = (v: unknown, min: number, max: number) => {
    const n = numberIn(v, min / toLb, max / toLb);
    return n === null ? null : Math.round(n * toLb * 10) / 10;
  };
  const kind = raw.kind === "scale" || raw.kind === "report" ? raw.kind : "unknown";
  return {
    kind,
    date: isoDate(raw.date),
    weightLb: lb(raw.weight, ...R.weightLb),
    bodyFatPct: numberIn(raw.bodyFatPercent, ...R.bodyFatPct),
    muscleLb: lb(raw.muscleMass, ...R.muscleLb),
    bmi: numberIn(raw.bmi, ...R.bmi),
    visceralFat: numberIn(raw.visceralFat, ...R.visceralFat),
    bmr: numberIn(raw.bmr, ...R.bmr),
  };
}
