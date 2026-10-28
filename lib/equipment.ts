// Canonical equipment names Gemini is allowed to return. Anything else is discarded.
export const CANONICAL_EQUIPMENT = [
  "cable machine",
  "lat pulldown",
  "dumbbells",
  "barbell",
  "bench",
  "incline bench",
  "decline bench",
  "squat rack",
  "ez bar",
  "rope attachment",
  "neutral grip attachment",
  "ankle strap",
  "smith machine",
  "hack squat machine",
  "leg press",
  "leg extension machine",
  "seated leg curl machine",
  "lying leg curl machine",
  "calf raise machine",
  "chest press machine",
  "reverse pec deck",
  "lateral raise machine",
  "preacher curl machine",
  "crunch machine",
  "abductor machine",
  "pull-up bar",
  "captains chair",
  "t-bar row machine",
] as const;

const CANONICAL_SET = new Set<string>(CANONICAL_EQUIPMENT);

/** Lowercase, trim, de-duplicate and drop anything not in the canonical list. */
export function normalizeEquipment(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<string>();
  for (const item of input) {
    if (typeof item !== "string") continue;
    const name = item.trim().toLowerCase().replace(/[’']/g, "");
    if (CANONICAL_SET.has(name)) out.add(name);
  }
  return Array.from(out);
}
