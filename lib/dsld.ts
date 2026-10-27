// NIH Dietary Supplement Label Database (DSLD), public domain (CC0):
// https://dsld.od.nih.gov/api-guide — no API key needed (1,000 requests/hour per IP).
// The app shows label facts as reference only: no label directions, and never a dose suggestion.

const API = "https://api.ods.od.nih.gov/dsld/v9";
const TIMEOUT_MS = 10_000;

export type LabelHit = {
  id: number;
  name: string;
  brand: string;
  form?: string; // capsule, powder…
  contents?: string; // "180 Capsule(s)"
  offMarket: boolean;
};

export type LabelIngredient = {
  name: string;
  group?: string;
  amount?: string; // per serving, e.g. "200 mg"
  forms: string[]; // e.g. ["Magnesium Glycinate"]
  nested?: LabelIngredient[];
};

export type LabelFacts = {
  id: number;
  name: string;
  brand: string;
  upc?: string;
  servingSize?: string; // "2 Capsule(s)"
  servingsPerContainer?: string;
  offMarket: boolean;
  ingredients: LabelIngredient[];
  otherIngredients: string[];
  url: string;
};

export const labelPageUrl = (id: number) => `https://dsld.od.nih.gov/label/${id}`;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/** A query of only digits and spaces is a barcode; DSLD wants those quoted. */
export function searchQuery(q: string) {
  const t = q.trim();
  return /^[\d ]{6,}$/.test(t) ? `"${t}"` : t;
}

export function normalizeSearch(raw: unknown): LabelHit[] {
  return arr(obj(raw).hits)
    .map((h) => {
      const hit = obj(h);
      const s = obj(hit._source);
      const id = Number(hit._id);
      const contents = arr(s.netContents).map((n) => str(obj(n).display)).filter(Boolean)[0];
      const form = str(obj(s.physicalState).langualCodeDescription);
      return {
        id,
        name: str(s.fullName),
        brand: str(s.brandName),
        ...(form ? { form } : {}),
        ...(contents ? { contents } : {}),
        offMarket: s.offMarket === 1,
      };
    })
    .filter((h) => Number.isInteger(h.id) && h.id > 0 && h.name)
    .sort((a, b) => Number(a.offMarket) - Number(b.offMarket)); // products still sold first
}

function amountOf(row: Record<string, unknown>) {
  const q = obj(arr(row.quantity)[0]);
  const n = q.quantity;
  if (typeof n !== "number" || n <= 0) return undefined;
  const op = str(q.operator);
  return `${op && op !== "=" ? `${op} ` : ""}${n} ${str(q.unit)}`.trim();
}

function ingredient(r: unknown): LabelIngredient {
  const row = obj(r);
  const nested = arr(row.nestedRows).map(ingredient);
  const amount = amountOf(row);
  const group = str(row.ingredientGroup);
  return {
    name: str(row.name),
    ...(group ? { group } : {}),
    ...(amount ? { amount } : {}),
    forms: arr(row.forms).map((f) => str(obj(f).name)).filter(Boolean),
    ...(nested.length ? { nested } : {}),
  };
}

export function normalizeLabel(raw: unknown): LabelFacts | null {
  const l = obj(raw);
  const id = Number(l.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const size = obj(arr(l.servingSizes)[0]);
  const min = size.minQuantity;
  const max = size.maxQuantity;
  const servingSize =
    typeof min === "number"
      ? `${min}${typeof max === "number" && max !== min ? `–${max}` : ""} ${str(size.unit)}`.trim()
      : undefined;
  const upc = str(l.upcSku);
  const per = str(l.servingsPerContainer);
  return {
    id,
    name: str(l.fullName),
    brand: str(l.brandName),
    ...(upc ? { upc } : {}),
    ...(servingSize ? { servingSize } : {}),
    ...(per ? { servingsPerContainer: per } : {}),
    offMarket: l.offMarket === 1,
    ingredients: arr(l.ingredientRows).map(ingredient).filter((i) => i.name),
    otherIngredients: arr(obj(l.otheringredients).ingredients).map((i) => str(obj(i).name)).filter(Boolean),
    url: labelPageUrl(id),
  };
}

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(`${API}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate: 86_400 }, // labels rarely change; cache a day
  });
  if (!res.ok) throw new Error(`DSLD HTTP ${res.status}`);
  return res.json();
}

export async function searchLabels(q: string): Promise<LabelHit[]> {
  return normalizeSearch(await getJson(`/search-filter?q=${encodeURIComponent(searchQuery(q))}&size=15`));
}

export async function getLabel(id: number): Promise<LabelFacts | null> {
  return normalizeLabel(await getJson(`/label/${id}`));
}
