"use client";

// Scan My Fridge: photos → a draft list → the user corrects and confirms → saved as inventory.
// Photos are shrunk on the phone, sent once to the AI reader after consent, and never stored.

import { useRef, useState } from "react";
import { AI_CONSENT_HEADERS, requestAiConsent } from "@/components/AiConsent";
import { shrinkImage } from "@/lib/image";
import { UNITS, ageLabel, checkDraft, confirmDrafts, editItem, fmtQty, removeItem, saveInventory, type Draft, type InventoryItem, type Unit } from "@/lib/nutrition/inventory";
import { BTN, BTN2, CARD, INPUT, LABEL, Note } from "./ui";

type Row = Draft & { key: number };
let rowKey = 0;
const blank = (): Row => ({ key: ++rowKey, name: "", qty: null, unit: null, note: "" });

export function Fridge({ inventory, onInventory, onEat }: { inventory: InventoryItem[]; onInventory: (items: InventoryItem[]) => void; onEat: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [drafts, setDrafts] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; tone: "warn" | "ok" | "info" } | null>(null);
  const [lastFiles, setLastFiles] = useState<File[]>([]);
  const [editing, setEditing] = useState<string | null>(null);

  async function read(files: File[]) {
    setLastFiles(files);
    setMsg(null);
    const found: Row[] = [];
    let failed = 0;
    let unreadable = 0;
    for (const [i, file] of files.entries()) {
      if (!(await requestAiConsent("pantry"))) {
        setMsg({ text: "Not sent. You can add foods by hand below.", tone: "info" });
        break;
      }
      setBusy(files.length > 1 ? `Reading photo ${i + 1} of ${files.length}…` : "Reading your photo…");
      try {
        const form = new FormData();
        form.append("image", await shrinkImage(file), "food.jpg");
        const res = await fetch("/api/read-pantry", { method: "POST", body: form, headers: AI_CONSENT_HEADERS });
        const data = (await res.json().catch(() => ({}))) as { items?: Draft[]; unreadable?: boolean; error?: string };
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Couldn't read that photo.");
        if (data.unreadable || !Array.isArray(data.items) || !data.items.length) unreadable++;
        for (const d of data.items ?? []) {
          const c = checkDraft({ name: d?.name ?? "", qty: d?.qty ?? null, unit: d?.unit ?? null, note: d?.note ?? "" });
          if (c.ok && !found.some((x) => x.name.toLowerCase() === c.value.name.toLowerCase())) found.push({ ...c.value, confidence: d.confidence, key: ++rowKey });
        }
      } catch (err) {
        failed++;
        setMsg({ text: err instanceof Error ? err.message : "Couldn't read that photo.", tone: "warn" });
      }
    }
    setBusy(null);
    if (found.length) {
      setDrafts((cur) => [...(cur ?? []).filter((r) => r.name.trim()), ...found]);
      setMsg({ text: `Found ${found.length} item${found.length === 1 ? "" : "s"}. Check names and amounts — photos can't show hidden food, freshness or exact weights. Nothing is saved until you confirm.`, tone: "info" });
    } else if (unreadable && !failed) {
      setMsg({ text: "Couldn't make out any food in that photo. Try a brighter, closer shot of one shelf — or add items by hand.", tone: "warn" });
      setDrafts((cur) => cur ?? [blank()]);
    } else if (failed) setDrafts((cur) => cur ?? [blank()]);
    else if (!found.length && files.length) {
      setMsg((cur) => cur ?? { text: "Nothing usable came back from that photo. Add items by hand, or try another photo.", tone: "warn" });
      setDrafts((cur) => cur ?? [blank()]);
    }
  }

  const setRow = (key: number, patch: Partial<Row>) => setDrafts((cur) => cur!.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function confirm() {
    const rows = (drafts ?? []).filter((r) => r.name.trim());
    for (const r of rows) {
      const c = checkDraft(r);
      if (!c.ok) return setMsg({ text: c.error, tone: "warn" });
    }
    if (!rows.length) return setMsg({ text: "Add at least one item, or cancel.", tone: "warn" });
    const next = confirmDrafts(inventory, rows, rows.some((r) => r.confidence) ? "scan" : "manual");
    saveInventory(next);
    onInventory(next);
    setDrafts(null);
    setMsg({ text: `Saved ${rows.length} item${rows.length === 1 ? "" : "s"} to your food.`, tone: "ok" });
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        aria-label="Fridge or pantry photos"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])].slice(0, 4);
          e.target.value = "";
          if (files.length) void read(files);
        }}
      />
      <section className={`${CARD} mt-4`}>
        <h2 className="font-semibold">What food do you have?</h2>
        <p className="mt-1 text-sm text-zinc-400">Photograph your fridge, freezer or a shelf (up to 4 photos). You&apos;ll check the list before anything is saved.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={!!busy} className={BTN} onClick={() => fileRef.current?.click()}>
            📷 Scan my fridge
          </button>
          <button type="button" disabled={!!busy} className={BTN2} onClick={() => setDrafts((cur) => [...(cur ?? []), blank()])}>
            + Add by hand
          </button>
        </div>
        {busy && (
          <p aria-live="polite" className="mt-3 flex items-center gap-2 text-sm text-zinc-300">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-lime-400" />
            {busy}
          </p>
        )}
      </section>

      {msg && (
        <div className="mt-3 grid grid-cols-1 gap-2">
          <Note tone={msg.tone} label="Scan status">
            {msg.text}
          </Note>
          {msg.tone === "warn" && lastFiles.length > 0 && !busy && (
            <button type="button" className={`${BTN2} justify-self-start`} onClick={() => void read(lastFiles)}>
              Try again
            </button>
          )}
        </div>
      )}

      {drafts && (
        <form
          aria-label="Check the food list"
          className={`${CARD} mt-4 grid grid-cols-1 gap-2`}
          onSubmit={(e) => {
            e.preventDefault();
            confirm();
          }}
        >
          <h2 className="font-semibold">Check the list</h2>
          <ul className="grid grid-cols-1 gap-2">
            {drafts.map((r, i) => (
              <li key={r.key} className="rounded-xl bg-zinc-950 p-2.5">
                <div className="flex items-center gap-2">
                  <input aria-label={`Item ${i + 1} name`} value={r.name} onChange={(e) => setRow(r.key, { name: e.target.value })} placeholder="e.g. eggs" className={`${INPUT} flex-1`} />
                  <button type="button" aria-label={`Remove item ${i + 1}`} onClick={() => setDrafts(drafts.filter((x) => x.key !== r.key))} className="h-11 w-11 shrink-0 rounded-lg bg-zinc-800 text-zinc-300">
                    ✕
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    aria-label={`Item ${i + 1} amount`}
                    inputMode="decimal"
                    value={r.qty ?? ""}
                    onChange={(e) => setRow(r.key, { qty: e.target.value.trim() === "" ? null : Number(e.target.value), unit: r.unit ?? "item" })}
                    placeholder="Amount (optional)"
                    className={`${INPUT} w-36`}
                  />
                  <select aria-label={`Item ${i + 1} unit`} value={r.unit ?? ""} onChange={(e) => setRow(r.key, { unit: (e.target.value || null) as Unit | null })} className={`${INPUT} flex-1`}>
                    <option value="">unit</option>
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                {(r.confidence === "low" || r.note) && (
                  <p className="mt-1.5 text-xs text-amber-200">
                    {r.confidence === "low" ? "Not sure about this one — check it. " : ""}
                    {r.note}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <button type="button" className={`${BTN2} justify-self-start`} onClick={() => setDrafts([...drafts, blank()])}>
            + Add item
          </button>
          <div className="mt-1 flex gap-2">
            <button type="submit" className={`${BTN} flex-1`}>
              Save to my food
            </button>
            <button type="button" className={BTN2} onClick={() => setDrafts(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <section aria-label="Your food" className="mt-5">
        <div className="flex items-center justify-between">
          <h2 className={LABEL}>Your food ({inventory.length})</h2>
          {inventory.length > 0 && (
            <button type="button" className="text-sm font-semibold text-lime-300" onClick={onEat}>
              What should I eat? →
            </button>
          )}
        </div>
        {!inventory.length ? (
          <p className="mt-2 text-sm text-zinc-500">Nothing saved yet. Scan or add what you have to get meal ideas from it.</p>
        ) : (
          <ul className="mt-2 grid grid-cols-1 gap-1.5">
            {inventory.map((item) => {
              const age = ageLabel(item);
              return (
                <li key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2">
                  {editing === item.id ? (
                    <ItemEditor
                      item={item}
                      onSave={(patch) => {
                        const next = editItem(inventory, item.id, patch);
                        saveInventory(next);
                        onInventory(next);
                        setEditing(null);
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{item.name}</p>
                        <p className={`text-xs ${age.stale ? "text-amber-300" : "text-zinc-500"}`}>
                          {fmtQty(item.qty, item.unit)} · {age.text}
                        </p>
                      </div>
                      <button type="button" aria-label={`Edit ${item.name}`} className="h-9 rounded-full px-3 text-xs font-semibold text-zinc-300" onClick={() => setEditing(item.id)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${item.name}`}
                        className="h-9 rounded-full px-3 text-xs font-semibold text-zinc-400"
                        onClick={() => {
                          const next = removeItem(inventory, item.id);
                          saveInventory(next);
                          onInventory(next);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function ItemEditor({ item, onSave, onCancel }: { item: InventoryItem; onSave: (p: Partial<InventoryItem>) => void; onCancel: () => void }) {
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(item.qty === null ? "" : String(item.qty));
  const [unit, setUnit] = useState<Unit | "">(item.unit ?? "");
  return (
    <form
      aria-label={`Edit ${item.name}`}
      className="grid grid-cols-1 gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const q = qty.trim() === "" ? null : Number(qty);
        onSave({ name, qty: q, unit: q === null ? null : unit || "item", addedAt: Date.now() });
      }}
    >
      <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
      <div className="flex gap-2">
        <input aria-label="Amount" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Amount" className={`${INPUT} w-28`} />
        <select aria-label="Unit" value={unit} onChange={(e) => setUnit(e.target.value as Unit | "")} className={`${INPUT} flex-1`}>
          <option value="">unit</option>
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" className={BTN}>
          Save
        </button>
        <button type="button" className={BTN2} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
