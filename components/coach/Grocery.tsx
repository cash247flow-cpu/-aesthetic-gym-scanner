"use client";

// Editable grocery list with an "I'm grocery shopping" mode and a nutrition-label check.
// No prices, stock or store availability are shown or claimed.

import { useRef, useState } from "react";
import { AI_CONSENT_HEADERS, requestAiConsent } from "@/components/AiConsent";
import { shrinkImage } from "@/lib/image";
import { addGrocery, clearChecked, editGrocery, groceryWarnings, removeGrocery, saveGrocery, swapsFor, toggleGrocery, type GroceryItem } from "@/lib/nutrition/grocery";
import { UNITS, confirmDrafts, saveInventory, type InventoryItem, type Unit } from "@/lib/nutrition/inventory";
import { compareLabel, type LabelReading } from "@/lib/nutrition/readings";
import type { Prefs } from "@/lib/nutrition/prefs";
import type { Remaining } from "@/lib/nutrition/log";
import { num } from "@/lib/nutrition/store";
import { BTN, BTN2, CARD, INPUT, Note } from "./ui";

export function Grocery({
  items,
  onItems,
  prefs,
  inventory,
  onInventory,
  remaining,
  shoppingStart = false,
}: {
  items: GroceryItem[];
  onItems: (g: GroceryItem[]) => void;
  prefs: Prefs | null;
  inventory: InventoryItem[];
  onInventory: (i: InventoryItem[]) => void;
  remaining: Remaining | null;
  shoppingStart?: boolean;
}) {
  const [shopping, setShopping] = useState(shoppingStart);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState<Unit | "">("");
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "warn" | "info" } | null>(null);
  const [askBought, setAskBought] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const commit = (next: GroceryItem[]) => {
    saveGrocery(next);
    onItems(next);
  };
  const checked = items.filter((x) => x.checked);
  const ordered = shopping ? [...items.filter((x) => !x.checked), ...checked] : items;

  function boughtToInventory() {
    const next = confirmDrafts(
      inventory,
      checked.map((x) => ({ name: x.name, qty: x.qty, unit: x.unit, note: "" })),
      "grocery",
    );
    saveInventory(next);
    onInventory(next);
    commit(clearChecked(items));
    setAskBought(false);
    setMsg({ text: `Added ${checked.length} item${checked.length === 1 ? "" : "s"} to your food and took them off the list.`, tone: "ok" });
  }

  return (
    <div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <button type="button" aria-pressed={shopping} onClick={() => setShopping(!shopping)} className={shopping ? BTN : BTN2}>
          🛒 {shopping ? "Shopping mode on" : "I'm grocery shopping"}
        </button>
        <span className="text-xs text-zinc-500">
          {items.length - checked.length} to get · {checked.length} in basket
        </span>
      </div>

      {!shopping && (
        <form
          aria-label="Add to grocery list"
          className={`${CARD} mt-3 grid grid-cols-1 gap-2`}
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const q = qty.trim() === "" ? null : num(qty, 0.1, 100000);
            commit(addGrocery(items, { name, qty: q, unit: q === null ? null : unit || "item" }));
            setName("");
            setQty("");
          }}
        >
          <div className="flex gap-2">
            <input aria-label="Grocery item" value={name} onChange={(e) => setName(e.target.value)} placeholder="Add an item" className={`${INPUT} flex-1`} />
            <button type="submit" className={BTN}>
              Add
            </button>
          </div>
          <div className="flex gap-2">
            <input aria-label="Grocery amount" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Amount (optional)" className={`${INPUT} w-36`} />
            <select aria-label="Grocery unit" value={unit} onChange={(e) => setUnit(e.target.value as Unit | "")} className={`${INPUT} flex-1`}>
              <option value="">unit</option>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </form>
      )}

      {msg && (
        <div className="mt-3">
          <Note tone={msg.tone}>{msg.text}</Note>
        </div>
      )}

      {!items.length ? (
        <p className="mt-4 text-sm text-zinc-500">Your list is empty. Add items here, or tap “Add missing to grocery list” on a meal idea.</p>
      ) : (
        <ul aria-label="Grocery list" className="mt-4 grid grid-cols-1 gap-1.5">
          {ordered.map((x) => {
            const warn = groceryWarnings(x.name, prefs);
            const sw = swapsFor(x.name, prefs);
            return (
              <li key={x.id} className={`rounded-xl border border-zinc-800 bg-zinc-900 px-3 ${shopping ? "py-3" : "py-2"} ${x.checked ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    aria-label={`${x.name} in basket`}
                    checked={x.checked}
                    onChange={() => commit(toggleGrocery(items, x.id))}
                    className={`${shopping ? "h-7 w-7" : "h-5 w-5"} shrink-0 accent-lime-400`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`${shopping ? "text-base" : "text-sm"} font-semibold ${x.checked ? "line-through" : ""}`}>{x.name}</p>
                    <p className="text-xs text-zinc-500">
                      {x.qty !== null ? `${x.qty} ${x.unit ?? ""}` : "amount not set"}
                      {x.note ? ` · ${x.note}` : ""}
                    </p>
                  </div>
                  {!shopping && (
                    <>
                      <button type="button" aria-label={`Edit ${x.name}`} className="text-xs font-semibold text-zinc-300" onClick={() => setEditing(editing === x.id ? null : x.id)}>
                        Edit
                      </button>
                      <button type="button" aria-label={`Delete ${x.name}`} className="text-xs font-semibold text-zinc-400" onClick={() => commit(removeGrocery(items, x.id))}>
                        ✕
                      </button>
                    </>
                  )}
                </div>
                {warn.map((w) => (
                  <p key={w} className="mt-1 text-xs text-amber-200">
                    {w}
                  </p>
                ))}
                {!shopping && (sw.swaps.length > 0 || sw.budget) && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {sw.swaps.length > 0 && <>Swap: {sw.swaps.join(" or ")}. </>}
                    {sw.budget && <>Budget: {sw.budget}</>}
                  </p>
                )}
                {editing === x.id && (
                  <GroceryEditor
                    item={x}
                    onSave={(patch) => {
                      commit(editGrocery(items, x.id, patch));
                      setEditing(null);
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {checked.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-2">
          {!askBought ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={BTN} onClick={() => setAskBought(true)}>
                I bought the checked items
              </button>
              <button type="button" className={BTN2} onClick={() => commit(clearChecked(items))}>
                Clear checked
              </button>
            </div>
          ) : (
            <div className={`${CARD} grid grid-cols-1 gap-2`} role="group" aria-label="Confirm purchase">
              <p className="text-sm">
                Add {checked.length} item{checked.length === 1 ? "" : "s"} to your food at home? (Only if you actually bought {checked.length === 1 ? "it" : "them"}.)
              </p>
              <div className="flex gap-2">
                <button type="button" className={BTN} onClick={boughtToInventory}>
                  Yes, add to my food
                </button>
                <button type="button" className={BTN2} onClick={() => setAskBought(false)}>
                  Not yet
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <LabelCheck prefs={prefs} remaining={remaining} onAdd={(n) => commit(addGrocery(items, { name: n, from: "label" }))} />
      <p className="mt-4 text-xs text-zinc-500">AESTHETIQ doesn&apos;t know store prices, stock or availability.</p>
    </div>
  );
}

function GroceryEditor({ item, onSave }: { item: GroceryItem; onSave: (p: Partial<Pick<GroceryItem, "name" | "qty" | "unit" | "note">>) => void }) {
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(item.qty === null ? "" : String(item.qty));
  const [unit, setUnit] = useState<Unit | "">(item.unit ?? "");
  return (
    <form
      aria-label={`Edit ${item.name}`}
      className="mt-2 grid grid-cols-1 gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const q = qty.trim() === "" ? null : Number(qty);
        onSave({ name, qty: q, unit: q === null ? null : unit || "item" });
      }}
    >
      <input aria-label="Item name" value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
      <div className="flex gap-2">
        <input aria-label="Item amount" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className={`${INPUT} w-24`} />
        <select aria-label="Item unit" value={unit} onChange={(e) => setUnit(e.target.value as Unit | "")} className={`${INPUT} flex-1`}>
          <option value="">unit</option>
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <button type="submit" className={BTN}>
          Save
        </button>
      </div>
    </form>
  );
}

function LabelCheck({ prefs, remaining, onAdd }: { prefs: Prefs | null; remaining: Remaining | null; onAdd: (name: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState<LabelReading | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function read(file: File) {
    setErr(null);
    setReading(null);
    if (!(await requestAiConsent("foodlabel"))) return setErr("Not sent. You can compare the label yourself against what's left today.");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("image", await shrinkImage(file), "label.jpg");
      const res = await fetch("/api/read-food-label", { method: "POST", body: form, headers: AI_CONSENT_HEADERS });
      const data = (await res.json().catch(() => ({}))) as LabelReading & { error?: string };
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Couldn't read that label.");
      if (!data.legible) throw new Error("Couldn't read the numbers clearly. Try a straight-on, well-lit photo of just the Nutrition Facts panel.");
      setReading(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't read that label.");
    } finally {
      setBusy(false);
    }
  }

  const cmp = reading ? compareLabel(reading, remaining, prefs?.allergies ?? []) : null;
  return (
    <section aria-label="Check a label" className={`${CARD} mt-5`}>
      <h2 className="font-semibold">Check a product label</h2>
      <p className="mt-1 text-sm text-zinc-400">Photo of a Nutrition Facts panel → how one serving fits what&apos;s left today.</p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Nutrition label photo"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void read(f);
        }}
      />
      <button type="button" disabled={busy} className={`${BTN2} mt-3`} onClick={() => fileRef.current?.click()}>
        {busy ? "Reading…" : "📷 Photograph a label"}
      </button>
      {err && (
        <div className="mt-3">
          <Note tone="warn">{err}</Note>
        </div>
      )}
      {reading && cmp && (
        <div aria-label="Label result" className="mt-3 grid grid-cols-1 gap-2 text-sm">
          <p className="font-semibold">{reading.productName || "This product"}</p>
          <p className="text-zinc-400">
            Per serving{reading.servingText ? ` (${reading.servingText})` : ""}: {reading.kcal ?? "?"} kcal · {reading.protein ?? "?"} g protein · {reading.carbs ?? "?"} g carbs ({reading.fiber ?? "?"} g fiber) · {reading.fat ?? "?"} g fat
          </p>
          <p className="text-xs text-zinc-500">As read from your photo — check these against the package.</p>
          {cmp.lines.map((l) => (
            <p key={l}>• {l}</p>
          ))}
          {cmp.warnings.map((w) => (
            <Note key={w} tone="warn">
              {w}
            </Note>
          ))}
          {!remaining && <p className="text-xs text-zinc-500">Confirm your targets to see how it fits today.</p>}
          <button type="button" className={`${BTN2} justify-self-start`} onClick={() => onAdd(reading.productName || "Product from label")}>
            Add to grocery list
          </button>
        </div>
      )}
    </section>
  );
}
