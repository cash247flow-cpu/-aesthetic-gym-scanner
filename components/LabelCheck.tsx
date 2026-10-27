"use client";

import { useEffect, useState } from "react";
import type { LabelFacts, LabelHit, LabelIngredient } from "@/lib/dsld";
import type { SavedLabel, Supplement } from "@/lib/supplements";

type Load<T> = { state: "idle" } | { state: "loading" } | { state: "error"; message: string } | { state: "ok"; data: T };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
}

/**
 * Full-screen "Check label": find your product in the NIH Dietary Supplement Label Database and
 * see its supplement facts per serving. Reference only — it never suggests a dose or lifts a hold.
 */
export function LabelCheck({
  supp,
  saved,
  onSave,
  onClose,
}: {
  supp: Supplement;
  saved?: SavedLabel;
  onSave: (label: SavedLabel | null) => void;
  onClose: () => void;
}) {
  const [labelId, setLabelId] = useState<number | null>(saved?.id ?? null);
  const [query, setQuery] = useState(supp.name);
  const [results, setResults] = useState<Load<LabelHit[]>>({ state: "idle" });
  const [label, setLabel] = useState<Load<LabelFacts>>({ state: "idle" });

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function search(q: string) {
    if (q.trim().length < 2) return;
    setResults({ state: "loading" });
    try {
      const { hits } = await getJson<{ hits: LabelHit[] }>(`/api/supp-label/search?q=${encodeURIComponent(q.trim())}`);
      setResults({ state: "ok", data: hits });
    } catch (err) {
      setResults({ state: "error", message: err instanceof Error ? err.message : "Search failed." });
    }
  }

  // Open on your saved product, or search for the plan's item name.
  useEffect(() => {
    if (saved) return;
    void search(supp.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (labelId === null) return;
    let cancelled = false;
    setLabel({ state: "loading" });
    getJson<LabelFacts>(`/api/supp-label/${labelId}`)
      .then((data) => !cancelled && setLabel({ state: "ok", data }))
      .catch((err) => !cancelled && setLabel({ state: "error", message: err instanceof Error ? err.message : "Couldn't load." }));
    return () => {
      cancelled = true;
    };
  }, [labelId]);

  function backToSearch() {
    setLabelId(null);
    if (results.state === "idle") void search(query);
  }

  const showing = labelId !== null;
  const isSaved = showing && saved?.id === labelId;

  return (
    <div role="dialog" aria-modal="true" aria-label={`Check label: ${supp.name}`} className="fixed inset-0 z-[60] overflow-y-auto bg-zinc-950">
      <div className="mx-auto w-full max-w-md px-4 pb-10">
        <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 bg-zinc-950/95 px-4 py-3 backdrop-blur">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-300">Check label</p>
            <p className="truncate font-semibold">{supp.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-zinc-800 text-lg text-zinc-200 hover:bg-zinc-700"
          >
            ×
          </button>
        </div>

        {!showing && (
          <>
            <form
              className="mt-1 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void search(query);
              }}
            >
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Product, brand or barcode"
                placeholder="Product, brand or barcode"
                enterKeyHint="search"
                className="h-11 min-w-0 flex-1 rounded-xl bg-zinc-900 px-3 text-base text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
              <button type="submit" className="h-11 shrink-0 rounded-xl bg-teal-400 px-4 text-sm font-semibold text-zinc-950">
                Search
              </button>
            </form>
            <p className="mt-1.5 text-xs text-zinc-500">Add the brand from your bottle, or type the barcode numbers.</p>

            {results.state === "loading" && <p className="mt-5 text-sm text-zinc-400">Searching NIH label database…</p>}
            {results.state === "error" && <p className="mt-5 text-sm text-rose-300">{results.message}</p>}
            {results.state === "ok" && results.data.length === 0 && (
              <p className="mt-5 text-sm text-zinc-400">No labels found. Try the brand name or the barcode.</p>
            )}
            {results.state === "ok" && results.data.length > 0 && (
              <ul className="mt-4 grid grid-cols-1 gap-2">
                {results.data.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => setLabelId(h.id)}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-3 text-left transition hover:border-zinc-700 active:scale-[0.99]"
                    >
                      <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">{h.brand}</span>
                      <span className="block font-semibold text-zinc-100">{h.name}</span>
                      <span className="mt-0.5 block text-xs text-zinc-400">
                        {[h.form, h.contents].filter(Boolean).join(" · ")}
                        {h.offMarket && <span className="text-amber-300"> · No longer sold</span>}
                        {saved?.id === h.id && <span className="text-teal-300"> · Your product</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {showing && (
          <>
            {label.state === "loading" && <p className="mt-5 text-sm text-zinc-400">Loading label…</p>}
            {label.state === "error" && <p className="mt-5 text-sm text-rose-300">{label.message}</p>}
            {label.state === "ok" && <Facts label={label.data} highlight={supp.labelGroup} />}

            {label.state === "ok" && !isSaved && (
              <button
                type="button"
                onClick={() => onSave({ id: label.data.id, name: label.data.name, brand: label.data.brand })}
                className="mt-5 h-12 w-full rounded-xl bg-teal-400 text-base font-semibold text-zinc-950 transition hover:bg-teal-300 active:scale-[0.98]"
              >
                This is my product
              </button>
            )}
            {isSaved && <p className="mt-5 text-center text-sm text-teal-300">✓ Saved as your product</p>}
            <div className="mt-3 flex items-center justify-between gap-3">
              <button type="button" onClick={backToSearch} className="text-sm font-semibold text-zinc-300 hover:text-zinc-100">
                ← {isSaved ? "Change product" : "Back to results"}
              </button>
              {isSaved && (
                <button
                  type="button"
                  onClick={() => {
                    onSave(null);
                    backToSearch();
                  }}
                  className="text-sm text-zinc-500 hover:text-zinc-300"
                >
                  Forget product
                </button>
              )}
            </div>
          </>
        )}

        <p className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5 text-xs text-amber-100">
          Label facts for reference only. This doesn&apos;t change your plan or any hold — take the label to your clinician;
          doses are their call.
        </p>
        <p className="mt-3 text-xs text-zinc-500">
          Source: National Institutes of Health, Office of Dietary Supplements. Dietary Supplement Label Database (public
          domain). Labels can change — check the bottle you have.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 h-12 w-full rounded-xl bg-zinc-800 text-base font-semibold text-zinc-100 transition hover:bg-zinc-700 active:scale-[0.98]"
        >
          Back
        </button>
      </div>
    </div>
  );
}

const matches = (i: LabelIngredient, group?: string) =>
  !!group && [i.group, i.name].some((v) => v?.toLowerCase().includes(group.toLowerCase()));

function Facts({ label, highlight }: { label: LabelFacts; highlight?: string }) {
  return (
    <div className="mt-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label.brand}</p>
      <h2 className="text-xl font-bold leading-tight">{label.name}</h2>
      {label.offMarket && <p className="mt-1 text-xs font-semibold text-amber-300">Listed as no longer sold</p>}

      <div className="mt-3 rounded-xl border border-zinc-700 bg-zinc-900 p-3.5">
        <p className="text-base font-bold">Supplement Facts</p>
        <p className="text-sm text-zinc-300">
          Serving size: {label.servingSize ?? "not listed"}
          {label.servingsPerContainer && ` · ${label.servingsPerContainer} per container`}
        </p>
        <div className="mt-2 flex justify-between border-b border-zinc-700 pb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          <span>Ingredient</span>
          <span>Per serving</span>
        </div>
        <ul className="divide-y divide-zinc-800">
          {label.ingredients.map((ing, i) => (
            <IngredientRow key={`${ing.name}-${i}`} ing={ing} highlight={highlight} />
          ))}
        </ul>
        {label.otherIngredients.length > 0 && (
          <p className="mt-2 border-t border-zinc-700 pt-2 text-xs text-zinc-400">
            Other ingredients: {label.otherIngredients.join(", ")}
          </p>
        )}
      </div>
      {highlight && label.ingredients.some((i) => matches(i, highlight)) && (
        <p className="mt-2 text-xs text-zinc-400">
          <span className="font-semibold text-teal-300">{highlight}</span> is highlighted. A row named just
          “{highlight}” is the elemental amount; a row named after the compound (e.g. “{highlight} Glycinate”) is the
          weight of the whole compound.
        </p>
      )}
      {label.upc && <p className="mt-2 text-xs text-zinc-500">Barcode: {label.upc}</p>}
      <a
        href={label.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-block text-xs font-semibold text-zinc-400 underline hover:text-zinc-200"
      >
        View the full label on NIH DSLD
      </a>
    </div>
  );
}

function IngredientRow({ ing, highlight, nested }: { ing: LabelIngredient; highlight?: string; nested?: boolean }) {
  const hit = matches(ing, highlight);
  return (
    <li className={`py-1.5 ${nested ? "pl-3" : ""}`}>
      <div className={`flex items-baseline justify-between gap-3 ${hit ? "-mx-1.5 rounded-md bg-teal-400/15 px-1.5" : ""}`}>
        <span className={`min-w-0 text-sm ${hit ? "font-semibold text-teal-100" : "text-zinc-200"}`}>
          {ing.name}
          {ing.forms.length > 0 && <span className="block text-xs font-normal text-zinc-400">as {ing.forms.join(", ")}</span>}
        </span>
        <span className={`shrink-0 text-sm tabular-nums ${hit ? "font-bold text-teal-100" : "text-zinc-300"}`}>{ing.amount ?? "—"}</span>
      </div>
      {ing.nested && (
        <ul>
          {ing.nested.map((n, i) => (
            <IngredientRow key={`${n.name}-${i}`} ing={n} highlight={highlight} nested />
          ))}
        </ul>
      )}
    </li>
  );
}
