// Stage 2b — "Delete everything on this phone". Fake storage only. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { backupGate, canErase, eraseAll, type EraseDeps } from "@/lib/erase";
import { POST as logout } from "@/app/api/logout/route";

function fakeDeps(initial: Record<string, string>, opts: { db?: "deleted" | "blocked" | "error"; caches?: string[] } = {}) {
  const map = new Map(Object.entries(initial));
  const calls: string[] = [];
  const cacheNames = [...(opts.caches ?? [])];
  const deps: EraseDeps = {
    storage: {
      get length() {
        return map.size;
      },
      key: (i: number) => [...map.keys()][i] ?? null,
      removeItem: (k: string) => void map.delete(k),
    },
    deleteDatabase: async (name) => (calls.push(`db:${name}`), opts.db ?? "deleted"),
    cacheKeys: async () => [...cacheNames],
    deleteCache: async (name) => (calls.push(`cache:${name}`), true),
    signOut: async () => (calls.push("signout"), true),
  };
  return { deps, map, calls };
}

test("backup gate: recent only within 24 hours; missing or bad dates are not recent", () => {
  const now = Date.parse("2026-11-01T12:00:00Z");
  assert.deepEqual(backupGate("2026-11-01T02:00:00Z", now), { recent: true, hoursAgo: 10 });
  assert.equal(backupGate("2026-10-31T11:00:00Z", now).recent, false); // 25 h
  assert.deepEqual(backupGate(null, now), { recent: false, hoursAgo: null });
  assert.deepEqual(backupGate("not a date", now), { recent: false, hoursAgo: null });
});

test("confirmation: the exact word, plus the no-backup acknowledgement when there's no recent backup", () => {
  assert.equal(canErase("DELETE", true, false), true);
  assert.equal(canErase(" DELETE ", true, false), true);
  assert.equal(canErase("delete", true, false), false);
  assert.equal(canErase("DELET", true, false), false);
  assert.equal(canErase("DELETE", false, false), false);
  assert.equal(canErase("DELETE", false, true), true);
});

test("erase: every ags: record, the photo store and app caches go; nothing else is touched", async () => {
  const { deps, map, calls } = fakeDeps(
    { "ags:workouts": "[1]", "ags:photos": "[]", "ags:log:Incline Dumbbell Press": "{}", "ags:backup:last": "{}", "other-site-key": "keep" },
    { caches: ["ags-v2", "someone-else"] },
  );
  const r = await eraseAll(deps, { signOut: true });
  assert.deepEqual(r, { records: 4, database: "deleted", caches: 1, signedOut: true, remaining: 0 });
  assert.deepEqual([...map.keys()], ["other-site-key"]);
  assert.deepEqual(calls, ["db:ags", "cache:ags-v2", "signout"]); // files first, then records, caches, sign-out
});

test("erase: sign-out is optional, and a blocked photo store is reported (not hidden)", async () => {
  const { deps, calls } = fakeDeps({ "ags:unit": "lb" }, { db: "blocked" });
  const r = await eraseAll(deps, { signOut: false });
  assert.equal(r.signedOut, null);
  assert.equal(r.database, "blocked");
  assert.ok(!calls.includes("signout"));
});

test("logout route clears the passcode cookie", async () => {
  const res = await logout();
  assert.equal(res.status, 200);
  const c = res.headers.get("set-cookie") ?? "";
  assert.match(c, /^ags_auth=;/);
  assert.match(c, /Max-Age=0/i);
  assert.match(c, /HttpOnly/i);
});
