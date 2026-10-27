"use client";

import { useState } from "react";

const KEY = "ags:prereminder";
const today = () => new Date().toLocaleDateString("en-CA");

// From the training plan's revised daily schedule (30–120 minutes before morning training).
const ITEMS = [
  { icon: "💧", text: "Hydrate gradually 30–120 min before — don't force 60 oz in 30 minutes." },
  { icon: "⚡", text: "LMNT / electrolytes according to the label." },
  { icon: "🚫", text: "No psyllium or supplements before training — they go with meals." },
];

function dismissedToday(): boolean {
  try {
    return localStorage.getItem(KEY) === today();
  } catch {
    return false;
  }
}

/** "Before you train" checklist at the top of a workout; "Got it" hides it until tomorrow. */
export function PreWorkoutReminder() {
  const [hidden, setHidden] = useState(dismissedToday);
  if (hidden) return null;

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(KEY, today());
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-cyan-400/30 bg-cyan-400/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">Before you train</p>
        <button type="button" onClick={dismiss} className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">
          Got it
        </button>
      </div>
      <ul className="mt-2 grid gap-1.5 text-sm text-zinc-200">
        {ITEMS.map((item) => (
          <li key={item.icon} className="flex gap-2">
            <span aria-hidden>{item.icon}</span>
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
