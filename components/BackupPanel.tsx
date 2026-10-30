"use client";

import { useEffect, useRef, useState } from "react";
import { BackupError, backupFileName, decryptBackup, encryptBackup, hasUserData, passphraseProblem, summarize, type BackupPayload, type RestoreMode, type Summary } from "@/lib/backup";
import { applyRestore, collectPayload, currentRecords, daysSince, loadLastBackup, saveLastBackup, shareOrDownload, type LastBackup } from "@/lib/backupStore";
import { listFileIds } from "@/lib/bodyLog";

const INPUT =
  "mt-1 h-11 w-full rounded-lg bg-zinc-800 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-lime-400";

function summaryLine(s: Summary) {
  const parts = [
    [s.workouts, "workout", "workouts"],
    [s.historyEntries, "history entry", "history entries"],
    [s.bodyEntries, "body entry", "body entries"],
    [s.progressPhotos, "progress photo", "progress photos"],
    [s.reviews, "weekly review", "weekly reviews"],
    [s.habitDays, "habit day", "habit days"],
    [s.files, "stored file", "stored files"],
  ] as const;
  return parts.map(([n, one, many]) => `${n} ${n === 1 ? one : many}`).join(" · ");
}

const fmtDate = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** "Last backup" line, used here and in reminders. */
export function lastBackupText(last: LastBackup | null) {
  if (!last) return "No backup made on this phone yet.";
  const d = daysSince(last.at);
  return `Last backup ${d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`} (${fmtDate(last.at)}).`;
}

/** Encrypted backup and safe restore. Everything happens on the phone; no server sees the file. */
export function BackupPanel() {
  const [last, setLast] = useState<LastBackup | null>(null);
  useEffect(() => setLast(loadLastBackup()), []);

  return (
    <div className="grid gap-3">
      <CreateBackup last={last} onMade={() => setLast(loadLastBackup())} />
      <RestoreBackup />
    </div>
  );
}

function CreateBackup({ last, onMade }: { last: LastBackup | null; onMade: () => void }) {
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const problem = pass ? passphraseProblem(pass) : null;
  const mismatch = again.length > 0 && again !== pass;
  const ready = !!pass && !problem && again === pass && !busy;

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      const payload = await collectPayload();
      const bytes = await encryptBackup(payload, pass);
      const result = await shareOrDownload(bytes, backupFileName());
      if (result === "cancelled") {
        setMsg({ tone: "warn", text: "Backup not saved — the share sheet was closed. Try again and pick where to save it." });
        return;
      }
      saveLastBackup(payload);
      onMade();
      setPass("");
      setAgain("");
      const s = summarize(payload.records, payload.files.length);
      setMsg({
        tone: "ok",
        text: `${result === "shared" ? "Backup handed to the place you chose" : "Backup saved to your downloads"}: ${summaryLine(s)}. Keep the file somewhere safe off this phone, and keep the passphrase separately.`,
      });
    } catch (e) {
      setMsg({ tone: "warn", text: e instanceof BackupError ? e.message : "Couldn't create the backup. Make sure the phone has free space and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Create backup" className="rounded-2xl border border-lime-400/30 bg-zinc-900 p-3.5 text-sm">
      <p className="font-semibold">Create an encrypted backup</p>
      <p className="mt-1 text-zinc-300">{lastBackupText(last)}</p>
      <p className="mt-1 text-xs text-zinc-400">
        One file with every workout, body entry, habit, review and photo — encrypted on this phone with a passphrase you choose. Save it to
        Google Drive, a password manager or a computer. AESTHETIQ never receives it.
      </p>
      <label className="mt-3 block text-xs text-zinc-400">
        Backup passphrase
        <input type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} className={INPUT} aria-label="Backup passphrase" />
      </label>
      <label className="mt-2 block text-xs text-zinc-400">
        Type it again
        <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className={INPUT} aria-label="Repeat backup passphrase" />
      </label>
      {problem && <p className="mt-1 text-xs text-amber-300">{problem}</p>}
      {mismatch && <p className="mt-1 text-xs text-amber-300">The two passphrases don&apos;t match.</p>}
      <p className="mt-2 text-xs text-amber-200">
        ⚠️ If you forget this passphrase, the backup can&apos;t be opened — by you or anyone else. Use something memorable, or store it in a password
        manager. It&apos;s separate from the app passcode.
      </p>
      <button type="button" disabled={!ready} onClick={create} className="mt-3 h-12 w-full rounded-xl bg-lime-400 font-semibold text-zinc-950 disabled:opacity-40">
        {busy ? "Encrypting… (a few seconds)" : "Create backup"}
      </button>
      {msg && (
        <p role="status" className={`mt-2 text-sm ${msg.tone === "ok" ? "text-lime-300" : "text-amber-300"}`}>
          {msg.text}
        </p>
      )}
    </section>
  );
}

type Opened = { backup: BackupPayload; incoming: Summary; current: Summary; currentEmpty: boolean };

function RestoreBackup() {
  const [file, setFile] = useState<File | null>(null);
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [mode, setMode] = useState<RestoreMode>("replace");
  const [safetySaved, setSafetySaved] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [done, setDone] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function reset() {
    setOpened(null);
    setSafetySaved(false);
    setDone(false);
    setMsg(null);
  }

  async function open() {
    if (!file) return;
    setBusy(true);
    reset();
    try {
      const backup = await decryptBackup(new Uint8Array(await file.arrayBuffer()), pass);
      const records = currentRecords();
      const ids = await listFileIds();
      const current = summarize(records, ids.length);
      setOpened({ backup, incoming: summarize(backup.records, backup.files.length), current, currentEmpty: !hasUserData(records, ids.length) });
    } catch (e) {
      setMsg({ tone: "warn", text: e instanceof BackupError ? e.message : "Couldn't open that file." });
    } finally {
      setBusy(false);
    }
  }

  async function safetyBackup() {
    setBusy(true);
    try {
      const payload = await collectPayload();
      const bytes = await encryptBackup(payload, pass);
      const r = await shareOrDownload(bytes, backupFileName().replace(".aqbk", "-before-restore.aqbk"));
      if (r === "cancelled") return setMsg({ tone: "warn", text: "Safety backup not saved. Save it before restoring." });
      saveLastBackup(payload);
      setSafetySaved(true);
      setMsg({ tone: "ok", text: "Safety backup of this phone saved (same passphrase as the file you're restoring)." });
    } catch {
      setMsg({ tone: "warn", text: "Couldn't create the safety backup, so nothing was restored." });
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    if (!opened) return;
    const words = mode === "replace" ? "REPLACE everything on this phone with the backup" : "ADD the backup's missing items to this phone";
    if (!window.confirm(`${words}? This can't be undone except by restoring the safety backup.`)) return;
    setBusy(true);
    try {
      const r = await applyRestore(opened.backup, mode);
      setDone(true);
      setMsg({ tone: "ok", text: `Restored ${r.records} record${r.records === 1 ? "" : "s"} and ${r.files} file${r.files === 1 ? "" : "s"}. Reload the app to see them.` });
    } catch {
      setMsg({ tone: "warn", text: "The restore stopped partway. Restore the safety backup to get back to where you were." });
    } finally {
      setBusy(false);
    }
  }

  const needsSafety = opened ? !opened.currentEmpty : true;
  return (
    <section aria-label="Restore backup" className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5 text-sm">
      <p className="font-semibold">Restore from a backup</p>
      <p className="mt-1 text-xs text-zinc-400">Nothing changes until you&apos;ve seen what&apos;s inside and confirmed.</p>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" onClick={() => input.current?.click()} className="h-10 shrink-0 rounded-lg bg-zinc-800 px-3 text-sm font-semibold">
          Choose file
        </button>
        <span className="min-w-0 truncate text-xs text-zinc-400">{file ? file.name : "No file chosen"}</span>
      </div>
      <input
        ref={input}
        type="file"
        accept=".aqbk,application/octet-stream"
        className="sr-only"
        tabIndex={-1}
        aria-label="Backup file"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          e.target.value = "";
          reset();
        }}
      />
      <label className="mt-2 block text-xs text-zinc-400">
        The backup&apos;s passphrase
        <input type="password" autoComplete="off" value={pass} onChange={(e) => setPass(e.target.value)} className={INPUT} aria-label="Passphrase of the backup" />
      </label>
      <button type="button" disabled={!file || !pass || busy} onClick={open} className="mt-2 h-11 w-full rounded-xl bg-zinc-100 font-semibold text-zinc-900 disabled:opacity-40">
        {busy && !opened ? "Checking…" : "Open backup"}
      </button>

      {opened && !done && (
        <div className="mt-3 grid gap-2 rounded-xl border border-zinc-700 p-3">
          <p className="font-semibold">Backup from {fmtDate(opened.backup.createdAt)}</p>
          <p className="text-xs text-zinc-300">
            <span className="font-semibold text-zinc-100">In the backup:</span> {summaryLine(opened.incoming)}
          </p>
          <p className="text-xs text-zinc-400">
            <span className="font-semibold text-zinc-200">On this phone now:</span> {summaryLine(opened.current)}
          </p>
          <div role="radiogroup" aria-label="Restore mode" className="mt-1 grid gap-1.5">
            {(
              [
                ["replace", "Replace everything", "This phone ends up exactly like the backup. Anything not in the backup is removed."],
                ["add-missing", "Add only what's missing", "Keeps everything already on this phone; only items it doesn't have are added."],
              ] as const
            ).map(([k, label, hint]) => (
              <label key={k} className="flex items-start gap-2.5">
                <input type="radio" name="restore-mode" checked={mode === k} onChange={() => setMode(k)} className="mt-1 h-4 w-4 accent-lime-400" />
                <span>
                  {label}
                  <span className="block text-xs text-zinc-500">{hint}</span>
                </span>
              </label>
            ))}
          </div>
          {needsSafety && (
            <button type="button" disabled={busy || safetySaved} onClick={safetyBackup} className="h-11 rounded-xl bg-zinc-800 text-sm font-semibold disabled:opacity-60">
              {safetySaved ? "✓ Safety backup saved" : "Step 1 · Save a safety backup of this phone"}
            </button>
          )}
          <button
            type="button"
            disabled={busy || (needsSafety && !safetySaved)}
            onClick={restore}
            className="h-12 rounded-xl bg-lime-400 font-semibold text-zinc-950 disabled:opacity-40"
          >
            {needsSafety ? "Step 2 · Restore now" : "Restore now"}
          </button>
        </div>
      )}
      {msg && (
        <p role="status" className={`mt-2 text-sm ${msg.tone === "ok" ? "text-lime-300" : "text-amber-300"}`}>
          {msg.text}
        </p>
      )}
      {done && (
        <button type="button" onClick={() => window.location.reload()} className="mt-2 h-11 w-full rounded-xl bg-zinc-100 font-semibold text-zinc-900">
          Reload app
        </button>
      )}
    </section>
  );
}
