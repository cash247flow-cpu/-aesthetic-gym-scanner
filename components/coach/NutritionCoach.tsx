"use client";

// The nutrition coach: Scan My Fridge · What Should I Eat? · Grocery List · I'm Working Late.
// Main flow: photo → confirm ingredients → choose a meal → confirm eaten, or add groceries.

import { useEffect, useState } from "react";
import { AccentLast, TITLE } from "@/components/ui";
import { loadPrefs, type Prefs } from "@/lib/nutrition/prefs";
import { loadInventory, type InventoryItem } from "@/lib/nutrition/inventory";
import { loadGrocery, type GroceryItem } from "@/lib/nutrition/grocery";
import { loadLog, type LogEntry } from "@/lib/nutrition/log";
import { readToday, type Today } from "@/lib/nutrition/today";
import { dismissReminder, dueReminders, loadDismissed, loadReminders, type DueReminder, type Reminders } from "@/lib/nutrition/reminders";
import type { Hunger } from "@/lib/nutrition/suggest";
import { Fridge } from "./Fridge";
import { EatNow } from "./Eat";
import { Grocery } from "./Grocery";
import { LateCheckIn } from "./Late";
import { PrefsForm, RemindersForm, TargetsGate } from "./Setup";

export type CoachTab = "fridge" | "eat" | "grocery" | "late" | "settings";
const TABS: { key: CoachTab; label: string }[] = [
  { key: "fridge", label: "Fridge" },
  { key: "eat", label: "Eat" },
  { key: "grocery", label: "Groceries" },
  { key: "late", label: "Late" },
  { key: "settings", label: "Settings" },
];
const TITLES: Record<CoachTab, string> = {
  fridge: "Scan My Fridge",
  eat: "What Should I Eat?",
  grocery: "Grocery List",
  late: "I'm Working Late",
  settings: "Coach Settings",
};

export function NutritionCoach({ initialTab, shopping = false, onBack, onMealPlan }: { initialTab: CoachTab; shopping?: boolean; onBack: () => void; onMealPlan: () => void }) {
  const [tab, setTab] = useState<CoachTab>(initialTab);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [grocery, setGrocery] = useState<GroceryItem[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [today, setToday] = useState<Today | null>(null);
  const [reminders, setReminders] = useState<Reminders | null>(null);
  const [eatHunger, setEatHunger] = useState<Hunger | undefined>(undefined);

  useEffect(() => {
    setPrefs(loadPrefs());
    setInventory(loadInventory());
    setGrocery(loadGrocery());
    setLog(loadLog());
    setToday(readToday());
    setReminders(loadReminders());
  }, []);
  // Today's numbers depend on the log; re-read them whenever it changes.
  useEffect(() => {
    if (today) setToday(readToday());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log]);

  const go = (t: CoachTab) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  if (!today) return null;
  return (
    <section className="mt-2 pb-8">
      <button type="button" onClick={onBack} className="text-sm text-zinc-400">
        ← Back
      </button>
      <h1 className={`${TITLE} mt-2`}>
        <AccentLast text={TITLES[tab]} />
      </h1>
      <nav aria-label="Coach sections" className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-current={tab === t.key ? "page" : undefined}
            onClick={() => go(t.key)}
            className={`h-9 shrink-0 rounded-full border px-4 text-sm font-semibold ${tab === t.key ? "border-lime-400 bg-lime-400/10 text-lime-200" : "border-zinc-800 text-zinc-400"}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "fridge" && <Fridge inventory={inventory} onInventory={setInventory} onEat={() => go("eat")} />}

      {tab === "eat" &&
        (!today.target ? (
          <TargetsGate today={today} onConfirmed={() => setToday(readToday())} onEditTargets={onMealPlan} />
        ) : !prefs ? (
          <PrefsForm prefs={null} onSaved={setPrefs} />
        ) : (
          <EatNow
            key={eatHunger ?? 0}
            today={today}
            prefs={prefs}
            inventory={inventory}
            grocery={grocery}
            onGrocery={setGrocery}
            log={log}
            onLog={setLog}
            initialHunger={eatHunger}
            initialPrep={eatHunger ? Math.min(prefs.prepMin, 15) : undefined}
            onFridge={() => go("fridge")}
          />
        ))}

      {tab === "grocery" && (
        <Grocery items={grocery} onItems={setGrocery} prefs={prefs} inventory={inventory} onInventory={setInventory} remaining={today.remaining} shoppingStart={shopping} />
      )}

      {tab === "late" && (
        <LateCheckIn
          today={today}
          inventory={inventory}
          onMeal={(h) => {
            setEatHunger(h);
            go("eat");
          }}
          onGroceries={() => go("grocery")}
          onFridge={() => go("fridge")}
          onMealPlan={onMealPlan}
        />
      )}

      {tab === "settings" && (
        <>
          <PrefsForm prefs={prefs} onSaved={setPrefs} />
          {reminders && <RemindersForm value={reminders} onChange={setReminders} />}
        </>
      )}
    </section>
  );
}

/** Home-screen entry points plus any reminder that's due right now (in-app only). */
export function CoachHome({ onOpen }: { onOpen: (tab: CoachTab, opts?: { shopping?: boolean }) => void }) {
  const [due, setDue] = useState<DueReminder[]>([]);
  useEffect(() => {
    setDue(dueReminders(loadReminders(), loadDismissed(), new Date()));
  }, []);
  const ENTRIES: { tab: CoachTab; icon: string; label: string }[] = [
    { tab: "fridge", icon: "📷", label: "Scan My Fridge" },
    { tab: "eat", icon: "🍳", label: "What Should I Eat?" },
    { tab: "grocery", icon: "🛒", label: "Grocery List" },
    { tab: "late", icon: "🌙", label: "I'm Working Late" },
  ];
  return (
    <section aria-label="Food coach" className="mt-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Food coach</h2>
      {due.map((r) => (
        <div key={r.kind} role="status" aria-label="Reminder" className="mt-2 rounded-2xl border border-lime-400/40 bg-lime-400/5 p-3 text-sm">
          <p className="text-zinc-100">{r.text}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <button type="button" className="font-semibold text-lime-300" onClick={() => onOpen(r.kind === "grocery" ? "grocery" : "late")}>
              Open
            </button>
            <button
              type="button"
              className="font-semibold text-zinc-400"
              onClick={() => {
                const rs = loadReminders();
                dismissReminder(r.kind, new Date(), rs.timeZone);
                setDue((cur) => cur.filter((x) => x.kind !== r.kind));
              }}
            >
              Dismiss for today
            </button>
            <button type="button" className="font-semibold text-zinc-400" onClick={() => onOpen("settings")}>
              Edit reminders
            </button>
          </div>
        </div>
      ))}
      <div className="mt-2 grid grid-cols-2 gap-2">
        {ENTRIES.map((e) => (
          <button
            key={e.tab}
            type="button"
            onClick={() => onOpen(e.tab)}
            className="flex min-h-16 items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-left text-sm font-semibold transition hover:border-lime-400/60 active:scale-[0.97]"
          >
            <span aria-hidden className="text-lg">
              {e.icon}
            </span>
            {e.label}
          </button>
        ))}
      </div>
    </section>
  );
}
