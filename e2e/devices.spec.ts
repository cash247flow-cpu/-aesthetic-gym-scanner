// Signed-in devices (fake Upstash): list, sign out one device, sign out all other devices.
import { test, expect, signInWithPasscode, seedExampleData, watchPage, watchCsp } from "./support/test";
import type { Browser, Locator, Page } from "@playwright/test";

test.use({ signedIn: false });

const PHONE_UA = "Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0 Mobile Safari/537.36";
const LAPTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

async function device(browser: Browser, userAgent: string, problems: string[]) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, userAgent, baseURL: test.info().project.use.baseURL });
  await watchCsp(ctx);
  const p = await ctx.newPage();
  watchPage(p, problems);
  p.on("dialog", (d) => d.accept());
  return p;
}

/**
 * Tap like a person would: bring the control to the middle of the screen first. Playwright's own
 * scrolling can leave it at the bottom edge, under the fixed tab bar (seen on CI's fonts).
 */
async function tap(l: Locator) {
  await l.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await l.click();
}

async function openDevices(p: Page) {
  await p.locator("nav[aria-label=Main] >> text=More").dispatchEvent("click");
  await p.locator('button:has-text("Data on this phone")').click();
  await p.waitForSelector('[aria-label="Signed-in devices"] li', { timeout: 15_000 });
}

test("sign out a lost device, then all other devices", async ({ browser, problems }) => {
  const phone = await device(browser, PHONE_UA, problems);
  const laptop = await device(browser, LAPTOP_UA, problems);
  await phone.goto("/");
  await signInWithPasscode(phone);
  await phone.evaluate(seedExampleData);
  await laptop.goto("/");
  await signInWithPasscode(laptop);

  await openDevices(laptop);
  const list = laptop.locator('[aria-label="Signed-in devices"]');
  await expect(list.locator("li")).toHaveCount(2);
  await expect(list).toContainText("Android · Samsung Internet");
  await expect(list.locator('li:has-text("THIS PHONE")')).toContainText("Mac · Safari");

  await tap(list.locator("li", { hasText: "Android" }).locator('button:has-text("Sign out")'));
  await expect(list.locator("[role=status]")).toContainText("Signed out 1 device");
  await expect(list.locator("li")).toHaveCount(1);

  // The phone is refused on its very next request; its data stays.
  await phone.reload();
  await expect(phone).toHaveURL(/\/login\?revoked=1/);
  await expect(phone.locator("[role=status]")).toContainText("signed out from another device");
  expect(await phone.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("ags:")).length)).toBeGreaterThan(5);

  await signInWithPasscode(phone);
  await openDevices(phone);
  await tap(phone.locator('button:has-text("Lost a phone")'));
  await expect(phone.locator('section[aria-label="This phone"] ol li').first()).toContainText("Sign out");
  await tap(phone.locator('button:has-text("Sign out all other devices")'));
  await expect(phone.locator('[aria-label="Signed-in devices"] [role=status]')).toBeVisible();

  await laptop.reload();
  await expect(laptop).toHaveURL(/\/login\?revoked=1/);
  await phone.reload();
  await expect(phone).toHaveURL((u) => u.pathname === "/");
  expect(problems).toEqual([]);
  await phone.context().close();
  await laptop.context().close();
});
