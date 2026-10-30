"use client";

import { useEffect, useState } from "react";

// Asks before any photo is sent to the AI reader (Google Gemini) — every time, no "remember".
// Callers await requestAiConsent(kind); only a "Send" tap resolves true. The fetch must then
// carry AI_CONSENT_HEADERS — the server refuses photo uploads without it.

export type AiPhotoKind = "gym" | "scale" | "report" | "cardio";
export const AI_CONSENT_HEADERS = { "x-ai-consent": "granted" } as const;

const WHAT: Record<AiPhotoKind, { noun: string; returns: string; tip: string }> = {
  gym: { noun: "gym photo", returns: "the list of equipment it sees", tip: "Avoid photos with other people's faces in them." },
  scale: { noun: "scale photo", returns: "the numbers on the display", tip: "Frame just the scale display." },
  report: {
    noun: "body-composition report",
    returns: "the measurements",
    tip: "Reports often show your name, age or date of birth — crop to just the numbers if you can.",
  },
  cardio: { noun: "cardio screen photo", returns: "steps, floors and time", tip: "Crop out anything other than the workout summary." },
};

type Pending = { kind: AiPhotoKind; resolve: (ok: boolean) => void };
let show: ((p: Pending) => void) | null = null;

export function requestAiConsent(kind: AiPhotoKind): Promise<boolean> {
  return new Promise((resolve) => (show ? show({ kind, resolve }) : resolve(false)));
}

/** Mounted once (root layout). Renders the confirmation when a photo flow asks for it. */
export function AiConsentHost() {
  const [pending, setPending] = useState<Pending | null>(null);
  useEffect(() => {
    show = (p) => setPending((cur) => (cur ? (p.resolve(false), cur) : p));
    return () => {
      show = null;
    };
  }, []);
  if (!pending) return null;
  const w = WHAT[pending.kind];
  const answer = (ok: boolean) => {
    pending.resolve(ok);
    setPending(null);
  };
  const manual = pending.kind === "scale" || pending.kind === "report" || pending.kind === "cardio";

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="ai-consent-title" className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
        <h2 id="ai-consent-title" className="text-lg font-semibold">
          Send this {w.noun} to Google Gemini?
        </h2>
        <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-sm text-zinc-300">
          <li>
            To read {w.returns}, AESTHETIQ sends this image to <span className="font-semibold text-zinc-100">Google&apos;s Gemini AI service</span>, outside
            your phone.
          </li>
          <li>AESTHETIQ&apos;s server passes it on without keeping a copy; only the numbers come back. Google handles it under the Gemini API terms of the account this app uses.</li>
          <li>{w.tip}</li>
        </ul>
        <div className="mt-4 grid gap-2">
          <button type="button" onClick={() => answer(true)} className="h-12 rounded-xl bg-lime-400 font-semibold text-zinc-950">
            Send to Gemini
          </button>
          <button type="button" onClick={() => answer(false)} className="h-12 rounded-xl bg-zinc-800 font-semibold text-zinc-100">
            {manual ? "Don't send — I'll type it in" : "Don't send"}
          </button>
        </div>
      </div>
    </div>
  );
}
