// Optional app lock: PIN rules, locked screens, throttling, relock, phone screen lock (emulated
// authenticator) and removing the lock with the app passcode.
import { test, expect, openWithExampleData, openApp, go } from "./support/test";
import { E2E } from "./support/env";

test("app lock protects Body tracker, Visual evolution and Data on this phone", async ({ page, context }) => {
  page.on("dialog", (d) => d.accept());
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  const locked = page.locator("section[aria-label=Locked]");
  const lockCfg = () => page.evaluate(() => JSON.parse(localStorage.getItem("ags:lock") || "null"));
  const pinBox = page.locator('input[aria-label="App PIN"]');
  const submit = locked.locator("button[type=submit]");

  await openWithExampleData(page);
  await go(page, "More", "Data on this phone");
  await expect(locked).toHaveCount(0);
  const L = page.locator('section[aria-label="App lock"]');
  await L.getByLabel("New app PIN").fill("123456");
  await expect(L.locator("p.text-amber-300").first()).toContainText(/easy to guess/i);
  await L.getByLabel("New app PIN").fill("482917");
  await L.getByLabel("Repeat app PIN").fill("482917");
  await L.locator('button:has-text("Save PIN")').click();
  await expect(L.locator("[role=status]")).toBeVisible();
  const cfg = await lockCfg();
  expect(JSON.stringify(cfg)).not.toContain("482917");
  expect(Object.keys(cfg.pin).sort()).toEqual(["hash", "iterations", "salt"]);

  await L.locator('button:has-text("Lock now")').click();
  await expect(locked).toBeVisible();
  for (const row of ["Body tracker", "Visual evolution"]) {
    await go(page, "Progress", row);
    await expect(locked).toBeVisible();
  }

  // 5 wrong PINs → a wait that survives a reload.
  await go(page, "Progress", "Body tracker");
  for (let i = 0; i < 5; i++) {
    await pinBox.fill("111222");
    await submit.click();
    await page.waitForTimeout(500);
  }
  await expect(locked.locator("[role=alert]")).toBeVisible();
  await expect(submit).toBeDisabled();
  await page.reload();
  await page.waitForSelector("text=Build Your Ideal");
  await go(page, "Progress", "Body tracker");
  await expect(submit).toBeDisabled();

  await page.evaluate(() => { const c = JSON.parse(localStorage.getItem("ags:lock")!); c.blockedUntil = 0; localStorage.setItem("ags:lock", JSON.stringify(c)); }); // test only: skip the wait
  await openApp(page);
  await go(page, "Progress", "Body tracker");
  await pinBox.fill("482917");
  await submit.click();
  await expect(locked).toHaveCount(0);
  expect((await lockCfg()).failures).toBe(0);
  await go(page, "Progress", "Visual evolution");
  await expect(locked).toHaveCount(0);

  // Leaving the app locks it again.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });
  await expect(locked).toBeVisible();
  await pinBox.fill("482917");
  await submit.click();
  await expect(locked).toHaveCount(0);

  // Phone screen lock via a passkey with user verification.
  await go(page, "More", "Data on this phone");
  await L.locator('button:has-text("Use this phone")').click();
  await page.waitForSelector("text=/screen lock can now unlock/", { timeout: 15_000 });
  await L.locator('button:has-text("Lock now")').click();
  await page.locator('button:has-text("Unlock with this phone")').click();
  await expect(locked).toHaveCount(0);
  await L.locator('button:has-text("Lock now")').click();
  await cdp.send("WebAuthn.setUserVerified", { authenticatorId, isUserVerified: false });
  await page.locator('button:has-text("Unlock with this phone")').click();
  await page.waitForTimeout(1500);
  await expect(locked).toBeVisible();

  // A reload always starts locked; the app passcode removes the lock and keeps the data.
  await page.reload();
  await page.waitForSelector("text=Build Your Ideal");
  await go(page, "More", "Data on this phone");
  await expect(locked).toBeVisible();
  await page.locator('button:has-text("Forgot the PIN")').click();
  await page.getByLabel("App passcode").fill("synthetic-not-the-passcode");
  await page.locator('button:has-text("Remove app lock")').click();
  await expect(locked.locator("[role=alert]")).toBeVisible();
  expect(await lockCfg()).not.toBeNull();
  await page.getByLabel("App passcode").fill(E2E.passcode);
  await page.locator('button:has-text("Remove app lock")').click();
  await expect.poll(lockCfg).toBeNull();
  await expect(locked).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("ags:body:entries")!).length)).toBe(10);
});
