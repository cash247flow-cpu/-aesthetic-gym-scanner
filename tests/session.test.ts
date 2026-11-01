// Stage 2c — signed, expiring sessions. Synthetic secret only. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ABSOLUTE_SECONDS, IDLE_SECONDS, newSession, secretUsable, signSession, verifySession } from "@/lib/session";

const SECRET = "synthetic-session-secret-0123456789abcdef";
const T0 = 1_800_000_000;
const DAY = 86400;

test("a fresh session verifies; 30-day idle and 90-day absolute limits", async () => {
  const s = newSession(T0);
  assert.equal(s.exp - s.iat, IDLE_SECONDS);
  assert.equal(s.max - s.iat, ABSOLUTE_SECONDS);
  const tok = await signSession(s, SECRET);
  const ok = await verifySession(tok, SECRET, T0 + 60);
  assert.ok(ok.ok && ok.renewed === null);
  assert.deepEqual(await verifySession(tok, SECRET, T0 + 30 * DAY), { ok: false, reason: "expired" }); // unused for 30 days
});

test("using the app renews the idle limit (at most daily), but never past 90 days", async () => {
  let s = newSession(T0);
  const v = await verifySession(await signSession(s, SECRET), SECRET, T0 + 2 * DAY);
  assert.ok(v.ok && v.renewed);
  assert.equal(v.ok && v.renewed!.exp, T0 + 2 * DAY + IDLE_SECONDS);
  // Keep using it every 20 days: still signed out at the 90-day mark.
  for (let t = T0 + 20 * DAY; t < T0 + 90 * DAY; t += 20 * DAY) {
    const r = await verifySession(await signSession(s, SECRET), SECRET, t);
    assert.ok(r.ok, `day ${(t - T0) / DAY}`);
    if (r.ok && r.renewed) s = r.renewed;
  }
  assert.deepEqual(await verifySession(await signSession(s, SECRET), SECRET, T0 + 90 * DAY), { ok: false, reason: "expired" });
});

test("forged or altered sessions are refused; a new secret ends every session", async () => {
  const tok = await signSession(newSession(T0), SECRET);
  assert.deepEqual(await verifySession(tok, "a-different-secret-0123456789abcdef", T0), { ok: false, reason: "bad_signature" });
  const [body, sig] = tok.split(".");
  const longer = { ...JSON.parse(Buffer.from(body, "base64url").toString()), max: T0 + 9999 * DAY, exp: T0 + 9999 * DAY };
  const forged = `${Buffer.from(JSON.stringify(longer)).toString("base64url")}.${sig}`;
  assert.deepEqual(await verifySession(forged, SECRET, T0), { ok: false, reason: "bad_signature" });
  for (const bad of [undefined, "", "abc", "a.b.c", `${body}.`, `${body}.!!!`, "x".repeat(2000)])
    assert.equal((await verifySession(bad, SECRET, T0)).ok, false, String(bad).slice(0, 20));
  assert.equal(new Set([newSession(T0).sid, newSession(T0).sid]).size, 2); // random ids
});

test("the token reveals nothing about the passcode and needs a strong secret", async () => {
  const tok = await signSession(newSession(T0), SECRET);
  const payload = JSON.parse(Buffer.from(tok.split(".")[0], "base64url").toString());
  assert.deepEqual(Object.keys(payload).sort(), ["exp", "iat", "max", "sid", "v"]);
  assert.equal(secretUsable("short"), false);
  assert.equal(secretUsable(" ".repeat(40)), false);
  assert.equal(secretUsable(SECRET), true);
});
