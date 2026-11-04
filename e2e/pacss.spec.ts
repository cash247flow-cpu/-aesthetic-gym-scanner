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

test("pain holds workout targets until the user explicitly resumes them (not medical clearance)", async ({ page, context }) => {
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
  await expect(page.locator("text=/Workout targets stop adding weight or reps until you choose to resume them/")).toBeVisible();
  await expect(page.locator('[aria-label="Limits of this data"]')).toContainText("No imported food log this week — nutrition wasn't assessed.");
  await shot(page, "review-pain-limits");

  await openApp(page); // not saved as reviewed — the tick alone is enough
  await page.locator('button[aria-label^="Push:"]').dispatchEvent("click");
  await expect(page.locator("text=/Holding at last time's numbers/").first()).toBeVisible();
  await expect(page.locator("text=/Add weight:/")).toHaveCount(0);
  await shot(page, "workout-held");

  // Unticking the box doesn't resume anything.
  await openApp(page);
  await page.locator('button:has-text("Your weekly review is ready")').click();
  await page.locator('label:has-text("Pain or a possible injury") input').uncheck();
  await expect(page.locator('[aria-label="Progression hold"]')).toBeVisible();

  // Only the explicit confirmation does — and it says it isn't medical clearance.
  await openApp(page);
  await page.locator('button[aria-label^="Push:"]').dispatchEvent("click");
  const hold = page.locator('[aria-label="Progression hold"]').first();
  await hold.locator('button:has-text("Resume progression suggestions")').click();
  await expect(hold.locator('[aria-label="Confirm resuming progression"]')).toContainText("isn't medical clearance");
  await shot(page, "resume-confirm");
  await hold.locator('button:has-text("Keep holding")').click();
  await expect(page.locator("text=/Holding at last time's numbers/").first()).toBeVisible();
  await hold.locator('button:has-text("Resume progression suggestions")').click();
  await hold.locator('button:text-is("Resume suggestions")').click();
  await openApp(page);
  await page.locator('button[aria-label^="Push:"]').dispatchEvent("click");
  await expect(page.locator("text=/Add weight:/").first()).toBeVisible();
  await expect(page.locator("text=/Holding at last time's numbers/")).toHaveCount(0);
});

test("old set logs with no recorded unit are asked about, never reinterpreted; the answer can be undone", async ({ page }) => {
  await page.goto("/");
  const legacy = JSON.stringify({ date: "2026-10-01", sets: [{ weight: "60", reps: "10", done: true }], prevSets: [] });
  await page.evaluate((v) => {
    localStorage.clear();
    localStorage.setItem("ags:log:Incline Dumbbell Press", v);
  }, legacy);
  await openApp(page);
  await page.locator('button[aria-label^="Push:"]').dispatchEvent("click");
  const slide = page.locator("[aria-roledescription=slide]").first();
  const q = slide.locator('[aria-label="Unit of earlier sets"]');
  await expect(q).toContainText("can't tell whether they were lb or kg");
  await expect(slide.locator('button[aria-label^="Previous: 60 (unit unknown)"]')).toBeVisible();
  await expect(slide.locator("text=/Progressive overload/")).toHaveCount(0); // no targets from an unknown unit
  await shot(page, "legacy-unit-question");

  // Switching the toggle doesn't reinterpret the unknown numbers.
  await page.locator('[aria-label="Weight unit"] button:text-is("kg")').click();
  await expect(slide.locator('button[aria-label^="Previous: 60 (unit unknown)"]')).toBeVisible();
  await page.locator('[aria-label="Weight unit"] button:text-is("lb")').click();
  expect(await page.evaluate(() => localStorage.getItem("ags:log:Incline Dumbbell Press"))).toBe(legacy);

  // The user answers: shown converted into the selected unit, with targets; originals kept.
  await q.locator('button:has-text("They were kg")').click();
  await expect(slide.locator('button[aria-label^="Use previous: 132.3 lb for 10 reps"]')).toBeVisible();
  await expect(slide.locator("text=/Progressive overload/")).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("ags:log:Incline Dumbbell Press")!));
  expect(saved.unitAnswer).toMatchObject({ unit: "kg", original: { prevSets: [{ weight: "60", reps: "10", done: true }] } });

  // Undo puts the numbers back exactly and asks again.
  await slide.locator('button:text-is("Undo")').click();
  await expect(slide.locator('button[aria-label^="Previous: 60 (unit unknown)"]')).toBeVisible();
  await expect(q).toBeVisible();
  const undone = await page.evaluate(() => JSON.parse(localStorage.getItem("ags:log:Incline Dumbbell Press")!));
  expect(undone.prevSets).toEqual([{ weight: "60", reps: "10", done: true }]);
  expect(undone.prevUnit).toBeUndefined();
  expect(undone.unitAnswer).toBeUndefined();
});

test("body tracker: an unusual value is questioned first, then kept as typed but left out of trends", async ({ page }) => {
  await openWithExampleData(page);
  await go(page, "Progress", "Body tracker");
  const count = () => page.evaluate(() => JSON.parse(localStorage.getItem("ags:body:entries")!).length);
  const before = await count();
  await page.locator('button:has-text("Type it in")').click();
  await page.locator('input[placeholder="0.0"]').fill("1850");
  await page.locator('button:has-text("Save")').last().click();
  await expect(page.getByRole("alert").filter({ hasText: "Weight looks unusual" })).toBeVisible();
  expect(await count()).toBe(before);
  await shot(page, "body-typo");
  // Saving again keeps it exactly as typed, labelled; the latest weight shown ignores it.
  await page.locator('button:has-text("Save")').last().click();
  await expect.poll(count).toBe(before + 1);
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem("ags:body:entries")!).find((e: { weightLb: number }) => e.weightLb === 1850));
  expect(kept.outOfRange).toEqual(["weightLb"]);
  await expect(page.locator("text=/unusual value, kept as typed/")).toBeVisible();
  await expect(page.locator("text=/Latest 1,?850/")).toHaveCount(0);
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
  const who = page.locator('[aria-label="Who can see this data"]');
  for (const s of ["one shared passcode", "sees only that phone's data", "sign any device out", "not encryption"]) await expect(who).toContainText(s);

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

test("Habit #4 shows as Sunset Reset; existing ticks and streak carry over", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    const d = (n: number) => { const x = new Date(); x.setDate(x.getDate() - n); return x.toLocaleDateString("en-CA"); };
    // History saved under the habit's unchanged id, before the rename.
    localStorage.setItem("ags:habits", JSON.stringify({ [d(3)]: { cortisol: true }, [d(2)]: { cortisol: true }, [d(1)]: { cortisol: true } }));
  });
  await openApp(page);
  await page.locator("nav[aria-label=Main] >> text=More").dispatchEvent("click");
  await expect(page.locator('button:has-text("Daily habits")')).toContainText("Sunset Reset");
  await expect(page.locator("main")).not.toContainText(/cortisol/i);
  await page.locator('button:has-text("Daily habits")').first().click();
  const card = page.locator("li, section, div").filter({ has: page.locator("text=Sunset Reset") }).filter({ hasText: "Walked after dinner" }).last();
  await expect(card).toContainText("Take a 10–15 minute walk outside after dinner. If conditions are safe and comfortable, finish with a brief barefoot pause on the grass.");
  await expect(card).toContainText("3"); // the streak from saved history
  await expect(page.locator("main")).not.toContainText(/cortisol/i);
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("sunset-reset.png"), fullPage: true });
  // Ticking the walk alone completes it today.
  await card.locator('button:has-text("Walked after dinner")').click();
  const today = await page.evaluate(() => JSON.parse(localStorage.getItem("ags:habits")!)[new Date().toLocaleDateString("en-CA")]);
  expect(today).toEqual({ cortisol: true });
});

test("Reverse Crunch (with Ab Mat) can be swapped, and swapped back", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await openApp(page);
  await page.locator('button[aria-label^="Abs:"]').dispatchEvent("click");
  await page.waitForSelector("text=Back to home");
  const swap = page.locator('button[aria-label="Swap Reverse Crunch (with Ab Mat)"]');
  await swap.scrollIntoViewIfNeeded();
  await swap.click();
  for (const n of ["Hanging Knee Raise", "Captain's Chair Knee Raise", "Decline Reverse Crunch", "Dragon Flag"]) await expect(page.locator(`button:has-text("${n}")`)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("reverse-crunch-swap.png"), fullPage: true });
  await page.locator('button:has-text("Hanging Knee Raise")').first().click();
  await expect(page.locator('button[aria-label="Swap Hanging Knee Raise"]')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("ags:swaps"))).toContain("Hanging Knee Raise");
  // Swap back to the programmed exercise.
  await page.locator('button[aria-label="Swap Hanging Knee Raise"]').click();
  await page.locator('button:has-text("Reverse Crunch (with Ab Mat)")').last().click();
  await expect(page.locator('button[aria-label="Swap Reverse Crunch (with Ab Mat)"]')).toBeVisible();
});

test("meals: edit, save, undo, reset — and name a meal with nutrition from a Cronometer recipe CSV", async ({ page }) => {
  // Bring a control to mid-screen before tapping, clear of the fixed tab bar.
  const tap = async (l: import("@playwright/test").Locator) => {
    await l.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await l.click();
  };
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("ags:meals", JSON.stringify({ [new Date().toLocaleDateString("en-CA")]: { lunch: true } }));
  });
  await openApp(page);
  await page.locator("nav[aria-label=Main] >> text=Meals").dispatchEvent("click");
  const lunch = page.locator('li[aria-label="Lunch — best time for psyllium"]');
  await tap(lunch.locator('button:has-text("Edit")'));
  const form = lunch.locator('form[aria-label="Edit Lunch — best time for psyllium"]');
  await form.getByLabel("Meal name").fill("Chicken Rice Bowl");
  await form.getByLabel("Food 1", { exact: true }).fill("200 g chicken breast");
  await tap(form.locator('button:has-text("+ Add food")'));
  const n = await form.locator("ol > li").count();
  await form.getByLabel(`Food ${n}`, { exact: true }).fill("1 lime");
  await form.getByLabel(`Food ${n} type`).selectOption("C");
  await tap(form.getByLabel(`Move food ${n} up`));
  await page.screenshot({ path: test.info().outputPath("meal-editor.png"), fullPage: true });
  await tap(form.locator('button:has-text("Save meal")'));
  await expect(lunch).toContainText("Chicken Rice Bowl");
  await expect(lunch).toContainText("200 g chicken breast");
  await expect(lunch).toContainText("your version");
  await expect(lunch.locator('button:has-text("✓ Eaten")')).toBeVisible(); // today's tick untouched

  // Persisted, and shared with Phase 2 (dinner is not).
  await page.reload();
  await page.locator("nav[aria-label=Main] >> text=Meals").dispatchEvent("click");
  await expect(lunch).toContainText("Chicken Rice Bowl");
  await page.locator('button:has-text("Phase 2")').click();
  await expect(lunch).toContainText("Chicken Rice Bowl");
  await page.locator('button:has-text("Current")').first().click();

  // Undo goes back to the plan's lunch.
  await tap(lunch.locator('button:has-text("Undo")'));
  await expect(lunch).toContainText("Salmon Rice Bowl");
  await expect(lunch).not.toContainText("your version");

  // Name and nutrition for dinner from a Cronometer recipe export (made-up values, real layout).
  const csv = [
    "Food ID,Food Name,Comments,Amount,Energy (kcal),Alcohol (g),Net Carbs (g),Carbs (g),Fiber (g),Fat (g),Protein (g)",
    '1,"Test Tilapia Bowl","","serving  — 900.0g",560.40,0.00,28.20,46.10,17.90,16.60,64.30',
  ].join("\n");
  const dinner = page.locator('li[aria-label="Dinner"]');
  await tap(dinner.locator('button:has-text("Edit")'));
  const dform = dinner.locator("form");
  const before = await dform.locator("ol > li").count();
  await dform.getByLabel("Cronometer recipe file").setInputFiles({ name: "food.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(dform.locator('[aria-label="Cronometer nutrition"] [role=status]')).toContainText("Test Tilapia Bowl");
  await expect(dform.getByLabel("Meal name")).toHaveValue("Test Tilapia Bowl");
  await expect(dform.locator('[aria-label="Cronometer nutrition"]')).toContainText("1 serving (900 g): ≈560 kcal · 64.3 g protein · 28.2 g net carbs · 16.6 g fat · 17.9 g fiber");
  expect(await dform.locator("ol > li").count()).toBe(before); // food list untouched
  await page.screenshot({ path: test.info().outputPath("meal-cronometer.png"), fullPage: true });
  expect(await page.evaluate(() => localStorage.getItem("ags:meals:custom"))).toBeNull(); // nothing saved yet
  await tap(dform.locator('button:has-text("Save meal")'));
  await expect(dinner).toContainText("Test Tilapia Bowl");
  await expect(dinner).toContainText("Cronometer · 1 serving (900 g): ≈560 kcal");

  // Reset to the plan's default.
  await tap(dinner.locator('button:has-text("Edit")'));
  await tap(dinner.locator('button:has-text("Reset to the plan")'));
  await expect(dinner).toContainText("Fish Avocado Rice Bowl");
  await expect(dinner).not.toContainText("Cronometer ·");
});

test("meals: ingredients read from a screenshot only after consent, as a draft to check before Save", async ({ page }) => {
  const tap = async (l: import("@playwright/test").Locator) => {
    await l.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await l.click();
  };
  const sent: (string | undefined)[] = [];
  await page.route("**/api/read-ingredients", (r) => {
    sent.push(r.request().headers()["x-ai-consent"]);
    // Made-up reply, including junk the client must drop.
    return r.fulfill({ json: { foods: [{ kind: "P", text: "150 g test chicken" }, { kind: "C", text: "1 cup test rice" }, { kind: "X", text: "bad kind" }, { kind: "F", text: "" }] } });
  });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await openApp(page);
  await page.locator("nav[aria-label=Main] >> text=Meals").dispatchEvent("click");
  const dinner = page.locator('li[aria-label="Dinner"]');
  await tap(dinner.locator('button:has-text("Edit")'));
  const form = dinner.locator("form");
  const before = await form.locator("ol > li").count();
  const shot = { name: "list.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") };

  // Declining sends nothing and leaves the list alone.
  await form.getByLabel("Ingredient screenshot").setInputFiles(shot);
  await expect(page.locator("[aria-labelledby=ai-consent-title]")).toBeVisible();
  await expect(page.locator("[aria-labelledby=ai-consent-title]")).toContainText("ingredient");
  await page.locator('button:has-text("Don\'t send")').click();
  await expect(form.getByLabel("Screenshot reading")).toContainText("Not sent");
  expect(sent).toEqual([]);
  expect(await form.locator("ol > li").count()).toBe(before);

  // Allowing sends it with the consent header; valid rows replace the list as a draft.
  await form.getByLabel("Ingredient screenshot").setInputFiles(shot);
  await page.locator('button:has-text("Send to Gemini")').click();
  await expect(form.getByLabel("Screenshot reading")).toContainText("Read 2 ingredients");
  expect(sent).toEqual(["granted"]);
  await expect(form.locator("ol > li")).toHaveCount(2);
  await expect(form.getByLabel("Food 1", { exact: true })).toHaveValue("150 g test chicken");
  await expect(form.getByLabel("Food 2 type")).toHaveValue("C");
  expect(await page.evaluate(() => localStorage.getItem("ags:meals:custom"))).toBeNull(); // nothing saved yet
  await page.screenshot({ path: test.info().outputPath("meal-screenshot.png"), fullPage: true });

  // Cancel keeps the plan's dinner; reading again and saving keeps the new list.
  await tap(form.locator('button:has-text("Cancel")'));
  await expect(dinner).not.toContainText("test chicken");
  await tap(dinner.locator('button:has-text("Edit")'));
  await form.getByLabel("Ingredient screenshot").setInputFiles(shot);
  await page.locator('button:has-text("Send to Gemini")').click();
  await expect(form.getByLabel("Screenshot reading")).toContainText("Read 2 ingredients");
  await tap(form.locator('button:has-text("Save meal")'));
  await expect(dinner).toContainText("150 g test chicken");
  await expect(dinner).toContainText("your version");
});

test("home shows the persistence quote", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await openApp(page);
  await page.screenshot({ path: test.info().outputPath("home-quote.png") });
  await expect(page.locator('blockquote[aria-label="Quote"]')).toHaveText(
    "“A river cuts through rock, not because of its power, but because of its persistence.”",
  );
});

test("The Abs session ends with the Cable Oblique Crunch", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await openApp(page);
  await page.locator('button[aria-label^="Abs:"]').dispatchEvent("click");
  await page.waitForSelector("text=Back to home");
  const oc = page.locator("text=Cable Oblique Crunch").first();
  await oc.scrollIntoViewIfNeeded();
  await expect(oc).toBeVisible();
  await expect(page.locator("text=Abs · Obliques").first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("oblique-crunch.png"), fullPage: true });
});

test("Machine Chest Press can be swapped for the Reverse-Seated Machine Dip, and the card stays on screen", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await openApp(page);
  await page.locator('button[aria-label^="Push:"]').dispatchEvent("click");
  await page.waitForSelector("text=Back to home");
  // The way a person does it: tap the exercise's number, then Swap on its card.
  await page.locator('button[aria-label="Machine Chest Press"]').click();
  await expect(page.locator('button[aria-label="Swap Machine Chest Press"]')).toBeInViewport();
  await page.locator('button[aria-label="Swap Machine Chest Press"]').click();
  await page.locator('button:has-text("Reverse-Seated Machine Dip")').first().click();
  // Regression: a swap used to collapse the exercise area to nothing.
  await expect(page.locator('button[aria-label="Swap Reverse-Seated Machine Dip"]')).toBeInViewport();
  await expect(page.locator("text=Sit backwards on the seat").first()).toBeVisible();
  await expect(page.locator("text=Lower chest fills out").first()).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("ags:swaps"))).toContain("Reverse-Seated Machine Dip");
  await page.screenshot({ path: test.info().outputPath("seated-dip.png") });
});

test("two StairMaster sessions on one day: the second starts fresh and neither overwrites the other", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await openApp(page);
  // 1) Push day's own StairMaster (40 min, the plan default), marked done inside the lifting workout.
  await page.locator('button[aria-label^="Push:"]').dispatchEvent("click");
  await page.waitForSelector("text=Back to home");
  await page.locator('button[aria-label="Cardio: StairMaster"]').click();
  const liftCardio = page.locator('[aria-roledescription="slide"]').filter({ hasText: "Cardio · after lifting" });
  await liftCardio.locator('button:has-text("Mark done")').click();
  await expect(liftCardio.locator("text=Cardio done")).toBeVisible();
  await page.locator('button:has-text("Back to home")').click();
  // 2) A separate cardio session the same day (e.g. a make-up): it must not open as already done.
  await page.locator('button:text-is("Cardio")').dispatchEvent("click");
  await page.waitForSelector("text=Back to sessions");
  await expect(page.locator("text=Cardio done")).toHaveCount(0);
  await expect(page.getByRole("timer").locator("text=Ready")).toBeVisible();
  await page.locator('button[aria-pressed]:text-is("20")').click();
  await page.locator('button:has-text("Mark done")').click();
  await expect(page.locator("text=Cardio done")).toBeVisible();
  await page.waitForTimeout(1200); // the session records itself shortly after finishing
  const history = await page.evaluate(() => JSON.parse(localStorage.getItem("ags:history") ?? "[]") as { session: string; cardioMin: number }[]);
  expect(history.map((h) => [h.session, h.cardioMin]).sort()).toEqual([["Cardio Day", 20], ["Push Day", 40]]);
});

test("Reverse Pec Deck can be swapped for the Single-Arm Cable Rear Delt Raise", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await openApp(page);
  await page.locator('button[aria-label^="Pull:"]').dispatchEvent("click");
  await page.waitForSelector("text=Back to home");
  await page.locator('button[aria-label="Reverse Pec Deck"]').click();
  await page.locator('button[aria-label="Swap Reverse Pec Deck"]').click();
  for (const n of ["Reverse Cable Crossover", "Single-Arm Cable Rear Delt Raise"]) await expect(page.locator(`button:has-text("${n}")`).first()).toBeVisible();
  await page.locator('button:has-text("Single-Arm Cable Rear Delt Raise")').first().click();
  await expect(page.locator('button[aria-label="Swap Single-Arm Cable Rear Delt Raise"]')).toBeInViewport();
  await expect(page.locator("text=don't squeeze your shoulder blades together").first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("rear-delt-swap.png") });
});
