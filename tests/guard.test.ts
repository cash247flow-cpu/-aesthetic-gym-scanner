// Stage 2f — login rate limit, AI daily caps, per-device sign-out. In-memory store, synthetic data.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { memoryKV, setKVForTests, type KV } from "@/lib/kv";
import { LOGIN, checkSession, clientId, deviceLabel, listSessions, loginBlocked, recordLoginFailure, clearLoginFailures, registerSession, revokeSession, takeAiCall } from "@/lib/guard";
import { SESSION_COOKIE, newSession, nowSeconds, signSession } from "@/lib/session";
import { middleware } from "@/middleware";
import { POST as login } from "@/app/api/login/route";
import { GET as listRoute, POST as signOutRoute } from "@/app/api/sessions/route";

const SECRET = "synthetic-session-secret-0123456789abcdef";
const broken: KV = { pipeline: async () => Promise.reject(new Error("down")) };
afterEach(() => setKVForTests(undefined));

test("login limit: 5 failures per address per 15 min; other addresses unaffected; success clears", async () => {
  let t = 1_000_000;
  const kv = memoryKV(() => t);
  for (let i = 0; i < LOGIN.PER_IP; i++) await recordLoginFailure(kv, "a");
  const b = await loginBlocked(kv, "a");
  assert.ok(b.blocked && b.retryAfterS > 0 && b.retryAfterS <= LOGIN.WINDOW_S);
  assert.deepEqual(await loginBlocked(kv, "b"), { blocked: false });
  t += LOGIN.WINDOW_S * 1000;
  assert.deepEqual(await loginBlocked(kv, "a"), { blocked: false }); // window expired
  await recordLoginFailure(kv, "a");
  await clearLoginFailures(kv, "a");
  assert.deepEqual(await loginBlocked(kv, "a"), { blocked: false });
});

test("login limit: a global ceiling stops spreading guesses across many addresses", async () => {
  const kv = memoryKV();
  for (let i = 0; i < LOGIN.TOTAL; i++) await recordLoginFailure(kv, `addr${i}`);
  assert.equal((await loginBlocked(kv, "fresh")).blocked, true);
});

test("network addresses are stored only as keyed hashes", async () => {
  const h = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
  const id = await clientId(h, SECRET);
  assert.match(id, /^[0-9a-f]{24}$/);
  assert.notEqual(id, await clientId(h, "another-secret-0123456789abcdef0123"));
  const kv = memoryKV();
  await recordLoginFailure(kv, id);
  assert.ok(![...kv.dump().keys()].some((k) => k.includes("203.0.113.7")));
});

test("AI caps: per session and overall per UTC day; a new day starts fresh", async () => {
  const kv = memoryKV();
  const day1 = Date.parse("2026-11-01T10:00:00Z");
  const lim = { perSession: 3, total: 5 };
  for (let i = 0; i < 3; i++) assert.equal((await takeAiCall(kv, "s1", day1, lim)).ok, true);
  assert.deepEqual(await takeAiCall(kv, "s1", day1, lim), { ok: false, reason: "session" });
  assert.equal((await takeAiCall(kv, "s2", day1, lim)).ok, true); // 5th overall
  assert.deepEqual(await takeAiCall(kv, "s3", day1, lim), { ok: false, reason: "total" });
  assert.equal((await takeAiCall(kv, "s1", day1 + 86400_000, lim)).ok, true);
});

test("sessions: registered, adopted if unknown, revoked one by one, listed newest first", async () => {
  const kv = memoryKV();
  await registerSession(kv, "phone1", "Mozilla/5.0 (Linux; Android 15) AppleWebKit Chrome/140 Mobile Safari", 1000);
  assert.equal(await checkSession(kv, "phone1", null, false, 2000), "ok");
  assert.equal(await checkSession(kv, "laptop", "Mozilla/5.0 (Macintosh; Mac OS X) Safari/605", false, 3000), "ok"); // adopted
  const list = (await listSessions(kv))!;
  assert.deepEqual(list.map((d) => [d.sid, d.device]), [["laptop", "Mac · Safari"], ["phone1", "Android · Chrome"]]);
  await revokeSession(kv, "phone1");
  assert.equal(await checkSession(kv, "phone1", null, false, 4000), "revoked"); // never re-adopted
  assert.deepEqual((await listSessions(kv))!.map((d) => d.sid), ["laptop"]);
});

test("fail-open: with no store, or a store that's down, nothing is blocked or locked", async () => {
  for (const kv of [null, broken]) {
    assert.deepEqual(await loginBlocked(kv, "a"), { blocked: false });
    assert.deepEqual(await takeAiCall(kv, "s"), { ok: true });
    assert.equal(await checkSession(kv, "s", null, true), "ok");
    assert.equal(await listSessions(kv), null);
  }
  assert.equal(deviceLabel("Mozilla/5.0 (Linux; Android 15) SamsungBrowser/28 Chrome/130"), "Android · Samsung Internet");
});

const ENV = { NODE_ENV: "production", APP_PASSCODE: "synthetic-passcode-123", SESSION_SECRET: SECRET };
function withEnv<T>(run: () => Promise<T>) {
  const saved = Object.fromEntries(Object.keys(ENV).map((k) => [k, process.env[k]]));
  Object.assign(process.env, ENV);
  return run().finally(() => {
    for (const [k, v] of Object.entries(saved)) if (v === undefined) delete (process.env as Record<string, string | undefined>)[k];
    else (process.env as Record<string, string | undefined>)[k] = v;
  });
}
const loginReq = (passcode: string) =>
  new Request("https://app.example/api/login", { method: "POST", body: JSON.stringify({ passcode }), headers: { "x-forwarded-for": "198.51.100.9", "user-agent": "Android Chrome/140" } });

test("login route: the 6th attempt is refused (429) even with the right passcode", () =>
  withEnv(async () => {
    setKVForTests(memoryKV());
    for (let i = 0; i < LOGIN.PER_IP; i++) assert.equal((await login(loginReq("wrong"))).status, 401);
    const r = await login(loginReq("synthetic-passcode-123"));
    assert.equal(r.status, 429);
    assert.ok(Number(r.headers.get("retry-after")) > 0);
    assert.equal(r.headers.get("set-cookie"), null);
  }));

test("per-device sign-out: the signed-out phone is refused on its next request; others keep working", () =>
  withEnv(async () => {
    const kv = memoryKV();
    setKVForTests(kv);
    const phone = newSession(nowSeconds());
    const laptop = newSession(nowSeconds());
    const cookie = async (s: typeof phone) => `${SESSION_COOKIE}=${await signSession(s, SECRET)}`;
    const get = async (s: typeof phone, path = "/") => middleware(new NextRequest(`https://app.example${path}`, { headers: { cookie: await cookie(s), "user-agent": "Android Chrome/140" } }));
    assert.equal((await get(phone)).status, 200); // adopted
    assert.equal((await get(laptop)).status, 200);
    const listed = await (await listRoute(new NextRequest("https://app.example/api/sessions", { headers: { cookie: await cookie(laptop) } }))).json();
    assert.equal(listed.devices.length, 2);
    assert.equal(listed.devices.filter((d: { current: boolean }) => d.current).length, 1);
    const out = await signOutRoute(new NextRequest("https://app.example/api/sessions", { method: "POST", body: JSON.stringify({ id: phone.sid }), headers: { cookie: await cookie(laptop) } }));
    assert.equal(out.status, 200);
    const refused = await get(phone);
    assert.equal(refused.status, 307);
    assert.match(refused.headers.get("location") ?? "", /\/login\?revoked=1$/);
    assert.equal((await get(phone, "/api/plan")).status, 401);
    assert.equal((await get(laptop)).status, 200);
    // "Sign out all other devices"
    const tablet = newSession(nowSeconds());
    await get(tablet);
    await signOutRoute(new NextRequest("https://app.example/api/sessions", { method: "POST", body: JSON.stringify({ others: true }), headers: { cookie: await cookie(laptop) } }));
    assert.equal((await get(tablet)).status, 307);
    assert.equal((await get(laptop)).status, 200);
  }));

test("Upstash REST client: pipeline protocol, bearer auth, and a hung server times out (fail-open)", async () => {
  const http = await import("node:http");
  const backing = memoryKV();
  let seenAuth = "";
  let hang = false;
  const server = http.createServer((req, res) => {
    seenAuth = req.headers.authorization ?? "";
    if (hang) return; // never answers
    if (req.url !== "/pipeline" || req.method !== "POST") return void res.writeHead(404).end();
    if (seenAuth !== "Bearer test-token") return void res.writeHead(401).end(JSON.stringify({ error: "Unauthorized" }));
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      const out = await backing.pipeline(JSON.parse(body));
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(out.map((result) => ({ result: result instanceof Set ? [...result] : result }))));
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;
  const { upstash } = await import("@/lib/kv");
  try {
    const kv = upstash(`http://127.0.0.1:${port}/`, "test-token");
    for (let i = 0; i < LOGIN.PER_IP; i++) await recordLoginFailure(kv, "z");
    assert.equal((await loginBlocked(kv, "z")).blocked, true);
    assert.equal(seenAuth, "Bearer test-token");
    const wrong = upstash(`http://127.0.0.1:${port}`, "nope");
    assert.deepEqual(await loginBlocked(wrong, "z"), { blocked: false }); // 401 from store → fail open
    hang = true;
    const t0 = Date.now();
    assert.deepEqual(await loginBlocked(kv, "z"), { blocked: false });
    assert.ok(Date.now() - t0 < 3000, "gave up quickly");
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});
