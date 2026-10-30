// Security Stage 1 — authentication fails closed. Run with `npm test`. Synthetic values only.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { authMode, authToken, AUTH_COOKIE } from "@/lib/passcode";
import { middleware } from "@/middleware";
import { POST as login } from "@/app/api/login/route";
import { buildCsp } from "@/lib/csp";

const ENV_KEYS = ["APP_PASSCODE", "NODE_ENV", "VERCEL", "VERCEL_ENV"] as const;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
function setEnv(env: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const k of ENV_KEYS) {
    if (env[k] === undefined) delete (process.env as Record<string, string | undefined>)[k];
    else (process.env as Record<string, string | undefined>)[k] = env[k];
  }
}
afterEach(() => setEnv(saved as Record<string, string>));

const req = (path: string, init: { cookie?: string; method?: string; body?: string } = {}) =>
  new NextRequest(`https://app.example${path}`, {
    method: init.method ?? "GET",
    headers: { ...(init.cookie ? { cookie: `${AUTH_COOKIE}=${init.cookie}` } : {}), "content-type": "application/json" },
    body: init.body,
  });

test("authMode: missing or blank passcode never grants access outside local `next dev`", () => {
  const cases: [Record<string, string | undefined>, string][] = [
    [{ NODE_ENV: "production" }, "misconfigured"], // next start / any prod build
    [{ NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "production" }, "misconfigured"], // Vercel Production
    [{ NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "preview" }, "misconfigured"], // Vercel Preview
    [{ NODE_ENV: "development", VERCEL: "1", VERCEL_ENV: "development" }, "misconfigured"], // `vercel dev`
    [{ NODE_ENV: "test" }, "misconfigured"],
    [{}, "misconfigured"], // NODE_ENV unset
    [{ NODE_ENV: "production", APP_PASSCODE: "   " }, "misconfigured"], // blank
    [{ NODE_ENV: "production", APP_PASSCODE: "" }, "misconfigured"],
    [{ NODE_ENV: "development" }, "open-dev"], // only local next dev
    [{ NODE_ENV: "production", APP_PASSCODE: "synthetic-passcode-123" }, "passcode"],
    [{ NODE_ENV: "development", APP_PASSCODE: "synthetic-passcode-123" }, "passcode"],
  ];
  for (const [env, expected] of cases) assert.equal(authMode(env), expected, JSON.stringify(env));
});

test("middleware: misconfigured production refuses every page and API with 503, no config details", async () => {
  setEnv({ NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "preview" });
  for (const path of ["/", "/login", "/api/login", "/api/plan", "/api/identify", "/api/read-scale", "/api/read-cardio", "/api/supp-label/1", "/achievements/emblem-gold.webp"]) {
    const res = await middleware(req(path, { cookie: await authToken("") })); // even the "empty passcode" cookie
    assert.equal(res.status, 503, path);
    const text = await res.text();
    assert.ok(!/APP_PASSCODE|GEMINI|VERCEL/.test(text), `no config names leaked on ${path}`);
  }
});

test("login route: misconfigured → 503 and never sets a cookie", async () => {
  setEnv({ NODE_ENV: "production" });
  const res = await login(new Request("https://app.example/api/login", { method: "POST", body: JSON.stringify({ passcode: "" }) }));
  assert.equal(res.status, 503);
  assert.equal(res.headers.get("set-cookie"), null);
});

test("middleware: with a passcode, APIs need the cookie; pages redirect to login; a valid cookie passes", async () => {
  setEnv({ NODE_ENV: "production", APP_PASSCODE: "synthetic-passcode-123" });
  assert.equal((await middleware(req("/api/plan", { method: "POST", body: "{}" }))).status, 401);
  assert.equal((await middleware(req("/api/read-scale", { cookie: "0".repeat(64), method: "POST", body: "{}" }))).status, 401);
  const page = await middleware(req("/"));
  assert.equal(page.status, 307);
  assert.match(page.headers.get("location") ?? "", /\/login$/);
  const ok = await middleware(req("/", { cookie: await authToken("synthetic-passcode-123") }));
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get("content-security-policy") ?? "", /script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  // A header that once bypassed Next.js middleware (CVE-2025-29927) changes nothing.
  const bypass = new NextRequest("https://app.example/api/plan", { method: "POST", headers: { "x-middleware-subrequest": "middleware:middleware:middleware:middleware:middleware" } });
  assert.equal((await middleware(bypass)).status, 401);
  // The login page itself stays reachable.
  assert.equal((await middleware(req("/login"))).status, 200);
});

test("login route: wrong passcode 401 without cookie; right passcode sets a hardened cookie", async () => {
  setEnv({ NODE_ENV: "production", APP_PASSCODE: "synthetic-passcode-123" });
  const bad = await login(new Request("https://app.example/api/login", { method: "POST", body: JSON.stringify({ passcode: "nope" }) }));
  assert.equal(bad.status, 401);
  assert.equal(bad.headers.get("set-cookie"), null);
  const good = await login(new Request("https://app.example/api/login", { method: "POST", body: JSON.stringify({ passcode: "synthetic-passcode-123" }) }));
  assert.equal(good.status, 200);
  const cookie = good.headers.get("set-cookie") ?? "";
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /SameSite=lax/i);
});

test("CSP: nonce-only scripts in production; dev extras only in dev", () => {
  const prod = buildCsp("abc", false);
  assert.match(prod, /script-src 'self' 'nonce-abc' 'strict-dynamic'(;|$)/);
  assert.ok(!/unsafe-eval|ws:/.test(prod));
  assert.match(prod, /frame-ancestors 'none'/);
  assert.match(prod, /frame-src https:\/\/www\.youtube-nocookie\.com/);
  assert.match(prod, /upgrade-insecure-requests/);
  assert.match(buildCsp("abc", true), /'unsafe-eval'/);
});
