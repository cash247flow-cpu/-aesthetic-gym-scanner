// AI consent before any photo leaves the phone, the exercise video embed under the CSP, and the
// daily AI caps on the server. The AI routes are mocked in the browser tests, so no photo is sent.
import { test, expect, openWithExampleData, openApp, go, fixture, mintSession } from "./support/test";
import fs from "node:fs";

test("photos are only sent after consent, with the consent header", async ({ page }) => {
  const ai: { url: string; consent?: string }[] = [];
  page.on("request", (r) => /\/api\/(read-|identify)/.test(r.url()) && ai.push({ url: new URL(r.url()).pathname, consent: r.headers()["x-ai-consent"] }));
  await page.route("**/api/read-scale", (r) => r.fulfill({ json: { kind: "scale", date: null, weightLb: 188.2, bodyFatPct: null, muscleLb: null, bmi: null, visceralFat: null, bmr: null } }));
  await page.route("**/api/identify", (r) => r.fulfill({ json: { equipment: ["dumbbells", "bench"] } }));
  await openWithExampleData(page);

  await go(page, "Progress", "Body tracker");
  const pickScale = async () => {
    const [fc] = await Promise.all([page.waitForEvent("filechooser"), page.locator('button:has-text("Scale photo")').click()]);
    await fc.setFiles(fixture("front-1.jpg"));
  };
  await pickScale();
  await expect(page.locator("[aria-labelledby=ai-consent-title]")).toBeVisible();
  await page.locator('button:has-text("Don\'t send")').click();
  await expect(page.locator("text=/Not sent to the AI reader/")).toBeVisible();
  expect(ai).toEqual([]);
  await page.locator('button:has-text("Cancel")').first().click().catch(() => {});

  await pickScale();
  await page.locator('button:has-text("Send to Gemini")').click();
  await expect(page.locator('input[placeholder="0.0"]')).toHaveValue("188.2");
  expect(ai).toEqual([{ url: "/api/read-scale", consent: "granted" }]);

  // Gym scan mode: declining sends nothing and explains why.
  await page.evaluate(() => localStorage.setItem("ags:scanmode", "on"));
  await openApp(page);
  await page.setInputFiles("#photo", fixture("front-1.jpg"));
  await page.locator('button[aria-label^="Push:"]').dispatchEvent("click");
  await expect(page.locator("[aria-labelledby=ai-consent-title]")).toBeVisible();
  await page.locator('button:has-text("Don\'t send")').click();
  await expect(page.getByText("Photo not sent")).toBeVisible();
  expect(ai).toHaveLength(1);
});

test("exercise demo video embeds from youtube-nocookie without CSP errors", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await openApp(page);
  await page.locator('button[aria-label^="Push:"]').dispatchEvent("click");
  await page.waitForSelector("text=Back to home");
  const slides = page.locator("[aria-roledescription=slide]");
  const n = await slides.count();
  let src: string | null = null;
  for (let i = 0; i < n && !src; i++) {
    await page.locator("nav[aria-label=Exercises] ol button").nth(i).click();
    await page.waitForTimeout(300);
    const how = slides.nth(i).locator('button:has-text("How to")').first();
    if (!(await how.count())) continue;
    await how.click();
    const watch = page.locator('[role=dialog] button:has-text("Watch demo video")');
    if (await watch.count()) {
      await watch.click();
      src = await page.locator("[role=dialog] iframe").getAttribute("src");
    } else await page.locator("[role=dialog] button[aria-label=Close]").click();
  }
  expect(src).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\//);
});

test.describe("server-side AI rules", () => {
  test.use({ signedIn: false });

  test("consent header required; per-device daily cap enforced before any AI call", async ({ request }) => {
    const cookie = `__Host-ags_session=${mintSession()}`;
    const jpg = fs.readFileSync(fixture("front-1.jpg"));
    const send = (consent: boolean) =>
      request.post("/api/read-scale", {
        multipart: { image: { name: "scale.jpg", mimeType: "image/jpeg", buffer: jpg } },
        headers: consent ? { cookie, "x-ai-consent": "granted" } : { cookie },
      });

    expect((await send(false)).status()).toBe(428);
    // The test server has no Gemini key: allowed calls stop at 503 "not set up"; the 3rd is over
    // the cap (2 per device in this run) and refused with 429 before the key is even looked at.
    expect((await send(true)).status()).toBe(503);
    expect((await send(true)).status()).toBe(503);
    const third = await send(true);
    expect(third.status()).toBe(429);
    expect((await third.json()).error).toContain("limit");
  });
});
