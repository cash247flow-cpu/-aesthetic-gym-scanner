// Body measurements: entries + goal in localStorage, photos/reports (too big for it) in IndexedDB.
// Everything is stored in lb and converted for display.

export type BodySource = "manual" | "scale" | "report";
export type BodyEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  weightLb: number;
  bodyFatPct?: number;
  muscleLb?: number;
  bmi?: number;
  visceralFat?: number;
  bmr?: number;
  source: BodySource;
  fileId?: string; // scale photo or report in IndexedDB
  fileType?: string;
};
export type GoalType = "lose" | "gain" | "maintain";
export type BodyGoal = { type: GoalType; targetLb: number };

const ENTRIES_KEY = "ags:body:entries";
const GOAL_KEY = "ags:body:goal";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

const byDate = (a: BodyEntry, b: BodyEntry) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id);

export function loadEntries(): BodyEntry[] {
  return (read<BodyEntry[]>(ENTRIES_KEY) ?? []).sort(byDate);
}

export function saveEntries(entries: BodyEntry[]) {
  write(ENTRIES_KEY, [...entries].sort(byDate));
}

export function loadGoal(): BodyGoal | null {
  return read<BodyGoal>(GOAL_KEY);
}

export function saveGoal(goal: BodyGoal | null) {
  write(GOAL_KEY, goal);
}

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// ─── IndexedDB file store ──────────────────────────────────────────────
const DB_NAME = "ags";
const STORE = "files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function putFile(blob: Blob): Promise<string> {
  const id = newId();
  await withStore("readwrite", (s) => s.put(blob, id));
  return id;
}

export async function getFile(id: string): Promise<Blob | null> {
  try {
    return (await withStore<Blob | undefined>("readonly", (s) => s.get(id))) ?? null;
  } catch {
    return null;
  }
}

export async function deleteFile(id: string) {
  try {
    await withStore("readwrite", (s) => s.delete(id));
  } catch {
    /* ignore */
  }
}
