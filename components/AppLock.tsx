"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  afterFailure,
  afterSuccess,
  deviceUnlockAvailable,
  hashPin,
  loadLock,
  pinProblem,
  registerDevice,
  saveLock,
  stillUnlocked,
  unlockWithDevice,
  verifyPin,
  waitSeconds,
  type LockConfig,
  type Relock,
} from "@/lib/appLock";

// Unlock state lives in memory only: reloading or reopening the app always starts locked.
let unlockedAt: number | null = null;
let lastActive = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
export function lockNow() {
  unlockedAt = null;
  notify();
}
function markUnlocked() {
  unlockedAt = lastActive = Date.now();
  notify();
}

/** The current lock settings, re-read whenever the lock is turned on/off, locked or unlocked. */
function useLockConfig(): LockConfig | null | undefined {
  const [config, setConfig] = useState<LockConfig | null | undefined>(undefined);
  useEffect(() => {
    const read = () => setConfig(loadLock());
    read();
    listeners.add(read);
    return () => void listeners.delete(read);
  }, []);
  return config;
}

const INPUT =
  "mt-1 h-12 w-full rounded-xl bg-zinc-800 px-3 text-center text-lg tracking-[0.4em] text-zinc-100 placeholder:tracking-normal placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-lime-400";

/** Shows `children` only when the app lock is off, or unlocked recently. */
export function LockGate({ area, children }: { area: string; children: ReactNode }) {
  const config = useLockConfig();
  const open = !config || stillUnlocked(config.relock, unlockedAt, lastActive, Date.now());

  // While open: activity keeps it open; leaving the app locks it (if chosen).
  useEffect(() => {
    if (!config || !open) return;
    const touch = () => (lastActive = Date.now());
    const hidden = () => document.visibilityState === "hidden" && config.relock === "leave" && lockNow();
    const tick = setInterval(() => !stillUnlocked(config.relock, unlockedAt, lastActive, Date.now()) && lockNow(), 15_000);
    document.addEventListener("pointerdown", touch);
    document.addEventListener("keydown", touch);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      clearInterval(tick);
      document.removeEventListener("pointerdown", touch);
      document.removeEventListener("keydown", touch);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [config, open]);

  if (config === undefined) return <div className="h-40" aria-hidden />;
  if (open) return <>{children}</>;
  return <LockScreen area={area} config={config} onConfig={() => notify()} />;
}

function LockScreen({ area, config, onConfig }: { area: string; config: LockConfig; onConfig: (c: LockConfig | null) => void }) {
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [, tick] = useState(0);
  const wait = waitSeconds(config, Date.now());
  useEffect(() => {
    if (!wait) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [wait]);

  const device = useCallback(async () => {
    if (!config.device) return;
    setMsg(null);
    try {
      if (await unlockWithDevice(config.device.credentialId)) return markUnlocked();
      setMsg("This phone didn't confirm it's you.");
    } catch {
      setMsg(config.pin ? "Phone unlock was cancelled — use your app PIN instead." : "Phone unlock was cancelled.");
    }
  }, [config]);

  async function withPin(e: React.FormEvent) {
    e.preventDefault();
    if (!config.pin || wait || !pin) return;
    setBusy(true);
    const ok = await verifyPin(pin, config.pin);
    const next = ok ? afterSuccess(config) : afterFailure(config, Date.now());
    saveLock(next);
    onConfig(next);
    setBusy(false);
    setPin("");
    if (ok) return markUnlocked();
    const w = waitSeconds(next, Date.now());
    setMsg(w ? `Too many wrong PINs. Try again in ${w} seconds.` : "Wrong PIN.");
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode }) }).catch(() => null);
    setBusy(false);
    setPasscode("");
    if (!res?.ok) return setMsg(res?.status === 401 ? "That's not the app passcode." : "Couldn't check the passcode — try again.");
    saveLock(null); // the lock is removed; set a new one in Data on this phone
    onConfig(null);
  }

  return (
    <section aria-label="Locked" className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-center">
      <p className="text-4xl" aria-hidden>
        🔒
      </p>
      <h1 className="mt-2 text-xl font-semibold">{area} is locked</h1>
      <p className="mt-1 text-sm text-zinc-400">Your app lock keeps photos and body data private on this phone.</p>
      {!forgot ? (
        <>
          {config.device && (
            <button type="button" onClick={device} className="mt-4 h-12 w-full rounded-xl bg-lime-400 font-semibold text-zinc-950">
              Unlock with this phone
            </button>
          )}
          {config.pin && (
            <form onSubmit={withPin} className="mt-4 text-left">
              <label className="block text-xs text-zinc-400">
                App PIN
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={12}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  aria-label="App PIN"
                  disabled={!!wait}
                  className={INPUT}
                />
              </label>
              <button type="submit" disabled={busy || !!wait || pin.length < 6} className="mt-2 h-12 w-full rounded-xl bg-zinc-100 font-semibold text-zinc-900 disabled:opacity-40">
                {wait ? `Wait ${wait}s` : busy ? "Checking…" : "Unlock"}
              </button>
            </form>
          )}
          <button type="button" onClick={() => (setForgot(true), setMsg(null))} className="mt-3 text-xs font-semibold text-zinc-400 underline">
            Forgot the PIN or can&apos;t unlock?
          </button>
        </>
      ) : (
        <form onSubmit={reset} className="mt-4 text-left">
          <p className="text-xs text-zinc-400">Enter the app passcode (the one you use to sign in). The app lock is then removed — you can set it up again in Data on this phone.</p>
          <input
            type="password"
            autoComplete="current-password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            aria-label="App passcode"
            className="mt-2 h-12 w-full rounded-xl bg-zinc-800 px-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-lime-400"
          />
          <button type="submit" disabled={busy || !passcode} className="mt-2 h-12 w-full rounded-xl bg-zinc-100 font-semibold text-zinc-900 disabled:opacity-40">
            {busy ? "Checking…" : "Remove app lock"}
          </button>
          <button type="button" onClick={() => setForgot(false)} className="mt-2 w-full text-xs font-semibold text-zinc-400">
            Back
          </button>
        </form>
      )}
      {msg && (
        <p role="alert" className="mt-3 text-sm text-amber-300">
          {msg}
        </p>
      )}
    </section>
  );
}

const RELOCK_LABEL: Record<Relock, string> = { leave: "When I leave the app (or after 5 min)", "5": "After 5 minutes without use", "15": "After 15 minutes without use" };

/** Settings card (shown inside the locked Data on this phone screen). */
export function LockSettings() {
  const [config, setConfig] = useState<LockConfig | null | undefined>(undefined);
  const [canDevice, setCanDevice] = useState(false);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setConfig(loadLock());
    deviceUnlockAvailable().then(setCanDevice);
  }, []);

  const update = (c: LockConfig | null, text: string) => {
    saveLock(c);
    setConfig(c);
    setMsg({ ok: true, text });
    if (c) markUnlocked();
    else notify();
  };
  const blank = (): LockConfig => ({ enabled: true, pin: null, device: null, relock: "leave", failures: 0, blockedUntil: 0 });
  const problem = pin ? pinProblem(pin) : null;

  async function savePin() {
    if (problem || pin !== pin2) return;
    setBusy(true);
    const hashed = await hashPin(pin);
    setBusy(false);
    setPin("");
    setPin2("");
    update({ ...(config ?? blank()), pin: hashed, failures: 0, blockedUntil: 0 }, config?.pin ? "PIN changed." : "App lock is on.");
  }

  async function addDevice() {
    setMsg(null);
    try {
      const d = await registerDevice();
      if (d) update({ ...(config ?? blank()), device: d }, "This phone's screen lock can now unlock the app.");
    } catch {
      setMsg({ ok: false, text: "Phone unlock wasn't set up (cancelled or not supported). You can use an app PIN instead." });
    }
  }

  if (config === undefined) return null;
  return (
    <section aria-label="App lock" className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5 text-sm">
      <p className="font-semibold">App lock {config ? "· on" : "· off"}</p>
      <p className="mt-1 text-xs text-zinc-400">
        Locks Visual evolution, Body tracker and this screen, so someone holding your unlocked phone can&apos;t see your photos, body data or
        backups. It&apos;s a privacy screen — it doesn&apos;t encrypt the data.
      </p>

      {config && (
        <ul className="mt-2 grid gap-0.5 text-xs text-zinc-300">
          <li>{config.device ? "✓ Unlock with this phone's screen lock" : "— Phone screen lock not set up"}</li>
          <li>{config.pin ? "✓ App PIN set" : "— No app PIN"}</li>
        </ul>
      )}

      {canDevice && !config?.device && (
        <button type="button" onClick={addDevice} className="mt-3 h-11 w-full rounded-xl bg-lime-400 font-semibold text-zinc-950">
          Use this phone&apos;s fingerprint / face / screen lock
        </button>
      )}

      <div className="mt-3">
        <p className="text-xs text-zinc-400">{config?.pin ? "Change app PIN" : "Set an app PIN (6–12 digits)"}</p>
        <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={12} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} aria-label="New app PIN" className={INPUT} />
        <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={12} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))} aria-label="Repeat app PIN" placeholder="again" className={INPUT} />
        {problem && <p className="mt-1 text-xs text-amber-300">{problem}</p>}
        {pin2 && pin !== pin2 && <p className="mt-1 text-xs text-amber-300">The PINs don&apos;t match.</p>}
        <button type="button" disabled={busy || !pin || !!problem || pin !== pin2} onClick={savePin} className="mt-2 h-11 w-full rounded-xl bg-zinc-100 font-semibold text-zinc-900 disabled:opacity-40">
          {busy ? "Saving…" : config?.pin ? "Change PIN" : "Save PIN"}
        </button>
      </div>

      {config && (
        <>
          <label className="mt-3 block text-xs text-zinc-400">
            Lock again
            <select
              value={config.relock}
              onChange={(e) => update({ ...config, relock: e.target.value as Relock }, "Saved.")}
              className="mt-1 h-11 w-full rounded-xl bg-zinc-800 px-3 text-sm text-zinc-100"
            >
              {(Object.keys(RELOCK_LABEL) as Relock[]).map((r) => (
                <option key={r} value={r}>
                  {RELOCK_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={lockNow} className="h-11 rounded-xl bg-zinc-800 font-semibold">
              Lock now
            </button>
            <button
              type="button"
              onClick={() => window.confirm("Turn off the app lock on this phone?") && update(null, "App lock is off.")}
              className="h-11 rounded-xl border border-zinc-600 font-semibold"
            >
              Turn off
            </button>
          </div>
        </>
      )}
      <p className="mt-2 text-xs text-zinc-500">Forgot the PIN? The app passcode removes the lock. The lock is set per phone and isn&apos;t included in backups.</p>
      {msg && (
        <p role="status" className={`mt-2 text-sm ${msg.ok ? "text-lime-300" : "text-amber-300"}`}>
          {msg.text}
        </p>
      )}
    </section>
  );
}
