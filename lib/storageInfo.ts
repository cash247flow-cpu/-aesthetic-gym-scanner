// Browser storage reliability. Asking for "persistent" storage lowers the chance the browser
// clears the app's data on its own when the phone runs low on space. It does NOT protect against
// clearing site data, uninstalling the app, or losing the phone — and there is no backup yet.

export type StorageStatus = { supported: boolean; persisted: boolean | null; usageMB: number | null; quotaMB: number | null };

/** Ask once per app start; the browser may say no (that's fine — nothing else changes). */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function storageStatus(): Promise<StorageStatus> {
  try {
    if (!navigator.storage) return { supported: false, persisted: null, usageMB: null, quotaMB: null };
    const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : null;
    const est = navigator.storage.estimate ? await navigator.storage.estimate() : null;
    const mb = (n?: number) => (n == null ? null : Math.round((n / 1024 / 1024) * 10) / 10);
    return { supported: true, persisted, usageMB: mb(est?.usage), quotaMB: mb(est?.quota) };
  } catch {
    return { supported: false, persisted: null, usageMB: null, quotaMB: null };
  }
}
