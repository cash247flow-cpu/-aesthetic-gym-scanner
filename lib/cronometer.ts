// Reads Cronometer's "Daily Nutrition" CSV export (there's no public Cronometer API).
// Columns are matched by name, so extra or reordered columns don't matter.

export type DayTotals = { date: string; kcal: number | null; protein: number | null; carbs: number | null; netCarbs: number | null; fat: number | null };

const KEY = "ags:cronometer";

/** Minimal RFC 4180 CSV parser: quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

const norm = (h: string) => h.replace(/^﻿/, "").trim().toLowerCase();

function column(headers: string[], ...patterns: RegExp[]): number {
  for (const p of patterns) {
    const i = headers.findIndex((h) => p.test(norm(h)));
    if (i !== -1) return i;
  }
  return -1;
}

function toIsoDate(value: string): string | null {
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const us = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // M/D/YYYY
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return null;
}

const num = (v: string | undefined) => {
  if (v === undefined || v.trim() === "") return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
};

/** Daily totals from a Cronometer daily-nutrition export, or an error explaining what's wrong. */
export function parseCronometerDaily(text: string): { days: DayTotals[] } | { error: string } {
  const rows = parseCsv(text);
  if (rows.length < 2) return { error: "That file has no rows. Export “Daily Nutrition” from Cronometer and try again." };
  const headers = rows[0];
  const iDate = column(headers, /^date$/, /^day$/, /date/);
  const iKcal = column(headers, /^energy \(kcal\)$/, /^energy/, /calories/);
  const iProtein = column(headers, /^protein \(g\)$/, /^protein/);
  const iCarbs = column(headers, /^carbs \(g\)$/, /^carbohydrates? \(g\)$/, /^carbs/);
  const iNet = column(headers, /^net carbs \(g\)$/, /^net carbs/);
  const iFat = column(headers, /^fat \(g\)$/, /^total fat/, /^fat/);
  if (iDate === -1 || (iProtein === -1 && iCarbs === -1 && iFat === -1)) {
    return {
      error:
        "This doesn't look like a Cronometer Daily Nutrition export (no Date / Protein / Carbs / Fat columns). Food & recipe entries exports aren't supported.",
    };
  }
  const days: DayTotals[] = [];
  for (const r of rows.slice(1)) {
    const date = toIsoDate(r[iDate] ?? "");
    if (!date) continue;
    days.push({
      date,
      kcal: iKcal === -1 ? null : num(r[iKcal]),
      protein: iProtein === -1 ? null : num(r[iProtein]),
      carbs: iCarbs === -1 ? null : num(r[iCarbs]),
      netCarbs: iNet === -1 ? null : num(r[iNet]),
      fat: iFat === -1 ? null : num(r[iFat]),
    });
  }
  if (!days.length) return { error: "Couldn't find any dated rows in that file." };
  return { days };
}

export function loadCronometer(): DayTotals[] {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? "[]") as DayTotals[]).sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

/** Merge new days in (re-importing a day replaces it). */
export function saveCronometer(incoming: DayTotals[]): DayTotals[] {
  const byDate = new Map(loadCronometer().map((d) => [d.date, d]));
  for (const d of incoming) byDate.set(d.date, d);
  const all = [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 366);
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
  return all;
}
