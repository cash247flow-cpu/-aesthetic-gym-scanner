// Shared look: serif-italic accent words and the lime→mint pill button.

/** One word in a heading set in the italic serif, in lime. */
export function Accent({ children }: { children: React.ReactNode }) {
  return <em className="font-accent font-normal italic text-lime-300">{children}</em>;
}

/** A heading whose last word gets the accent font, e.g. "Push <Day>". */
export function AccentLast({ text }: { text: string }) {
  const i = text.trimEnd().lastIndexOf(" ");
  if (i < 0) return <Accent>{text}</Accent>;
  return (
    <>
      {text.slice(0, i + 1)}
      <Accent>{text.slice(i + 1)}</Accent>
    </>
  );
}

/** App name with the logo, at the top of each screen. */
export function Brand() {
  return (
    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-lime-400">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png?v=2" alt="" className="h-6 w-6 rounded-md" />
      AESTHETIQ
    </p>
  );
}

export const TITLE = "text-[2rem] font-bold leading-[1.1] tracking-tight";

export function ArrowCircle({ dark = true }: { dark?: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${dark ? "bg-zinc-950 text-zinc-50" : "bg-zinc-50 text-zinc-950"}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </span>
  );
}
