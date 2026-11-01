// Nutrition coach in the real app (synthetic data, AI replies mocked): fridge scan with consent,
// corrections and confirmation; allergy filtering; targets gate; confirmed logging with duplicate
// prevention and undo; grocery persistence and shopping mode; label check; in-app reminders with
// time zone, quiet hours and no notification-permission request; existing data left untouched.
import { test, expect, openApp, fixture } from "./support/test";
import type { Locator, Page } from "@playwright/test";

const shot = (page: Page, name: string) => page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true });
const tap = async (l: Locator) => {
  await l.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await l.click();
};
const coach = (page: Page) => page.locator('section[aria-label="Food coach"]');
// No sideways scrolling at phone width on any coach screen.
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

// Existing records that must survive the coach untouched.
const EXISTING = {
  "ags:workouts": JSON.stringify([{ id: "w1", date: "2026-10-01", session: "push", exercises: [] }]),
  "ags:body:entries": JSON.stringify([{ date: "2026-10-01", weightLb: 180 }]),
  "ags:meals": JSON.stringify({ "2026-10-01": { lunch: true } }),
  "ags:cronometer": JSON.stringify([{ date: "2026-10-01", kcal: 1500, protein: 150, carbs: 80, netCarbs: 60, fat: 55 }]),
};

async function fresh(page: Page, extra: Record<string, string> = {}) {
  await page.goto("/");
  await page.evaluate((seed) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  }, { ...EXISTING, ...extra });
  await openApp(page);
}

const PANTRY = {
  items: [
    // The shape /api/read-pantry returns after the server's normalizer (lib/nutrition/readings.ts).
    { name: "eggs", qty: 6, unit: "item", confidence: "high", note: "" },
    { name: "Greek yogurt", qty: null, unit: null, confidence: "medium", note: "" },
    { name: "spinach", qty: null, unit: null, confidence: "high", note: "" },
    { name: "bread", qty: null, unit: null, confidence: "low", note: "could be a tortilla" },
    { name: "mystery jar", qty: null, unit: null, confidence: "low", note: "label not readable" },
  ],
  unreadable: false,
};

test("fridge → confirm → suggestions → confirmed log (no duplicates, undo); allergies and targets respected; old data kept", async ({ page }) => {
  const sent: (string | undefined)[] = [];
  await page.route("**/api/read-pantry", (r) => {
    sent.push(r.request().headers()["x-ai-consent"]);
    return r.fulfill({ json: PANTRY });
  });
  await fresh(page);
  await tap(coach(page).locator('button:has-text("Scan My Fridge")'));
  await expect(page.locator("h1")).toContainText("Scan My");

  // Declining consent sends nothing.
  await page.getByLabel("Fridge or pantry photos").setInputFiles(fixture("front-1.jpg"));
  await expect(page.locator("[aria-labelledby=ai-consent-title]")).toContainText("fridge or pantry photo");
  await page.locator('button:has-text("Don\'t send")').click();
  await expect(page.getByLabel("Scan status")).toContainText("Not sent");
  expect(sent).toEqual([]);

  // Accepting: a draft list to check — nothing saved yet.
  await page.getByLabel("Fridge or pantry photos").setInputFiles(fixture("front-1.jpg"));
  await page.locator('button:has-text("Send to Gemini")').click();
  await expect(page.getByLabel("Scan status")).toContainText("Found 5 items");
  expect(sent).toEqual(["granted"]);
  const form = page.locator('form[aria-label="Check the food list"]');
  await expect(form).toContainText("could be a tortilla");
  expect(await page.evaluate(() => localStorage.getItem("ags:nutrition:inventory"))).toBeNull();
  await noOverflow(page);
  await shot(page, "coach-fridge-review");

  // Corrections: rename the uncertain item, give spinach an amount, drop the unreadable jar, add rice by hand.
  await form.getByLabel("Item 4 name").fill("white rice");
  await form.getByLabel("Item 4 amount").fill("500");
  await form.getByLabel("Item 4 unit").selectOption("g");
  await form.getByLabel("Item 3 amount").fill("200");
  await form.getByLabel("Item 3 unit").selectOption("g");
  await tap(form.getByLabel("Remove item 5"));
  await tap(form.locator('button:has-text("Save to my food")'));
  await expect(page.getByLabel("Scan status")).toContainText("Saved 4 items");
  const inv = JSON.parse((await page.evaluate(() => localStorage.getItem("ags:nutrition:inventory")))!);
  expect(inv.map((x: { name: string }) => x.name)).toEqual(["eggs", "Greek yogurt", "spinach", "white rice"]);

  // Matched items show their FDC reference; an ambiguous one asks which food it is (nothing assumed).
  const food = page.locator('section[aria-label="Your food"]');
  await expect(food).toContainText("Values: whole egg (raw, without shell) · weigh raw weight without shell · USDA FDC 171287");
  await expect(food).toContainText("Is it plain lowfat Greek yogurt?");
  await food.getByLabel("Which food is Greek yogurt?").selectOption("greek-yogurt-lowfat");
  await expect(food).toContainText("USDA FDC 170903");
  const chosen = JSON.parse((await page.evaluate(() => localStorage.getItem("ags:nutrition:inventory")))!);
  expect(chosen.find((x: { name: string }) => x.name === "Greek yogurt").refKey).toBe("greek-yogurt-lowfat");

  // What should I eat: targets must be confirmed first, then preferences.
  await tap(page.locator('nav[aria-label="Coach sections"] button:has-text("Eat")'));
  await expect(page.locator('section[aria-label="Confirm your targets"]')).toBeVisible();
  await shot(page, "coach-targets-gate");
  await tap(page.locator('button:has-text("Use these targets")'));
  const prefs = page.locator('form[aria-label="Food preferences"]');
  await prefs.locator('label:has-text("milk")').click();
  await tap(prefs.locator('button:has-text("Save preferences")'));

  await tap(page.locator('button:has-text("Suggest two meals")'));
  const first = page.locator("article").first();
  await expect(first).toContainText("Eggs");
  await expect(page.locator("main")).not.toContainText("Greek yogurt —"); // never offered
  await page.locator("details summary:has-text('Left out')").click();
  await expect(page.locator("main")).toContainText("Greek yogurt: contains or may contain milk");
  await expect(first).toContainText("Estimate");
  await first.locator("summary:has-text('Where the numbers come from')").click();
  await expect(first).toContainText("USDA FoodData Central 171287");
  await expect(first).toContainText("still estimates");
  await noOverflow(page);
  await shot(page, "coach-suggestions");

  // Logging needs explicit confirmation of what was eaten; the same suggestion can't be logged twice.
  expect(await page.evaluate(() => localStorage.getItem("ags:nutrition:log"))).toBeNull();
  await tap(first.locator('button:has-text("I ate this")'));
  const confirm = page.locator('form[aria-label="Confirm what you ate"]');
  await confirm.getByLabel("eggs grams eaten").fill("100");
  await tap(confirm.locator('button:has-text("Save to today\'s log")'));
  await expect(page.getByLabel("Log status")).toContainText("Logged");
  let log = JSON.parse((await page.evaluate(() => localStorage.getItem("ags:nutrition:log")))!);
  expect(log).toHaveLength(1);
  expect(log[0].foods.find((f: { name: string }) => f.name === "eggs").grams).toBe(100);
  await tap(first.locator('button:has-text("I ate this")'));
  await tap(page.locator('form[aria-label="Confirm what you ate"] button:has-text("Save to today\'s log")'));
  await expect(page.getByLabel("Log status")).toContainText("Already logged today");
  log = JSON.parse((await page.evaluate(() => localStorage.getItem("ags:nutrition:log")))!);
  expect(log).toHaveLength(1);
  await expect(page.locator('section[aria-label="Today so far"]')).toContainText("Eaten (confirmed)");
  await shot(page, "coach-logged");

  // Undo from the log list.
  await tap(page.locator('section[aria-label="Today\'s log"] button:has-text("Remove")'));
  expect(await page.evaluate(() => localStorage.getItem("ags:nutrition:log"))).toBeNull();

  // Existing records untouched.
  const after = await page.evaluate((keys) => Object.fromEntries(keys.map((k) => [k, localStorage.getItem(k)])), Object.keys(EXISTING));
  expect(after).toEqual(EXISTING);
});

test("unreadable or failed photos: clear message, retry, and manual entry", async ({ page }) => {
  let mode: "unreadable" | "fail" = "unreadable";
  await page.route("**/api/read-pantry", (r) =>
    mode === "unreadable" ? r.fulfill({ json: { items: [], unreadable: true } }) : r.fulfill({ status: 502, json: { error: "The AI reader is busy right now. Try again in a minute." } }),
  );
  await fresh(page);
  await tap(coach(page).locator('button:has-text("Scan My Fridge")'));
  await page.getByLabel("Fridge or pantry photos").setInputFiles(fixture("front-1.jpg"));
  await page.locator('button:has-text("Send to Gemini")').click();
  await expect(page.getByLabel("Scan status")).toContainText("Couldn't make out any food");
  await noOverflow(page);
  await expect(page.locator('form[aria-label="Check the food list"]')).toBeVisible(); // manual entry offered

  mode = "fail";
  await tap(page.locator('button:has-text("Try again")'));
  await page.locator('button:has-text("Send to Gemini")').click();
  await expect(page.getByLabel("Scan status")).toContainText("busy");
  await expect(page.locator('button:has-text("Try again")')).toBeVisible();

  const form = page.locator('form[aria-label="Check the food list"]');
  await form.getByLabel("Item 1 name").fill("canned tuna");
  await tap(form.locator('button:has-text("Save to my food")'));
  await expect(page.locator('section[aria-label="Your food"]')).toContainText("canned tuna");
  await expect(page.locator('section[aria-label="Your food"]')).toContainText("amount not set");
});

test("grocery list: missing ingredients, manual items, persistence, shopping mode, bought → food, label check", async ({ page }) => {
  await page.route("**/api/read-food-label", (r) =>
    r.fulfill({ json: { legible: true, productName: "Test Protein Bar", servingText: "1 bar (60 g)", servingGrams: 60, kcal: 220, protein: 20, carbs: 24, fiber: 8, fat: 7, allergenText: "Contains: milk, soy", addsUp: true } }),
  );
  await fresh(page, {
    "ags:nutrition:targets-ok": JSON.stringify({ current: 1 }),
    "ags:nutrition:prefs": JSON.stringify({ allergies: ["milk"], avoid: [], prepMin: 15, budget: true, savedAt: 1 }),
  });
  await tap(coach(page).locator('button:has-text("What Should I Eat?")'));
  await tap(page.locator('button:has-text("Suggest two meals")'));
  await expect(page.locator("main")).toContainText("You haven't saved any food yet");
  const meal = page.locator("article").first();
  await expect(meal).toContainText("need to buy");
  await tap(meal.locator('button:has-text("Add missing to grocery list")'));
  await expect(page.getByLabel("Log status")).toContainText("to your grocery list");

  await tap(page.locator('nav[aria-label="Coach sections"] button:has-text("Groceries")'));
  const list = page.locator('ul[aria-label="Grocery list"]');
  const fromMeal = await list.locator("li").count();
  expect(fromMeal).toBeGreaterThan(0);
  await page.getByLabel("Grocery item").fill("cheddar cheese");
  await page.getByLabel("Grocery amount").fill("1");
  await page.getByLabel("Grocery unit").selectOption("pack");
  await tap(page.locator('form[aria-label="Add to grocery list"] button:has-text("Add")'));
  await expect(list).toContainText("cheddar cheese");
  await expect(list).toContainText("May contain milk — on your allergy list.");
  await expect(page.locator("main")).toContainText("doesn't know store prices");

  // Persists across a reload.
  await page.reload();
  await tap(coach(page).locator('button:has-text("Grocery List")'));
  await expect(list).toContainText("cheddar cheese");

  // Shopping mode: tick off, then confirm what was bought before it becomes food at home.
  await tap(page.locator('button:has-text("I\'m grocery shopping")'));
  await tap(page.getByLabel("cheddar cheese in basket"));
  await noOverflow(page);
  await shot(page, "coach-shopping");
  expect(await page.evaluate(() => localStorage.getItem("ags:nutrition:inventory"))).toBeNull();
  await tap(page.locator('button:has-text("I bought the checked items")'));
  await tap(page.locator('button:has-text("Yes, add to my food")'));
  const inv = JSON.parse((await page.evaluate(() => localStorage.getItem("ags:nutrition:inventory")))!);
  expect(inv.map((x: { name: string; source: string }) => [x.name, x.source])).toEqual([["cheddar cheese", "grocery"]]);
  await expect(list).not.toContainText("cheddar cheese");

  // Label check: compares a serving with what's left, flags the allergen, never says "safe".
  await page.getByLabel("Nutrition label photo").setInputFiles(fixture("front-1.jpg"));
  await expect(page.locator("[aria-labelledby=ai-consent-title]")).toContainText("nutrition label photo");
  await page.locator('button:has-text("Send to Gemini")').click();
  const res = page.locator('[aria-label="Label result"]');
  await expect(res).toContainText("Test Protein Bar");
  await expect(res).toContainText("mentions milk");
  await expect(res).not.toContainText(/\bsafe\b/i);
  await shot(page, "coach-label");
});

test.describe("reminders (in-app only)", () => {
  test.use({ timezoneId: "America/New_York" });

  test("evening check-in shows after its time in the user's zone, respects quiet hours, can be dismissed; no permission prompt", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __perm: number }).__perm = 0;
      const N = function () {} as unknown as typeof Notification;
      (N as unknown as { requestPermission: () => Promise<string> }).requestPermission = async () => {
        (window as unknown as { __perm: number }).__perm++;
        return "denied";
      };
      Object.defineProperty(window, "Notification", { value: N, configurable: true });
    });
    // 21:00 in New York (01:00 UTC next day).
    await page.clock.setFixedTime(new Date("2026-11-03T02:00:00Z"));
    await fresh(page);
    await expect(page.locator('[aria-label="Reminder"]')).toHaveCount(0); // off by default

    await tap(coach(page).locator('button:has-text("I\'m Working Late")'));
    await tap(page.locator('nav[aria-label="Coach sections"] button:has-text("Settings")'));
    const form = page.locator('form[aria-label="Reminders"]');
    await expect(form).toContainText("can't notify you while it's closed");
    await form.locator('label:has-text("Evening check-in")').click();
    await form.getByLabel("Evening check-in time").fill("20:30");
    await tap(form.locator('button:has-text("Save reminders")'));
    const saved = JSON.parse((await page.evaluate(() => localStorage.getItem("ags:nutrition:reminders")))!);
    expect(saved.timeZone).toBe("America/New_York");
    await noOverflow(page);
  await shot(page, "coach-reminders");

    await page.goto("/");
    await expect(page.locator('[aria-label="Reminder"]')).toContainText("Evening check-in");
    await shot(page, "coach-home-reminder");
    await page.locator('[aria-label="Reminder"] button:has-text("Dismiss for today")').click();
    await page.reload();
    await page.waitForSelector("text=Build Your Ideal");
    await expect(page.locator('[aria-label="Reminder"]')).toHaveCount(0);

    // Next day at 23:00 New York time: inside default quiet hours (22:30–07:00) → hidden.
    await page.clock.setFixedTime(new Date("2026-11-04T04:00:00Z"));
    await page.reload();
    await page.waitForSelector("text=Build Your Ideal");
    await expect(page.locator('[aria-label="Reminder"]')).toHaveCount(0);

    expect(await page.evaluate(() => (window as unknown as { __perm: number }).__perm)).toBe(0);
  });
});

test("working late past the calorie target: no shame, no compensation, a concrete next step", async ({ page }) => {
  const today = new Date().toLocaleDateString("en-CA");
  await fresh(page, {
    "ags:nutrition:targets-ok": JSON.stringify({ current: 1 }),
    "ags:nutrition:prefs": JSON.stringify({ allergies: [], avoid: [], prepMin: 15, budget: false, savedAt: 1 }),
    "ags:nutrition:log": JSON.stringify([
      { id: "x", date: today, at: 1, title: "Late snack run", sourceKey: "manual:1", foods: [{ name: "pizza", grams: 600, totals: { kcal: 1700, protein: 70, carbs: 180, fat: 70, fiber: 8 }, source: "label" }], totals: { kcal: 1700, protein: 70, carbs: 180, fat: 70, fiber: 8 }, source: "label" },
    ]),
  });
  await tap(coach(page).locator('button:has-text("I\'m Working Late")'));
  await expect(page.locator("main")).toContainText("Working late? Let's choose something easy before hunger makes the decision harder.");
  await expect(page.locator("main")).toContainText("Tomorrow starts from your normal targets; there's nothing to make up.");
  await expect(page.locator("main")).not.toContainText(/burn it off|earn|cheat|bad food|skip breakfast|punish/i);
  await noOverflow(page);
  await shot(page, "coach-late");

  await tap(page.locator('button:has-text("Choose a stopping time")'));
  await tap(page.locator('form[aria-label="Stopping time"] button:has-text("Set it")'));
  await expect(page.locator('form[aria-label="Stopping time"]')).toContainText("Stopping at 23:00");

  await tap(page.locator('button:has-text("Choose a simple meal")'));
  await tap(page.locator('button:has-text("Suggest")'));
  await expect(page.locator("article").first()).toContainText("You're at or past today's calorie target");
  await expect(page.locator("article").first()).toContainText("No need to cut tomorrow's food");
});
