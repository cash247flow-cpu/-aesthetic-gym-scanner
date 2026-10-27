// The training plan's supplement protocol, following its revised integrated schedule:
// items it approves can be ticked; items it holds for dose review stay on hold until the
// user marks them cleared by a clinician (with the dose they were cleared for). The app
// never suggests or changes a dose.

export type SuppSlot = "morning" | "lunch" | "dinner" | "bed";
export type Supplement = {
  id: string;
  name: string;
  slot: SuppSlot;
  dose: string; // dose as the plan lists it
  note?: string;
  hold?: string; // why the plan holds it; absent = approved
};

export const SLOTS: { id: SuppSlot; title: string; when: string }[] = [
  { id: "morning", title: "Morning", when: "With breakfast — after the eggs and sardines" },
  { id: "lunch", title: "Lunch", when: "Several hours away from the morning and evening capsules" },
  { id: "dinner", title: "Dinner", when: "With the last meal of the day" },
  { id: "bed", title: "Before bed", when: "No psyllium here" },
];

export const SUPPLEMENTS: Supplement[] = [
  { id: "thyroid", name: "Thyroid Energy", slot: "morning", dose: "2 capsules" },
  { id: "multi", name: "Multivitamin", slot: "morning", dose: "2 capsules" },
  {
    id: "creatine",
    name: "Creatine monohydrate",
    slot: "morning",
    dose: "5 g",
    note: "Timing isn't critical — daily consistency is.",
  },
  { id: "d3-am", name: "Vitamin D3", slot: "morning", dose: "15,000 IU (1 cap)", hold: "Hold pending dose review" },
  { id: "vitc", name: "Vitamin C", slot: "morning", dose: "2,000 mg (2 caps)", hold: "Dose requires review" },
  {
    id: "psyllium",
    name: "Psyllium",
    slot: "lunch",
    dose: "1 labeled serving in ≥ 8 oz (240 mL) water",
    note: "Drink immediately. Keeps it away from your capsules so it doesn't block absorption.",
  },
  { id: "zinc", name: "Zinc picolinate", slot: "dinner", dose: "50 mg (1 cap)", hold: "Hold pending dose review" },
  { id: "d3-pm", name: "Vitamin D3", slot: "dinner", dose: "15,000 IU (1 cap)", hold: "Hold pending dose review" },
  {
    id: "mag-gly",
    name: "Magnesium glycinate",
    slot: "dinner",
    dose: "800 mg (2 caps)",
    hold: "Verify elemental magnesium first",
  },
  {
    id: "mag-calm",
    name: "Magnesium Calm powder",
    slot: "bed",
    dose: "1–2 scoops",
    hold: "Verify elemental magnesium per serving before combining with magnesium glycinate",
  },
];

// ─── Storage: daily ticks + items cleared by a clinician ───────────────
const TAKEN_KEY = "ags:supps";
const CLEARED_KEY = "ags:supps:cleared";

type TakenLog = Record<string, Record<string, boolean>>; // date → id → taken
export type Cleared = Record<string, { dose: string; date: string }>; // id → cleared dose

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const loadTaken = () => read<TakenLog>(TAKEN_KEY, {});
export const saveTaken = (log: TakenLog) => write(TAKEN_KEY, log);
export const loadCleared = () => read<Cleared>(CLEARED_KEY, {});
export const saveCleared = (c: Cleared) => write(CLEARED_KEY, c);

/** Items that can be ticked today: approved by the plan, or cleared since. */
export const activeSupplements = (cleared: Cleared) => SUPPLEMENTS.filter((s) => !s.hold || cleared[s.id]);

export function takenCount(log: TakenLog, date: string, cleared: Cleared) {
  const day = log[date] ?? {};
  const active = activeSupplements(cleared);
  return { taken: active.filter((s) => day[s.id]).length, total: active.length };
}
