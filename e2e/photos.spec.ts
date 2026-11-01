// Visual evolution: photos stay on the phone (IndexedDB), compare, overlays, comparison image, delete.
import { test, expect, openWithExampleData, go, addPhotos } from "./support/test";

test("progress photos: store, compare, export and delete — nothing leaves the phone", async ({ page }) => {
  const leaving: string[] = [];
  page.on("request", (r) => (r.method() !== "GET" || !r.url().startsWith("http://localhost")) && !/^(blob|data):/.test(r.url()) && leaving.push(`${r.method()} ${r.url()}`));
  await openWithExampleData(page);
  await go(page, "Progress", "Visual evolution");
  const timeline = page.locator('section[aria-label="Photo timeline"]');
  await expect(timeline).toBeVisible();

  await page.fill("input[type=date]", "2026-10-01");
  await page.locator('[aria-label="Camera view"] button:has-text("Front")').click();
  await page.fill('input[placeholder="e.g. after leg day"]', "morning, fasted");
  await addPhotos(page, [["2026-10-01", "front-1.jpg"]]);
  // After a front photo, the next view is suggested.
  await expect(page.locator('[aria-label="Camera view"] button[aria-pressed=true]')).toHaveText(/Side/);
  await addPhotos(page, [["2026-10-01", "side-1.jpg"]]);
  await page.locator('[aria-label="Camera view"] button:has-text("Back")').click();
  await addPhotos(page, [["2026-10-01", "back-1.jpg"]]);
  await page.locator('[aria-label="Camera view"] button:has-text("Front")').click();
  await addPhotos(page, [["2026-10-22", "front-2.jpg"]]);

  const meta = await page.evaluate(() => JSON.parse(localStorage.getItem("ags:photos")!) as { view: string; note?: string }[]);
  expect(meta.map((m) => m.view).sort()).toEqual(["back", "front", "front", "side"]);
  expect(meta.some((m) => m.note === "morning, fasted")).toBe(true);
  const blobCount = () =>
    page.evaluate(() => new Promise<number>((res) => { const r = indexedDB.open("ags", 1); r.onsuccess = () => { const q = r.result.transaction("files").objectStore("files").count(); q.onsuccess = () => res(q.result); }; }));
  expect(await blobCount()).toBe(4);

  // Compare with measurement overlays.
  const cmp = page.locator('section[aria-label="Compare photos"]');
  await expect(cmp.locator("img")).toHaveCount(2);
  await cmp.locator('[aria-label="Compare view"] button:has-text("Side")').click();
  await expect(cmp.locator("p.border-dashed")).toBeVisible(); // only one side photo → explained, not broken
  await cmp.locator('[aria-label="Compare view"] button:has-text("Front")').click();
  await cmp.locator('summary:has-text("Show measurements")').click();
  await cmp.locator('label:has-text("Weight") input').check();
  await cmp.locator('label:has-text("Waist") input').check();
  await expect(cmp.locator('[aria-label="Before details"]')).toContainText("lb");
  await cmp.locator('input[aria-label="Before and after slider"]').fill("25");
  await cmp.locator('button:has-text("Side by side")').click();
  await cmp.locator('button:has-text("Hide all")').click();
  await expect(cmp.locator('[aria-label="Before details"] li')).toHaveCount(0);

  // Comparison image: blocked until the user confirms, and re-confirmation after a change.
  await cmp.locator('button:has-text("Create comparison image")').click();
  await page.waitForSelector('img[alt="Transformation Comparison preview"]');
  const save = page.locator('button:has-text("Save image")');
  await expect(save).toBeDisabled();
  await page.locator('input[aria-label="Confirm photos and numbers"]').check();
  await expect(save).toBeEnabled();
  const [dl] = await Promise.all([page.waitForEvent("download"), save.click()]);
  expect(dl.suggestedFilename()).toMatch(/\.png$/);
  await page.locator('label:has-text("Show the two photos") input').uncheck();
  await expect(save).toBeDisabled();
  await page.locator("[role=dialog] button[aria-label=Close]").click();

  // Delete one photo: record and stored file both go.
  await page.locator('button[aria-label="Open back photo from 2026-10-01"]').click();
  page.once("dialog", (d) => d.accept());
  await page.locator('[role=dialog] button:has-text("Delete")').click();
  await expect.poll(blobCount).toBe(3);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("ags:photos")!).some((m: { view: string }) => m.view === "back"))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  expect(leaving).toEqual([]);
});
