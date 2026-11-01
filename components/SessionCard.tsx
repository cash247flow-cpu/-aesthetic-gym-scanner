"use client";

import { useEffect, useState } from "react";

type Info = { signedInAt: string; idleExpiresAt: string; absoluteExpiresAt: string } | { mode: "open-dev" } | null;
type Device = { id: string; device: string; createdAt: number; lastSeen: number; current: boolean };
type Devices = { available: false } | { available: true; devices: Device[] } | null;
const ago = (ms: number) => {
  const d = Math.floor((Date.now() - ms) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};
const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** This phone's sign-in: when it ends, sign out, and what to do if a phone is lost. */
export function SessionCard() {
  const [info, setInfo] = useState<Info>(null);
  const [busy, setBusy] = useState(false);
  const [lost, setLost] = useState(false);
  const [devices, setDevices] = useState<Devices>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadDevices = () =>
    fetch("/api/sessions", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setDevices)
      .catch(() => setDevices(null));

  useEffect(() => {
    fetch("/api/session", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setInfo)
      .catch(() => setInfo(null));
    void loadDevices();
  }, []);

  async function signOutDevice(body: { id: string } | { others: true }, label: string) {
    if (!window.confirm(`Sign out ${label}? It will need the app passcode to get back in. Its data stays on that device.`)) return;
    setBusy(true);
    const r = await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    const out = r?.ok ? ((await r.json()) as { signedOut: number }) : null;
    setMsg(out ? `Signed out ${out.signedOut} device${out.signedOut === 1 ? "" : "s"}.` : "Couldn't sign that device out — try again.");
    void loadDevices();
  }

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
      {devices?.available && (
        <div className="mt-3 border-t border-zinc-800 pt-3" aria-label="Signed-in devices">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Signed-in devices</p>
          <ul className="mt-1.5 grid gap-1.5">
            {devices.devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded-xl bg-zinc-800/60 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {d.device}
                    {d.current && <span className="ml-1.5 rounded bg-lime-400 px-1 text-[10px] text-zinc-950">THIS PHONE</span>}
                  </span>
                  <span className="block text-xs text-zinc-400">
                    Signed in {fmt(new Date(d.createdAt).toISOString())} · last used {ago(d.lastSeen)}
                  </span>
                </span>
                {!d.current && (
                  <button type="button" disabled={busy} onClick={() => signOutDevice({ id: d.id }, d.device)} className="h-9 shrink-0 rounded-full border border-zinc-600 px-3 text-xs font-semibold disabled:opacity-50">
                    Sign out
                  </button>
                )}
              </li>
            ))}
          </ul>
          {devices.devices.some((d) => !d.current) && (
            <button type="button" disabled={busy} onClick={() => signOutDevice({ others: true }, "every other device")} className="mt-2 h-10 w-full rounded-xl border border-zinc-600 text-xs font-semibold disabled:opacity-50">
              Sign out all other devices
            </button>
          )}
          {msg && (
            <p role="status" className="mt-2 text-xs text-lime-300">
              {msg}
            </p>
          )}
        </div>
      )}
      <button type="button" onClick={() => setLost((v) => !v)} aria-expanded={lost} className="mt-2 w-full text-left text-xs font-semibold text-amber-300">
        {lost ? "▾" : "▸"} Lost a phone, or think someone else is signed in?
      </button>
      {lost && (
        <ol className="mt-1.5 grid list-decimal gap-1 pl-5 text-xs text-zinc-300">
          {devices?.available ? (
            <li>Tap <span className="font-semibold">Sign out</span> next to the lost device above (or &ldquo;Sign out all other devices&rdquo;). It&apos;s refused on its very next request.</li>
          ) : (
            <li>
              In Vercel → your project → Settings → Environment Variables, give <span className="font-mono">SESSION_SECRET</span> a new random value (32+
              characters) and redeploy. That signs out <span className="font-semibold">every</span> device, this one included.
            </li>
          )}
          <li>Sign out of Vercel on all devices (or change your Vercel password) — Vercel&apos;s login also protects this app.</li>
          <li>If the passcode might be known, change <span className="font-mono">APP_PASSCODE</span> too.</li>
          <li>Sign back in here with the passcode. Your data on this phone isn&apos;t affected.</li>
        </ol>
      )}
    </section>
  );
}
