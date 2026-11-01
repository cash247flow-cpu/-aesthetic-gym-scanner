"use client";

import { useState } from "react";
import { CONFIRM_WORD, RECENT_BACKUP_HOURS, backupGate, browserEraseDeps, canErase, eraseAll, type EraseResult } from "@/lib/erase";
import { loadLastBackup } from "@/lib/backupStore";
import { lastBackupText } from "@/components/BackupPanel";

/** Danger zone: wipe all AESTHETIQ data from this phone, after a backup check and typed confirmation. */
export function ErasePanel() {
  const [open, setOpen] = useState(false);
  const [gate, setGate] = useState<{ recent: boolean; text: string } | null>(null);
  const [typed, setTyped] = useState("");
  const [ack, setAck] = useState(false);
  const [signOut, setSignOut] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<EraseResult | null>(null);

  // Read the backup status the moment the panel opens, so it's never a stale reading.
  function openZone() {
    const last = loadLastBackup();
    setGate({ recent: backupGate(last?.at ?? null).recent, text: lastBackupText(last) });
    setOpen(true);
  }

  async function erase() {
    if (!gate || !canErase(typed, gate.recent, ack)) return;
    setBusy(true);
    try {
      setResult(await eraseAll(browserEraseDeps(), { signOut }));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const ok = result.remaining === 0 && result.database !== "error";
    return (
      <section aria-label="Delete everything" role="status" className="rounded-2xl border border-red-400/40 bg-red-500/5 p-3.5 text-sm">
        <p className="font-semibold">{ok ? "Everything on this phone was deleted" : "Deletion didn't fully finish"}</p>
        <ul className="mt-1.5 grid list-disc gap-0.5 pl-5 text-zinc-300">
          <li>{result.records} saved records removed{result.remaining ? ` — ${result.remaining} still present` : ""}.</li>
          <li>
            Photos and reports:{" "}
            {result.database === "deleted" ? "removed" : result.database === "blocked" ? "will finish removing when the app reloads" : "couldn't be removed — reload and try again"}.
          </li>
          <li>{result.caches ? "Offline copy cleared." : "No offline copy to clear."}</li>
          {result.signedOut !== null && <li>{result.signedOut ? "This phone is signed out." : "Couldn't sign out — you're still signed in."}</li>}
        </ul>
        <p className="mt-2 text-xs text-zinc-400">Backup files you saved elsewhere (e.g. Google Drive) were not touched — restore one any time.</p>
        <button type="button" onClick={() => window.location.replace("/")} className="mt-3 h-11 w-full rounded-xl bg-zinc-100 font-semibold text-zinc-900">
          Finish
        </button>
      </section>
    );
  }

  return (
    <section aria-label="Delete everything" className="rounded-2xl border border-red-400/30 bg-zinc-900 p-3.5 text-sm">
      <p className="font-semibold text-red-200">Delete everything on this phone</p>
      <p className="mt-1 text-xs text-zinc-400">
        Removes all workouts, body entries, habits, meals, reviews, awards, settings, progress photos and reports from this phone. It
        can&apos;t be undone — only a backup brings them back.
      </p>
      {!open ? (
        <button type="button" onClick={openZone} className="mt-3 h-11 w-full rounded-xl border border-red-400/50 font-semibold text-red-200">
          Delete everything…
        </button>
      ) : (
        <div className="mt-3 grid gap-2">
          <p className={`rounded-lg p-2 text-xs ${gate?.recent ? "bg-zinc-800 text-zinc-300" : "bg-amber-300/10 text-amber-100"}`}>
            {gate?.text}{" "}
            {gate?.recent
              ? "Make sure you can open it before deleting."
              : `You don't have a backup from the last ${RECENT_BACKUP_HOURS} hours. Create one above first — otherwise this data is gone for good.`}
          </p>
          {gate && !gate.recent && (
            <label className="flex items-start gap-2.5">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-red-400" />
              <span className="text-xs">I understand there&apos;s no recent backup and everything will be lost.</span>
            </label>
          )}
          <label className="flex items-start gap-2.5">
            <input type="checkbox" checked={signOut} onChange={(e) => setSignOut(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-red-400" />
            <span className="text-xs">Also sign this phone out (you&apos;ll need the app passcode again).</span>
          </label>
          <label className="block text-xs text-zinc-400">
            Type {CONFIRM_WORD} to confirm
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              aria-label="Type DELETE to confirm"
              className="mt-1 h-11 w-full rounded-lg bg-zinc-800 px-3 text-sm tracking-widest text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setGate(null);
                setTyped("");
                setAck(false);
              }}
              className="h-11 rounded-xl bg-zinc-800 font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !gate || !canErase(typed, gate.recent, ack)}
              onClick={erase}
              className="h-11 rounded-xl bg-red-500 font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Deleting…" : "Delete everything"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
