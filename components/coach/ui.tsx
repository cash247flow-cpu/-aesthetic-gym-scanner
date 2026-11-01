// Small shared pieces for the nutrition coach screens (same black + lime look as the app).

export const CARD = "rounded-2xl border border-zinc-800 bg-zinc-900 p-4";
export const BTN = "h-11 rounded-full bg-lime-400 px-5 text-sm font-semibold text-zinc-950 transition active:scale-[0.97] disabled:opacity-40";
export const BTN2 = "h-11 rounded-full border border-zinc-700 bg-zinc-950 px-4 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 active:scale-[0.97] disabled:opacity-40";
export const INPUT = "h-11 min-w-0 rounded-lg bg-zinc-800 px-3 text-base text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-lime-400";
export const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-zinc-500";

export function Note({ tone = "info", children, label }: { tone?: "info" | "warn" | "ok"; children: React.ReactNode; label?: string }) {
  const cls =
    tone === "warn" ? "border-amber-400/40 bg-amber-400/10 text-amber-200" : tone === "ok" ? "border-lime-400/40 bg-lime-400/10 text-lime-100" : "border-zinc-700 bg-zinc-950 text-zinc-300";
  return (
    <p role={tone === "warn" ? "alert" : "status"} aria-label={label} className={`rounded-xl border px-3 py-2 text-sm ${cls}`}>
      {children}
    </p>
  );
}

/** "Estimate" or "From your label" — shown next to every nutrition number. */
export function SourceTag({ source }: { source: string }) {
  const map: Record<string, [string, string]> = {
    estimate: ["Estimate", "bg-zinc-800 text-zinc-300"],
    label: ["From your label", "bg-lime-400/15 text-lime-200"],
    cronometer: ["From Cronometer", "bg-orange-400/15 text-orange-200"],
    mixed: ["Partly estimated", "bg-zinc-800 text-zinc-300"],
  };
  const [text, cls] = map[source] ?? map.estimate;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{text}</span>;
}

export const macroLine = (t: { kcal: number; protein: number; carbs: number; fat: number }) =>
  `≈${Math.round(t.kcal)} kcal · ${Math.round(t.protein)} g protein · ${Math.round(t.carbs)} g net carbs · ${Math.round(t.fat)} g fat`;
