"use client";

export type Tab = "home" | "meals" | "progress" | "more";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "home",
    label: "Home",
    icon: <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8Z" />,
  },
  {
    id: "meals",
    label: "Meals",
    icon: <path d="M4 13h16M5 13a7 7 0 0 0 14 0M12 6v2M8.5 6.5l.8 1.6M15.5 6.5l-.8 1.6" />,
  },
  {
    id: "progress",
    label: "Progress",
    icon: <path d="M4 19h16M7 15v-3M12 15V8M17 15v-6" />,
  },
  {
    id: "more",
    label: "More",
    icon: (
      <>
        <circle cx="6" cy="6" r="1.5" />
        <circle cx="12" cy="6" r="1.5" />
        <circle cx="18" cy="6" r="1.5" />
        <circle cx="6" cy="12" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="18" cy="12" r="1.5" />
        <circle cx="6" cy="18" r="1.5" />
        <circle cx="12" cy="18" r="1.5" />
        <circle cx="18" cy="18" r="1.5" />
      </>
    ),
  },
];

/** Bottom navigation with the round lime Scan button in the middle (opens the camera). */
export function TabBar({ active, onTab, onScan }: { active: Tab | null; onTab: (tab: Tab) => void; onScan: () => void }) {
  const button = (t: (typeof TABS)[number]) => {
    const on = active === t.id;
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => onTab(t.id)}
        aria-current={on ? "page" : undefined}
        className={`flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium transition ${on ? "text-lime-300" : "text-zinc-400 hover:text-zinc-100"}`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {t.icon}
        </svg>
        {t.label}
      </button>
    );
  };

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800/80 bg-zinc-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
        {TABS.slice(0, 2).map(button)}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onScan}
            aria-label="Scan the gym"
            className="-mt-8 grid h-16 w-16 place-items-center rounded-full bg-lime-400 text-zinc-950 shadow-[0_0_24px_-2px_rgba(198,244,50,0.7)] ring-4 ring-black transition active:scale-95"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M7 12h10" />
            </svg>
          </button>
        </div>
        {TABS.slice(2).map(button)}
      </div>
    </nav>
  );
}
