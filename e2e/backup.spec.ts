// Encrypted backup → wipe → restore round trip, wrong passphrase, tampered file, add-missing mode,
// and Delete everything with recovery from a backup.
import { test, expect, openWithExampleData, openApp, go, addPhotos, readAppState, signInWithPasscode } from "./support/test";
import fs from "node:fs";

const PASS = "synthetic-backup-passphrase-42";
const BOOKKEEPING = /^ags:(renames:|schedule:days$|missed:since$|achievements$|events$|profile:id$|prereminder|backup:last$)/;

async function createBackup(page: import("@playwright/test").Page, file: string) {
  const create = page.locator('section[aria-label="Create backup"]');
  await create.getByLabel("Backup passphrase", { exact: true }).fill(PASS);
  await create.getByLabel("Repeat backup passphrase").fill(PASS);
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), create.locator('button:has-text("Create backup")').click()]);
  await dl.saveAs(file);
  await expect(create.locator("[role=status]")).toBeVisible();
  return dl.suggestedFilename();
}

async function openBackup(page: import("@playwright/test").Page, file: string, passphrase = PASS) {
  const restore = page.locator('section[aria-label="Restore backup"]');
  await restore.locator('input[aria-label="Backup file"]').setInputFiles(file);
  await restore.getByLabel("Passphrase of the backup").fill(passphrase);
  await restore.locator('button:has-text("Open backup")').click();
  return restore;
}

test("backup round trip restores every record and photo byte-for-byte", async ({ page }, info) => {
  page.on("dialog", (d) => d.accept());
  const leaving: string[] = [];
  page.on("request", (r) => (r.method() !== "GET" || !r.url().startsWith("http://localhost")) && !/^(blob|data):/.test(r.url()) && leaving.push(`${r.method()} ${r.url()}`));
  await openWithExampleData(page);
  await go(page, "Progress", "Visual evolution");
  await addPhotos(page, [["2026-10-01", "front-1.jpg"], ["2026-10-22", "front-2.jpg"], ["2026-10-22", "side-1.jpg"]]);
  await go(page, "More", "Data on this phone");
  const A = await readAppState(page);
  expect(Object.keys(A.hashes)).toHaveLength(3);

  // Passphrase rules.
  const create = page.locator('section[aria-label="Create backup"]');
  await create.getByLabel("Backup passphrase", { exact: true }).fill("short");
  await expect(create.locator('button:has-text("Create backup")')).toBeDisabled();
  await create.getByLabel("Backup passphrase", { exact: true }).fill(PASS);
  await create.getByLabel("Repeat backup passphrase").fill(PASS + "x");
  await expect(create.locator('button:has-text("Create backup")')).toBeDisabled();

  const file = info.outputPath("backup.aqbk");
  expect(await createBackup(page, file)).toMatch(/\.aqbk$/);
  const raw = fs.readFileSync(file).toString("latin1");
  expect(raw.startsWith("AQBK1\n")).toBe(true);
  for (const plain of ["Incline", "ags:", "201.6", '"front"']) expect(raw, `backup must not contain "${plain}" in clear`).not.toContain(plain);

  // Wipe this test browser, then restore into the empty app.
  await page.evaluate(() => new Promise<void>((res) => { localStorage.clear(); const r = indexedDB.deleteDatabase("ags"); r.onsuccess = r.onerror = r.onblocked = () => res(); }));
  await openApp(page);
  await go(page, "More", "Data on this phone");
  let restore = await openBackup(page, file, "synthetic-wrong-passphrase");
  await expect(restore.locator("[role=status]")).toContainText(/passphrase/i);
  restore = await openBackup(page, file);
  await page.waitForSelector("text=/Backup from/", { timeout: 60_000 });
  await expect(restore.locator("text=/safety backup/i")).toHaveCount(0); // empty phone: no pointless safety step
  const pending = await readAppState(page);
  expect(Object.keys(pending.recs).filter((k) => !BOOKKEEPING.test(k)), "nothing written before confirming").toEqual([]);
  await restore.locator('button:has-text("Restore now")').click();
  await page.waitForSelector("text=/Restored \\d+ record/", { timeout: 60_000 });

  const B = await readAppState(page);
  for (const k of Object.keys(A.recs).filter((k) => k !== "ags:backup:last")) expect(B.recs[k], k).toBe(A.recs[k]);
  expect(B.hashes).toEqual(A.hashes);
  await restore.locator('button:has-text("Reload app")').click();
  await page.waitForSelector("text=Build Your Ideal");
  await go(page, "Progress", "Visual evolution");
  await expect(page.locator('section[aria-label="Photo timeline"] img')).toHaveCount(3);

  // Tampered and non-backup files are rejected.
  const t = fs.readFileSync(file);
  t[t.length - 10] ^= 1;
  fs.writeFileSync(info.outputPath("tampered.aqbk"), t);
  fs.writeFileSync(info.outputPath("notbackup.aqbk"), "just text");
  await go(page, "More", "Data on this phone");
  for (const f of ["tampered.aqbk", "notbackup.aqbk"]) {
    restore = await openBackup(page, info.outputPath(f));
    await expect(restore.locator("[role=status]")).toBeVisible({ timeout: 60_000 });
    await expect(restore.locator("text=/Backup from/")).toHaveCount(0);
  }

  // Add-missing on a phone with data: a safety backup is required first; existing values are kept.
  await page.evaluate(() => { localStorage.setItem("ags:unit", "kg"); localStorage.removeItem("ags:body:goal"); });
  restore = await openBackup(page, file);
  await page.waitForSelector("text=/Backup from/", { timeout: 60_000 });
  await restore.getByLabel("Add only what's missing").check();
  await expect(restore.locator('button:has-text("Restore now")')).toBeDisabled();
  await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), restore.locator('button:has-text("safety backup")').click()]);
  await expect(restore.locator('button:has-text("Restore now")')).toBeEnabled();
  await restore.locator('button:has-text("Restore now")').click();
  await page.waitForSelector("text=/Restored \\d+ record/", { timeout: 60_000 });
  expect(await page.evaluate(() => localStorage.getItem("ags:unit"))).toBe("kg");
  expect(await page.evaluate(() => localStorage.getItem("ags:body:goal"))).not.toBeNull();
  expect(leaving).toEqual([]);
});

test("delete everything: gated, complete, signs out, and recoverable from a backup", async ({ page, context }, info) => {
  page.on("dialog", (d) => d.accept());
  await openWithExampleData(page);
  await page.waitForTimeout(1500); // let the service worker install, so there's an offline copy to clear
  await go(page, "Progress", "Visual evolution");
  await addPhotos(page, [["2026-10-01", "front-1.jpg"], ["2026-10-22", "front-2.jpg"]]);
  await openApp(page);
  await go(page, "More", "Data on this phone");
  const A = await readAppState(page);
  const zone = page.locator('section[aria-label="Delete everything"]');
  const del = zone.locator('button:text-is("Delete everything")');

  // No recent backup → an extra acknowledgement; the word must be exactly DELETE.
  await zone.locator('button:has-text("Delete everything…")').click();
  await zone.getByLabel("Type DELETE to confirm").fill("DELETE");
  await expect(del).toBeDisabled();
  await zone.getByLabel("Type DELETE to confirm").fill("delete");
  await zone.locator("text=/no recent backup/").click();
  await expect(del).toBeDisabled();
  await zone.locator('button:has-text("Cancel")').click();
  expect((await readAppState(page)).recs).toEqual(A.recs);

  // With a fresh backup, no acknowledgement is needed.
  const file = info.outputPath("before-erase.aqbk");
  await createBackup(page, file);
  await zone.locator('button:has-text("Delete everything…")').click();
  await expect(zone.locator("text=/no recent backup/")).toHaveCount(0);
  await zone.getByLabel("Type DELETE to confirm").fill("DELETE");
  await expect(del).toBeEnabled();
  await del.click();
  await page.waitForSelector("text=/was deleted/", { timeout: 30_000 });
  const B = await readAppState(page);
  expect(Object.keys(B.recs)).toEqual([]);
  expect(B.dbs).not.toContain("ags");
  expect(B.caches.filter((c) => c.startsWith("ags-"))).toEqual([]);
  expect((await context.cookies()).some((c) => c.name === "__Host-ags_session")).toBe(false);

  await zone.locator('button:has-text("Finish")').click();
  await page.waitForURL(/\/login/);
  await signInWithPasscode(page);
  const C = await readAppState(page);
  expect(Object.keys(C.recs).filter((k) => !BOOKKEEPING.test(k))).toEqual([]);
  expect(C.hashes).toEqual({});

  await go(page, "More", "Data on this phone");
  const restore = await openBackup(page, file);
  await page.waitForSelector("text=/Backup from/", { timeout: 60_000 });
  await restore.locator('button:has-text("Restore now")').click();
  await page.waitForSelector("text=/Restored \\d+ record/", { timeout: 60_000 });
  const R = await readAppState(page);
  for (const k of Object.keys(A.recs).filter((k) => k !== "ags:backup:last")) expect(R.recs[k], k).toBe(A.recs[k]);
  expect(R.hashes).toEqual(A.hashes);
});
