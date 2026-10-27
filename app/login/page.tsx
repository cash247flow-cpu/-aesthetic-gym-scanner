"use client";

import { useState } from "react";
import { Accent, ArrowCircle, TITLE } from "@/components/ui";

export default function Login() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!passcode || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't sign in.");
      window.location.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-end px-4 pb-12 pt-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/icon-512.png?v=2"
        alt=""
        className="mx-auto mb-auto mt-[10vh] h-40 w-40 rounded-[2.5rem]"
      />
      <p className="text-sm font-bold uppercase tracking-[0.35em] text-lime-400">AESTHETIQ</p>
      <h1 className={`mt-2 ${TITLE} text-[2.6rem]`}>
        Build Your Ideal <Accent>Physique</Accent>
      </h1>
      <p className="mt-2 text-sm text-zinc-400">Enter your app passcode. You&apos;ll stay signed in on this phone.</p>

      <form onSubmit={submit} className="mt-6">
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          aria-label="App passcode"
          placeholder="Passcode"
          autoComplete="current-password"
          autoFocus
          className="h-14 w-full rounded-full border border-zinc-700 bg-zinc-900 px-6 text-base text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-lime-400"
        />
        {error && (
          <p role="alert" className="mt-3 px-2 text-sm text-red-300">
            {error}
          </p>
        )}
        <button type="submit" disabled={!passcode || busy} className="btn-glow mt-3">
          {busy ? "Checking…" : "Unlock"}
          <ArrowCircle />
        </button>
      </form>
    </main>
  );
}
