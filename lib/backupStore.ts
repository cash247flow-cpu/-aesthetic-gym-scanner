// Reads and writes everything AESTHETIQ stores on this phone for backup/restore (browser only).
// Records: every localStorage key starting "ags:". Files: every blob in IndexedDB "ags/files".

import { deleteFile, getFile, listFileIds, putFileWithId } from "@/lib/bodyLog";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  fromBase64,
  planRestore,
  sha256Hex,
  toBase64,
  type BackupFile,
  type BackupPayload,
  type RestoreMode,
} from "@/lib/backup";

const LAST_KEY = "ags:backup:last"; // when this phone last made a backup (not itself backed up)
export type LastBackup = { at: string; records: number; files: number };

export function currentRecords(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("ags:") && k !== LAST_KEY) out[k] = localStorage.getItem(k) ?? "";
  }
  return out;
}

export async function collectPayload(): Promise<BackupPayload> {
  const files: BackupFile[] = [];
  for (const id of await listFileIds()) {
    const blob = await getFile(id);
    if (!blob) continue;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    files.push({ id, type: blob.type, size: bytes.length, sha256: await sha256Hex(bytes), data: toBase64(bytes) });
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: new Date().toISOString(), records: currentRecords(), files };
}

export function loadLastBackup(): LastBackup | null {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_KEY) ?? "null") as LastBackup | null;
    return v && typeof v.at === "string" ? v : null;
  } catch {
    return null;
  }
}

export function saveLastBackup(p: BackupPayload) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify({ at: p.createdAt, records: Object.keys(p.records).length, files: p.files.length }));
  } catch {
    /* ignore */
  }
}

export const daysSince = (iso: string, now = Date.now()) => Math.floor((now - Date.parse(iso)) / 86_400_000);

/**
 * Write a validated backup to this phone. Files go first (records point at them), then records.
 * Only called after the user saw the preview and confirmed.
 */
export async function applyRestore(backup: BackupPayload, mode: RestoreMode): Promise<{ records: number; files: number }> {
  const plan = planRestore({ records: currentRecords(), fileIds: await listFileIds() }, backup, mode);
  for (const f of plan.writeFiles) await putFileWithId(f.id, new Blob([fromBase64(f.data) as BlobPart], { type: f.type }));
  for (const id of plan.removeFiles) await deleteFile(id);
  for (const [k, v] of Object.entries(plan.writeRecords)) localStorage.setItem(k, v);
  for (const k of plan.removeRecords) localStorage.removeItem(k);
  return { records: Object.keys(plan.writeRecords).length, files: plan.writeFiles.length };
}

/** Hand a file to the share sheet (e.g. Google Drive) or save it to downloads. */
export async function shareOrDownload(bytes: Uint8Array, name: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([bytes as BlobPart], name, { type: "application/octet-stream" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "AESTHETIQ backup" });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return "downloaded";
}
