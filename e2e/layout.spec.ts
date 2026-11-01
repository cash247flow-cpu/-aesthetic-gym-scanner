// Nothing sticks out sideways on small phones: every main screen at 4 widths, including each
// workout with the rest timer bar showing.
import { test, expect, openApp } from "./support/test";
import type { Page } from "@playwright/test";

async function overflow(p: Page) {
  await p.waitForTimeout(300);
  return p.evaluate(() => {
    const W = document.documentElement.clientWidth;
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      // Horizontal scrollers (carousels, chip rows) scroll on purpose.
      let a = el.parentElement, inScroller = false;
      while (a) {
        if (["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(a).overflowX)) { inScroller = true; break; }
        a = a.parentElement;
      }
      if (inScroller) continue;
      const r = el.getBoundingClientRect();
      if (r.width && r.right > W + 0.5) out.push(`${el.tagName.toLowerCase()} right=${Math.round(r.right)} "${(el.innerText || "").slice(0, 30).replace(/\n/g, " ")}"`);
    }
    const bar = document.querySelector("div.fixed.inset-x-0.bottom-0 > div");
    if (bar) {
      const r = bar.getBoundingClientRect();
      if (r.left < -0.5 || r.right > W + 0.5) out.push(`rest bar off-screen ${Math.round(r.left)}..${Math.round(r.right)}`);
    }
    if (document.documentElement.scrollWidth > W) out.unshift(`page ${document.documentElement.scrollWidth} wider than screen ${W}`);
    return out.slice(0, 6);
  });
}

for (const width of [320, 360, 384, 412]) {
  test.describe(`${width}px wide`, () => {
    test.use({ viewport: { width, height: 800 } });

    test("no screen overflows sideways", async ({ page }) => {
      const bad: string[] = [];
      const check = async (name: string) => {
        const o = await overflow(page);
        if (o.length) bad.push(`${name}: ${o.join(" ; ")}`);
      };
      await page.goto("/");
      await page.evaluate(() => {
        localStorage.clear();
        localStorage.setItem("ags:history", JSON.stringify([{ date: "2026-10-20", session: "Pull Day", label: "Pull Day", volumeLb: 5000, sets: 12, prs: 1, cardioMin: 40, exercises: ["Wide-Grip Lat Pulldown"] }]));
      });
      await openApp(page);
      await check("home");
      for (const s of ["Push", "Pull", "Legs", "Pump", "Abs", "Forearms"]) {
        await openApp(page);
        await page.locator(`button[aria-label^="${s}:"]`).dispatchEvent("click");
        await page.waitForSelector("text=Back to home");
        const slide = page.locator("[aria-roledescription=slide]", { has: page.locator('button[aria-label="Mark set 1 done"]') }).first();
        await slide.locator('button[aria-label="Mark set 1 done"]').dispatchEvent("click");
        await check(`${s} workout + rest timer`);
      }
      await openApp(page);
      for (const tab of ["Meals", "Progress", "More"]) {
        await page.locator(`nav[aria-label=Main] >> text=${tab}`).dispatchEvent("click");
        await check(tab);
      }
      for (const row of ["Data on this phone", "Daily habits", "Supplements", "Your week", "Sleep times", "Cardio Day"]) {
        await page.locator("nav[aria-label=Main] >> text=More").dispatchEvent("click");
        await page.waitForTimeout(200);
        await page.locator(`button:has-text("${row}")`).first().dispatchEvent("click");
        await check(row);
      }
      await openApp(page); // Cardio Day has no bottom bar
      for (const row of ["Your wins", "Body tracker", "Visual evolution", "Weekly evolution"]) {
        await page.locator("nav[aria-label=Main] >> text=Progress").dispatchEvent("click");
        await page.waitForTimeout(200);
        await page.locator(`button:has-text("${row}")`).first().dispatchEvent("click");
        await check(row);
      }
      expect(bad).toEqual([]);
    });
  });
}
