"use client";

import { useEffect, useState } from "react";

type Info = { signedInAt: string; idleExpiresAt: string; absoluteExpiresAt: string } | { mode: "open-dev" } | null;
const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** This phone's sign-in: when it ends, sign out, and what to do if a phone is lost. */
export function SessionCard() {
  const [info, setInfo] = useState<Info>(null);
  const [busy, setBusy] = useState(false);
  const [lost, setLost] = useState(false);

  useEffect(() => {
    fetch("/api/session", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  async function signOut() {
    if (!window.confirm("Sign out of this phone? Your data stays here; you'll need the app passcode to get back in.")) return;
    setBusy(true);
    try {
      if ("caches" in window) for (const k of await caches.keys()) if (k.startsWith("ags-")) await caches.delete(k);
    } catch {
      /* the offline copy is optional */
    }
    await fetch("/api/logout", { method: "POST" }).catch(() => null);
    window.location.replace("/login?signedout=1");
  }

  return (
    <section aria-label="This phone" className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5 text-sm">
      <p className="font-semibold">This phone&apos;s sign-in</p>
      {info && "signedInAt" in info ? (
        <ul className="mt-1.5 grid gap-0.5 text-zinc-300">
          <li>Signed in {fmt(info.signedInAt)}.</li>
          <li>Stays signed in while you use the app; after 30 days without using it, you&apos;ll need the passcode again (now: {fmt(info.idleExpiresAt)}).</li>
          <li>Sign in again by {fmt(info.absoluteExpiresAt)} at the latest (every 90 days).</li>
        </ul>
      ) : (
        <p className="mt-1 text-xs text-zinc-400">{info && "mode" in info ? "Local development — no sign-in needed." : "Checking…"}</p>
      )}
      <button type="button" disabled={busy} onClick={signOut} className="mt-3 h-11 w-full rounded-xl bg-zinc-800 font-semibold disabled:opacity-50">
        {busy ? "Signing out…" : "Sign out of this phone"}
      </button>
      <button type="button" onClick={() => setLost((v) => !v)} aria-expanded={lost} className="mt-2 w-full text-left text-xs font-semibold text-amber-300">
        {lost ? "▾" : "▸"} Lost a phone, or think someone else is signed in?
      </button>
      {lost && (
        <ol className="mt-1.5 grid list-decimal gap-1 pl-5 text-xs text-zinc-300">
          <li>
            In Vercel → your project → Settings → Environment Variables, give <span className="font-mono">SESSION_SECRET</span> a new random value (32+
            characters) and redeploy. That signs out <span className="font-semibold">every</span> device, this one included.
          </li>
          <li>Sign out of Vercel on all devices (or change your Vercel password) — Vercel&apos;s login also protects this app.</li>
          <li>If the passcode might be known, change <span className="font-mono">APP_PASSCODE</span> too.</li>
          <li>Sign back in here with the passcode. Your data on this phone isn&apos;t affected.</li>
        </ol>
      )}
    </section>
  );
}
