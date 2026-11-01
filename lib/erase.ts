// "Delete everything on this phone": removes all of AESTHETIQ's data from this browser — every
// `ags:` record, the photo/report store (IndexedDB "ags"), and the app's offline caches — and can
// sign the phone out. It can't touch copies elsewhere (backup files you saved, Google Drive) or
// photos already sent to Gemini for reading. Storage access is injected so it can be tested.

export const RECENT_BACKUP_HOURS = 24;
export const CONFIRM_WORD = "DELETE";

/** Is the last backup recent enough to erase without an extra "I have no backup" acknowledgement? */
export function backupGate(lastBackupAt: string | null, now = Date.now()): { recent: boolean; hoursAgo: number | null } {
  if (!lastBackupAt || Number.isNaN(Date.parse(lastBackupAt))) return { recent: false, hoursAgo: null };
  const hoursAgo = Math.max(0, (now - Date.parse(lastBackupAt)) / 3_600_000);
  return { recent: hoursAgo <= RECENT_BACKUP_HOURS, hoursAgo };
}

/** All the user's confirmations line up (typed word, plus the no-backup acknowledgement if needed). */
export const canErase = (typed: string, recent: boolean, acknowledgedNoBackup: boolean) =>
  typed.trim() === CONFIRM_WORD && (recent || acknowledgedNoBackup);

export type EraseDeps = {
  storage: Pick<Storage, "length" | "key" | "removeItem">;
  deleteDatabase: (name: string) => Promise<"deleted" | "blocked" | "error">;
  cacheKeys: () => Promise<string[]>;
  deleteCache: (name: string) => Promise<boolean>;
  signOut: () => Promise<boolean>;
};

export type EraseResult = { records: number; database: "deleted" | "blocked" | "error"; caches: number; signedOut: boolean | null; remaining: number };

export async function eraseAll(deps: EraseDeps, opts: { signOut: boolean }): Promise<EraseResult> {
  // Files first, so no record is left pointing at a missing photo if something stops halfway.
  const database = await deps.deleteDatabase("ags");
  const keys: string[] = [];
  for (let i = 0; i < deps.storage.length; i++) {
    const k = deps.storage.key(i);
    if (k?.startsWith("ags:")) keys.push(k);
  }
  for (const k of keys) deps.storage.removeItem(k);
  let caches = 0;
  for (const name of await deps.cacheKeys()) if (name.startsWith("ags-") && (await deps.deleteCache(name))) caches++;
  const signedOut = opts.signOut ? await deps.signOut() : null;
  let remaining = 0;
  for (let i = 0; i < deps.storage.length; i++) if (deps.storage.key(i)?.startsWith("ags:")) remaining++;
  return { records: keys.length, database, caches, signedOut, remaining };
}

/** The real browser storage. */
export const browserEraseDeps = (): EraseDeps => ({
  storage: localStorage,
  deleteDatabase: (name) =>
    new Promise((resolve) => {
      try {
        const req = indexedDB.deleteDatabase(name);
        req.onsuccess = () => resolve("deleted");
        req.onerror = () => resolve("error");
        req.onblocked = () => resolve("blocked");
      } catch {
        resolve("error");
      }
    }),
  cacheKeys: async () => {
    try {
      return "caches" in window ? await caches.keys() : [];
    } catch {
      return [];
    }
  },
  deleteCache: async (name) => {
    try {
      return await caches.delete(name);
    } catch {
      return false;
    }
  },
  signOut: async () => {
    try {
      return (await fetch("/api/logout", { method: "POST" })).ok;
    } catch {
      return false;
    }
  },
});
