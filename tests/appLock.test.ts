// Stage 2d — optional app lock. Synthetic PINs only. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { afterFailure, afterSuccess, hashPin, pinProblem, stillUnlocked, verifyPin, waitSeconds, type LockConfig } from "@/lib/appLock";

test("PIN rules: 6–12 digits, nothing trivially guessable", () => {
  for (const ok of ["482917", "50193827", "102938475610"]) assert.equal(pinProblem(ok), null, ok);
  for (const bad of ["12345", "1234567890123", "48a917", "111111", "123456", "654321", "000000"]) assert.notEqual(pinProblem(bad), null, bad);
});

test("PIN is stored only as a salted slow hash and verifies correctly", async () => {
  const stored = (await hashPin("482917", 1000))!;
  assert.ok(!JSON.stringify(stored).includes("482917"));
  assert.equal(await verifyPin("482917", stored), true);
  assert.equal(await verifyPin("482918", stored), false);
  assert.equal(await verifyPin("", stored), false);
  const again = (await hashPin("482917", 1000))!;
  assert.notEqual(again.hash, stored.hash); // different salt → different hash
});

const base: LockConfig = { enabled: true, pin: null, device: null, relock: "leave", failures: 0, blockedUntil: 0 };

test("wrong PINs: 4 free tries, then 30 s doubling up to 1 hour; success resets", () => {
  let c = base;
  const now = 1_000_000;
  for (let i = 0; i < 4; i++) c = afterFailure(c, now);
  assert.equal(waitSeconds(c, now), 0);
  c = afterFailure(c, now);
  assert.equal(waitSeconds(c, now), 30);
  c = afterFailure(c, now);
  assert.equal(waitSeconds(c, now), 60);
  for (let i = 0; i < 20; i++) c = afterFailure(c, now);
  assert.equal(waitSeconds(c, now), 3600);
  assert.equal(waitSeconds(c, now + 3600_000), 0);
  assert.deepEqual(afterSuccess(c), { ...c, failures: 0, blockedUntil: 0 });
});

test("relock: never unlocked → locked; idle 5 or 15 minutes → locked", () => {
  const t = 10_000_000;
  assert.equal(stillUnlocked("leave", null, t, t), false);
  assert.equal(stillUnlocked("leave", t, t, t + 4 * 60_000), true);
  assert.equal(stillUnlocked("leave", t, t, t + 5 * 60_000), false);
  assert.equal(stillUnlocked("5", t, t, t + 5 * 60_000), false);
  assert.equal(stillUnlocked("15", t, t, t + 14 * 60_000), true);
  assert.equal(stillUnlocked("15", t, t, t + 15 * 60_000), false);
  assert.equal(stillUnlocked("5", t, t + 4 * 60_000, t + 8 * 60_000), true); // activity keeps it open
});

test("the app lock is device-specific: never included in a backup", async () => {
  const store = new Map<string, string>([
    ["ags:workouts", "[]"],
    ["ags:lock", '{"enabled":true}'],
    ["ags:backup:last", "{}"],
  ]);
  (globalThis as { localStorage?: unknown }).localStorage = {
    get length() {
      return store.size;
    },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
  };
  const { currentRecords } = await import("@/lib/backupStore");
  assert.deepEqual(Object.keys(currentRecords()), ["ags:workouts"]);
  delete (globalThis as { localStorage?: unknown }).localStorage;
});
