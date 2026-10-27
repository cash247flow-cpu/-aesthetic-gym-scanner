"use client";

import { useState } from "react";
import type { Unit } from "@/components/SetLogger";
import type { BodyEntry } from "@/lib/bodyLog";
import { fromLb } from "@/lib/wins";

export type BodyMetric = "weight" | "fat" | "muscle";
type Range = "1M" | "3M" | "1Y" | "All";

const RANGE_DAYS: Record<Range, number | null> = { "1M": 31, "3M": 92, "1Y": 366, All: null };
const COLOR: Record<BodyMetric, string> = { weight: "#a3e635", fat: "#fbbf24", muscle: "#a78bfa" };
const DAY = 86_400_000;

// SVG coordinate space; the element scales to the card width.
const W = 340;
const H = 190;
const PAD = { l: 38, r: 14, t: 16, b: 26 };

const time = (d: string) => new Date(d + "T12:00").getTime();
const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function metricValue(e: BodyEntry, metric: BodyMetric, unit: Unit): number | null {
  if (metric === "weight") return fromLb(e.weightLb, unit);
  if (metric === "fat") return e.bodyFatPct ?? null;
  return e.muscleLb != null ? fromLb(e.muscleLb, unit) : null;
}

export function BodyChart({
  entries,
  metric,
  unit,
  goalLb,
}: {
  entries: BodyEntry[];
  metric: BodyMetric;
  unit: Unit;
  goalLb?: number;
}) {
  const [range, setRange] = useState<Range>("3M");
  const days = RANGE_DAYS[range];
  const cutoff = days ? Date.now() - days * DAY : -Infinity;
  const points = entries
    .map((e) => ({ t: time(e.date), v: metricValue(e, metric, unit) }))
    .filter((p): p is { t: number; v: number } => p.v !== null && p.t >= cutoff);

  const suffix = metric === "fat" ? "%" : ` ${unit}`;
  const goal = metric === "weight" && goalLb ? fromLb(goalLb, unit) : null;

  let body: React.ReactNode;
  if (points.length === 0) {
    body = (
      <p className="grid h-40 place-items-center px-6 text-center text-sm text-zinc-500">
        {metric === "weight"
          ? "Add your first weigh-in to start the graph."
          : `No ${metric === "fat" ? "body fat %" : "muscle mass"} entries in this range yet.`}
      </p>
    );
  } else {
    const values = points.map((p) => p.v).concat(goal !== null ? [goal] : []);
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    const minSpan = metric === "fat" ? 2 : 4;
    if (hi - lo < minSpan) {
      const mid = (hi + lo) / 2;
      lo = mid - minSpan / 2;
      hi = mid + minSpan / 2;
    }
    const padY = (hi - lo) * 0.12;
    lo -= padY;
    hi += padY;

    const t0 = points[0].t;
    const t1 = points[points.length - 1].t;
    const x = (t: number) => (t1 === t0 ? (PAD.l + W - PAD.r) / 2 : PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r));
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    const ticks = [0, 1, 2, 3].map((i) => lo + ((hi - lo) * i) / 3);
    const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    const area = `${line} L${x(t1).toFixed(1)},${H - PAD.b} L${x(t0).toFixed(1)},${H - PAD.b} Z`;
    const last = points[points.length - 1];
    const color = COLOR[metric];
    const gradId = `area-${metric}`;

    body = (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${metric} from ${shortDate(t0)} to ${shortDate(t1)}: ${points[0].v.toFixed(1)}${suffix} to ${last.v.toFixed(1)}${suffix}`}
      >
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#27272a" strokeWidth="1" />
            <text x={PAD.l - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="#71717a">
              {v.toFixed(metric === "fat" ? 1 : 0)}
            </text>
          </g>
        ))}
        {goal !== null && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(goal)} y2={y(goal)} stroke="#f4f4f5" strokeWidth="1.2" strokeDasharray="5 4" opacity="0.7" />
            <text x={W - PAD.r} y={y(goal) - 5} textAnchor="end" fontSize="10" fontWeight="700" fill="#f4f4f5" opacity="0.85">
              Goal {Math.round(goal)}
            </text>
          </g>
        )}
        {points.length > 1 && <path d={area} fill={`url(#${gradId})`} />}
        {points.length > 1 && <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {points.map((p, i) => (
          <circle key={i} cx={x(p.t)} cy={y(p.v)} r={i === points.length - 1 ? 4.5 : 2.8} fill={color} stroke="#18181b" strokeWidth="1.5" />
        ))}
        <text
          x={Math.min(Math.max(x(last.t), PAD.l + 20), W - PAD.r - 20)}
          y={Math.max(y(last.v) - 10, 11)}
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill={color}
        >
          {last.v.toFixed(1)}
          {metric === "fat" ? "%" : ""}
        </text>
        <text x={PAD.l} y={H - 8} fontSize="10" fill="#71717a">
          {shortDate(t0)}
        </text>
        {t1 !== t0 && (
          <text x={W - PAD.r} y={H - 8} textAnchor="end" fontSize="10" fill="#71717a">
            {shortDate(t1)}
          </text>
        )}
      </svg>
    );
  }

  return (
    <div>
      {body}
      <div role="group" aria-label="Date range" className="mt-2 flex justify-center gap-1">
        {(Object.keys(RANGE_DAYS) as Range[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            aria-pressed={range === r}
            className={`h-7 rounded-full px-3 text-xs font-semibold transition ${
              range === r ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
