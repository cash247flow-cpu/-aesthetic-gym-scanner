// Sign-in, signed sessions, security headers and the login rate limit.
import { test, expect, mintSession, sessionCookie, signInWithPasscode, openWithExampleData, go, storeKeys } from "./support/test";
import { E2E } from "./support/env";

test.describe("not signed in", () => {
  test.use({ signedIn: false });

  test("pages and APIs need a sign-in", async ({ page, request }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    const api = await request.get("/api/session", { maxRedirects: 0 });
    expect([401, 307]).toContain(api.status());
  });

  test("security headers and a per-request CSP nonce", async ({ request }) => {
    const a = await request.get("/login");
    const b = await request.get("/login");
    const csp = a.headers()["content-security-policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(csp).not.toContain("'unsafe-eval'");
    const nonce = (h: string) => h.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce(csp)).not.toEqual(nonce(b.headers()["content-security-policy"]));
    expect(a.headers()["x-frame-options"] ?? csp).toBeTruthy();
    expect(a.headers()["x-content-type-options"]).toBe("nosniff");
    expect(a.headers()["x-powered-by"]).toBeUndefined();
  });

  test("wrong passcode is refused; right one signs in with a locked-down cookie", async ({ page, context }) => {
    await page.goto("/");
    await page.fill('input[aria-label="App passcode"]', "synthetic-wrong-passcode");
    await page.locator("button[type=submit]").click();
    await expect(page.locator("[role=alert]")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    await signInWithPasscode(page);
    const c = (await context.cookies()).find((x) => x.name === "__Host-ags_session")!;
    expect(c).toBeTruthy();
    expect(c.httpOnly).toBe(true);
    expect(c.secure).toBe(true);
    expect(c.sameSite).toBe("Lax");
    expect(Math.round((c.expires - Date.now() / 1000) / 86400)).toBe(30);
    expect(await page.evaluate(() => document.cookie.includes("ags_session"))).toBe(false);
  });

  test("forged, wrong-key, legacy and expired cookies are refused", async ({ page, context }) => {
    // Signed with a different secret (e.g. after SESSION_SECRET was rotated).
    await context.addCookies([sessionCookie(mintSession({ secret: "synthetic-some-other-secret-0123456789abcdef" }))]);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);

    // Edited payload.
    const [body, sig] = mintSession().split(".");
    const edited = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), max: 9_999_999_999 })).toString("base64url");
    await context.clearCookies();
    await context.addCookies([sessionCookie(`${edited}.${sig}`)]);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);

    // The retired year-long cookie is refused and deleted.
    await context.clearCookies();
    await context.addCookies([{ name: "ags_auth", value: "a".repeat(64), domain: "localhost", path: "/" }]);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    expect((await context.cookies()).some((c) => c.name === "ags_auth")).toBe(false);

    // 40 days without use, and 95 days since signing in.
    for (const s of [mintSession({ ageDays: 40, idleDays: 40 }), mintSession({ ageDays: 95, idleDays: 1 })]) {
      await context.clearCookies();
      await context.addCookies([sessionCookie(s)]);
      await page.goto("/");
      await expect(page).toHaveURL(/\/login\?expired=1/);
    }
    await expect(page.locator("[role=status]")).toContainText(/signed out|expired|30 days/i);
  });
});

test("sign out of this phone keeps the data", async ({ page, context }) => {
  await openWithExampleData(page);
  const keys = () => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("ags:")).length);
  const before = await keys();
  await go(page, "More", "Data on this phone");
  const card = page.locator('section[aria-label="This phone"]');
  await expect(card).toContainText("Signed in");
  await card.locator('button:has-text("Lost a phone")').click();
  await expect(card.locator("ol li")).toHaveCount(4);

  page.on("dialog", (d) => d.accept());
  await card.locator('button:has-text("Sign out of this phone")').click();
  await page.waitForURL(/\/login\?signedout=1/);
  await expect(page.locator("[role=status]")).toContainText("Your data is still on this phone");
  expect((await context.cookies()).some((c) => c.name === "__Host-ags_session")).toBe(false);
  expect(await keys()).toBe(before);

  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await signInWithPasscode(page);
  expect(await keys()).toBeGreaterThanOrEqual(before);
});

test.describe("login rate limit (fake Upstash)", () => {
  test.use({ signedIn: false });

  test("5 wrong passcodes, then even the right one waits; addresses stored only as hashes", async ({ request }) => {
    const ip = { "x-real-ip": "203.0.113.7" }; // documentation-range address, test only
    for (let i = 0; i < 5; i++) {
      const r = await request.post("/api/login", { data: { passcode: "synthetic-wrong" }, headers: ip });
      expect(r.status()).toBe(401);
    }
    const blocked = await request.post("/api/login", { data: { passcode: E2E.passcode }, headers: ip });
    expect(blocked.status()).toBe(429);
    expect(Number(blocked.headers()["retry-after"])).toBeGreaterThan(0);

    // Another address is unaffected.
    const other = await request.post("/api/login", { data: { passcode: E2E.passcode }, headers: { "x-real-ip": "203.0.113.8" } });
    expect(other.status()).toBe(200);

    const keys = await storeKeys();
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.join(" ")).not.toContain("203.0.113");
  });
});
