// Notes on missed days — run with `npm test`. Synthetic, in-memory data only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { NOTE_MAX, cleanNote, loadMissedNotes, setMissedNote } from "@/lib/missed";

function fakeStorage(seed: Record<string, string> = {}) {
  const m = new Map(Object.entries(seed));
  (globalThis as { localStorage?: unknown }).localStorage = {
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
  return { m, done: () => delete (globalThis as { localStorage?: unknown }).localStorage };
}

test("a missed day keeps one note; editing replaces it and empty text removes it", () => {
  const s = fakeStorage();
  try {
    setMissedNote("2026-11-17", "Sore after going too heavy");
    assert.deepEqual(loadMissedNotes(), { "2026-11-17": "Sore after going too heavy" });
    setMissedNote("2026-11-17", "  Sore legs  ");
    assert.equal(loadMissedNotes()["2026-11-17"], "Sore legs");
    setMissedNote("2026-11-19", "Work trip");
    setMissedNote("2026-11-17", "   ");
    assert.deepEqual(loadMissedNotes(), { "2026-11-19": "Work trip" });
    assert.ok(s.m.has("ags:missed:notes"), "stored under an ags: key, so backup and Delete everything cover it");
  } finally {
    s.done();
  }
});

test("notes are cleaned: control characters and line breaks flattened, length capped, bad dates ignored", () => {
  assert.equal(cleanNote("sore\nlegs\t\u0007today"), "sore legs today");
  assert.equal(cleanNote("x".repeat(500)).length, NOTE_MAX);
  const s = fakeStorage({ "ags:missed:notes": JSON.stringify({ "2026-11-17": "ok", "not-a-date": "x", "2026-11-18": 42, "2026-11-19": "" }) });
  try {
    assert.deepEqual(loadMissedNotes(), { "2026-11-17": "ok" });
    setMissedNote("tuesday", "ignored");
    assert.deepEqual(loadMissedNotes(), { "2026-11-17": "ok" });
  } finally {
    s.done();
  }
  const broken = fakeStorage({ "ags:missed:notes": "{not json" });
  try {
    assert.deepEqual(loadMissedNotes(), {});
  } finally {
    broken.done();
  }
});
