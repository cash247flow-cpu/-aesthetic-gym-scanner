// Weekly review, coach observations, Weekly Wins card and navigation between screens.
// The example data is the week of Oct 18–24, 2026, so the browser clock is set to Oct 28, 2026.
import { test, expect, openWithExampleData, go, EXAMPLE_TODAY } from "./support/test";

test.beforeEach(async ({ context }) => {
  await context.clock.setFixedTime(EXAMPLE_TODAY);
});

test("weekly review: check-in, save, corrections, history and Weekly Wins", async ({ page }) => {
  const nonGet: string[] = [];
  page.on("request", (r) => r.method() !== "GET" && nonGet.push(`${r.method()} ${r.url()}`));
  await openWithExampleData(page);
  const section = (label: string) => page.locator(`section[aria-label="${label}"]`);

  const card = page.locator('button:has-text("Your weekly review is ready")');
  await expect(card).toBeVisible();
  await card.click();
  await page.waitForSelector("text=Weekly review");
  for (const s of ["This week's wins", "Body progress", "Strength progress", "Consistency", "Coach's observations"]) await expect(section(s)).toBeVisible();
  await expect(section("Body progress")).toContainText("lb");

  await page.locator('[aria-label=Energy] button:text-is("4")').click();
  await page.locator('button:has-text("Mark week as reviewed")').click();
  await expect(page.locator("text=/Reviewed/").first()).toBeVisible();
  await page.locator('button:has-text("Make this my focus")').click();
  await expect(page.locator("text=/Your focus:/")).toBeVisible();

  // A weigh-in corrected after the review → the saved review is kept and the change flagged.
  await page.evaluate(() => {
    const e = JSON.parse(localStorage.getItem("ags:body:entries")!);
    e.find((x: { id: string }) => x.id === "i").weightLb = 198.0;
    localStorage.setItem("ags:body:entries", JSON.stringify(e));
  });
  await go(page, "Progress", "Weekly evolution");
  await expect(page.locator('[role=status]:has-text("changed after you saved")')).toBeVisible();
  const saved = await section("Body progress").innerText();
  await page.locator('button:has-text("Show updated numbers")').click();
  await expect(section("Body progress")).not.toHaveText(saved);
  await page.locator('button:has-text("Save updated review")').first().click();
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("ags:reviews")!)["2026-10-18"].versions.length))
    .toBeGreaterThanOrEqual(2);

  await page.locator('button[aria-label="Previous week"]').click();
  await expect(section("Past reviews")).toContainText("Oct");
  await page.locator('button[aria-label="Next week"]').click();

  // Weekly Wins image: at most 4 items, saved in three formats.
  await page.locator('button:has-text("Share Weekly Wins")').click();
  await page.waitForSelector('img[alt="Weekly Wins preview"]');
  await page.locator('input[aria-label="Display name"]').fill("Synthetic Tester");
  await page.locator('label:has-text("Cardio minutes") input').uncheck();
  await page.locator('label:has-text("Waist") input').check();
  for (const f of ["Story", "Portrait", "Square"]) {
    await page.locator(`button[aria-pressed]:has-text("${f}")`).click();
    await page.waitForTimeout(800);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.locator('button:has-text("Save image")').click()]);
    expect(dl.suggestedFilename()).toMatch(/\.png$/);
  }
  await page.locator("[role=dialog] button[aria-label=Close]").click();
  expect(nonGet, "the review sends nothing to the server").toEqual([]);
});

test("coach notes, pain override and back navigation", async ({ page }) => {
  await openWithExampleData(page);
  // Flat weight for 4 weeks with good adherence → a possible plateau.
  await page.evaluate(() => {
    const e: unknown[] = [];
    for (const [d, w] of [["2026-09-28", 200], ["2026-09-30", 200.2], ["2026-10-05", 200.1], ["2026-10-07", 199.9], ["2026-10-12", 200], ["2026-10-14", 200.2], ["2026-10-19", 200.1], ["2026-10-22", 199.9]] as const) e.push({ id: d, date: d, weightLb: w, source: "manual" });
    localStorage.setItem("ags:body:entries", JSON.stringify(e));
  });
  await page.reload();
  await page.locator('button:has-text("Your weekly review is ready")').click();
  const coach = page.locator('section[aria-label="Coach\'s observations"]');
  await expect(coach).toContainText(/plateau/i);

  await page.locator('label:has-text("Pain or a possible injury") input').check();
  await expect(coach).toContainText(/pain|injur/i);
  await page.locator('label:has-text("Pain or a possible injury") input').uncheck();

  // The coach never changes targets by itself.
  await page.locator('button:has-text("Open my macro targets")').click();
  expect(await page.evaluate(() => localStorage.getItem("ags:meals:targets"))).toBeNull();
  await page.locator('button:has-text("Back")').first().click();
  await expect(page.locator("h1")).toContainText("Weekly review");

  // review → photos → body (log waist) → back ×3
  await page.locator('button:has-text("Add photos")').click();
  await expect(page.locator("h1")).toContainText("Visual evolution");
  await page.locator('button:has-text("Log weight or waist")').click();
  await page.locator('button:has-text("Type it in")').click();
  await page.locator('input[placeholder="0.0"]').fill("199.5");
  await page.locator('label:has-text("Waist (in)") input').fill("35.2");
  await page.locator('button:has-text("Save")').last().click();
  await expect(page.locator('li:has-text("waist 35.2 in")')).toHaveCount(1);
  await page.locator('button:text-is("Back")').last().click();
  await expect(page.locator("h1")).toContainText("Visual evolution");
  await page.locator('button:has-text("← Back")').click();
  await expect(page.locator("h1")).toContainText("Weekly review");

  await go(page, "More", "Sharing activity");
  await expect(page.locator("main")).toContainText(/on this phone|activity/i);
});
