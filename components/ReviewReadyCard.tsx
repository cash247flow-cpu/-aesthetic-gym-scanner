"use client";

import { useEffect, useState } from "react";
import { loadEntries } from "@/lib/bodyLog";
import { loadHabitLogs } from "@/lib/habits";
import { loadHistory } from "@/lib/wins";
import { periodLabel, type Period } from "@/lib/review/period";
import { pendingReview } from "@/lib/review/store";

/** Home: an unobtrusive nudge when last week has ended and hasn't been reviewed yet. */
export function ReviewReadyCard({ onOpen }: { onOpen: () => void }) {
  const [period, setPeriod] = useState<Period | null>(null);
  useEffect(() => {
    const p = pendingReview();
    // Only for people with something to review.
    const hasData = loadHistory().length > 0 || loadEntries().length > 0 || Object.keys(loadHabitLogs()).length > 0;
    setPeriod(p && hasData ? p : null);
  }, []);
  if (!period) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-amber-300/30 bg-gradient-to-r from-amber-300/10 to-transparent px-4 py-3 text-left transition active:scale-[0.98]"
    >
      <span aria-hidden className="text-2xl">
        📊
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-amber-100">Your weekly review is ready</span>
        <span className="block truncate text-xs text-zinc-400">{periodLabel(period)} · progress is more than a number</span>
      </span>
      <span aria-hidden className="text-zinc-500">
        ›
      </span>
    </button>
  );
}
