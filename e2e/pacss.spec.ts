// PACSS behaviour in the real app (synthetic data): units, flagged sets, pain hold, body-entry
// ranges, recovery days, undoable target changes, the data statement and certificate provenance.
import { test, expect, openApp, openWithExampleData, go, EXAMPLE_TODAY } from "./support/test";
import { SESSIONS } from "../lib/programs";

const shot = async (page: import("@playwright/test").Page, name: string) =>
  page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true });

test("set logger: switching lb→kg converts what's typed; a set with no reps is flagged", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await openApp(page);
  await page.locator('button[aria-label^="Push:"]').dispatchEvent("click");
  await page.waitForSelector("text=Back to home");
  const slide = page.locator("[aria-roledescription=slide]").first();
  await slide.getByLabel("Set 1 weight in lb").fill("100");
  await slide.getByLabel("Set 1 reps").fill("10");
  await page.locator('[aria-label="Weight unit"] button:text-is("kg")').click();
  await expect(slide.getByLabel("Set 1 weight in kg")).toHaveValue("45.4");
  await slide.getByLabel("Set 2 weight in kg").fill("50");
  await slide.locator('button[aria-label="Mark set 2 done"]').click();
  await expect(slide.locator("[role=note]")).toContainText("No reps logged");
  const log = await page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith("ags:log:"))!;
    return JSON.parse(localStorage.getItem(k)!);
  });
  expect(log.unit).toBe("kg");
  await shot(page, "setlogger-kg");
});

test("pain reported in the weekly check-in holds workout targets at last time's numbers", async ({ page, context }) => {
  await context.clock.setFixedTime(EXAMPLE_TODAY);
  await openWithExampleData(page);
  // Last Push session: every set at 30 reps, so the normal rule would add weight.
  const names = SESSIONS.push.exercises.flatMap((e) => [e.name, ...(e.substitutes ?? []).map((s) => s.name)]);
  await page.evaluate((list) => {
    const sets = [1, 2, 3].map(() => ({ weight: "60", reps: "30", done: true }));
    for (const n of list) localStorage.setItem(`ags:log:${n}`, JSON.stringify({ date: "2026-10-22", unit: "lb", sets, prevSets: [] }));
    localStorage.removeItem("ags:cronometer"); // no food log → the coach must say nutrition wasn't assessed
  }, names);
  await openApp(page);
  await page.locator('button[aria-label^="Push:"]').dispatchEvent("click");
  await expect(page.locator("text=/Add weight:/").first()).toBeVisible();

  await openApp(page);
  await page.locator('button:has-text("Your weekly review is ready")').click();
  await page.locator('label:has-text("Pain or a possible injury") input').check();
  await expect(page.locator("text=/workout targets stop adding weight or reps/")).toBeVisible();
  await expect(page.locator('[aria-label="Limits of this data"]')).toContainText("No imported food log this week — nutrition wasn't assessed.");
  await shot(page, "review-pain-limits");

  await openApp(page); // not saved as reviewed — the tick alone is enough
  await page.locator('button[aria-label^="Push:"]').dispatchEvent("click");
  await expect(page.locator("text=/Holding at last time's numbers/").first()).toBeVisible();
  await expect(page.locator("text=/Add weight:/")).toHaveCount(0);
  await shot(page, "workout-held");
});

test("body tracker refuses an out-of-range typo and keeps existing entries", async ({ page }) => {
  await openWithExampleData(page);
  await go(page, "Progress", "Body tracker");
  const count = () => page.evaluate(() => JSON.parse(localStorage.getItem("ags:body:entries")!).length);
  const before = await count();
  await page.locator('button:has-text("Type it in")').click();
  await page.locator('input[placeholder="0.0"]').fill("1850");
  await page.locator('button:has-text("Save")').last().click();
  await expect(page.getByRole("alert").filter({ hasText: "Weight looks out of range" })).toBeVisible();
  expect(await count()).toBe(before);
  await shot(page, "body-typo");
  await page.locator('input[placeholder="0.0"]').fill("185");
  await page.locator('button:has-text("Save")').last().click();
  await expect.poll(count).toBe(before + 1);
});

test("a recovery day pauses the habit streak instead of breaking it", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    const full = { morning: true, pfc: 3, squat: 3, cortisol: true, sleep: [true, true, true] };
    const d = (n: number) => { const x = new Date(); x.setDate(x.getDate() - n); return x.toLocaleDateString("en-CA"); };
    localStorage.setItem("ags:habits", JSON.stringify({ [d(3)]: full, [d(2)]: full, [d(1)]: {} }));
  });
  await openApp(page);
  await go(page, "More", "Daily habits");
  await expect(page.locator("text=/day perfect streak/")).toHaveCount(0); // yesterday broke it
  await page.locator('button[aria-label*="revious"]').first().click(); // go to yesterday
  await page.locator('label:has-text("Recovery day") input').check();
  await expect(page.locator("text=/2-day perfect streak/")).toBeVisible();
  await shot(page, "habits-recovery");
});

test("macro target changes are logged and can be undone", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await openApp(page);
  await page.locator("nav[aria-label=Main] >> text=Meals").dispatchEvent("click");
  await page.locator('button:has-text("Edit my targets")').click();
  await page.getByLabel("Protein grams").fill("170");
  await page.locator('button:has-text("Save targets")').click();
  const last = page.locator('[aria-label="Last target change"]');
  await expect(last).toContainText("changed by you");
  await expect(last).toContainText("was 155 P");
  await shot(page, "meals-change");
  await last.locator('button:has-text("Undo")').click();
  await expect(page.locator("[role=status]")).toContainText("previous targets are back");
  expect(await page.evaluate(() => localStorage.getItem("ags:meals:targets"))).toBeNull();
  const log = await page.evaluate(() => JSON.parse(localStorage.getItem("ags:plan:changes")!));
  expect(log).toHaveLength(1);
  expect(log[0]).toMatchObject({ before: { protein: 155 }, after: { protein: 170 }, origin: "you" });
  expect(log[0].undoneAt).toBeGreaterThan(0);
});

test("data statement lists every destination; certificates say they're self-recorded", async ({ page }) => {
  await openWithExampleData(page);
  await go(page, "More", "Data on this phone");
  const where = page.locator("text=Where your data lives").locator("..");
  for (const s of ["Google Gemini", "NIH label database", "YouTube", "hashed", "Vercel"]) await expect(where).toContainText(s);

  await go(page, "Progress", "Your wins");
  await page.locator('button:has-text("View certificate")').first().click();
  await page.waitForTimeout(1500);
  await shot(page, "certificate");
  // The provenance line must fit in every size without crowding anything out.
  for (const f of ["Story", "Portrait", "Square"]) {
    await page.locator(`button[aria-pressed]:has-text("${f}")`).click();
    await page.waitForTimeout(1200);
    await expect(page.locator("text=Some content is tight")).toHaveCount(0);
  }
});
