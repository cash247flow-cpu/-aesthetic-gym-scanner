import type { Badge, BadgeGroup } from "@/lib/wins";

const GRADIENT: Record<BadgeGroup, string> = {
  lift: "from-lime-300 via-lime-400 to-emerald-500 text-zinc-950",
  workouts: "from-violet-300 via-violet-400 to-indigo-500 text-zinc-950",
  prs: "from-amber-200 via-amber-400 to-orange-500 text-zinc-950",
  cardio: "from-sky-200 via-sky-400 to-blue-500 text-zinc-950",
};

const HEX = "polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0% 50%)";

export function WinBadge({ badge, size = "md", isNew = false }: { badge: Badge; size?: "md" | "lg"; isNew?: boolean }) {
  const dims = size === "lg" ? "h-28 w-32" : "h-[4.5rem] w-20";
  const labelSize = size === "lg" ? "text-4xl" : "text-xl";
  return (
    <div className="relative flex flex-col items-center" title={`${badge.label} ${badge.sub}`}>
      <div
        style={{ clipPath: HEX }}
        className={`grid place-items-center bg-gradient-to-br ${dims} ${
          badge.earned ? GRADIENT[badge.group] : "from-zinc-800 to-zinc-800 text-zinc-600"
        } ${size === "lg" ? "drop-shadow-[0_8px_24px_rgba(163,230,53,0.35)]" : ""}`}
      >
        <div className="text-center leading-none">
          <p className={`font-black tracking-tight ${labelSize}`}>{badge.label}</p>
          <p className={`mt-1 font-bold uppercase ${size === "lg" ? "text-[11px]" : "text-[9px]"} tracking-wide opacity-80`}>
            {badge.sub}
          </p>
        </div>
      </div>
      {isNew && (
        <span className="absolute -right-1 -top-1 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-black text-zinc-950 shadow">
          NEW
        </span>
      )}
    </div>
  );
}
