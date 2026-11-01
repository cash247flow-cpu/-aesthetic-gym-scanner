// Shared test setup for every end-to-end test:
//  - each test gets a fresh browser profile, already signed in with a signed session cookie
//    (minted exactly like lib/session.ts does), unless the test opts out with `signedIn: false`;
//  - the fake Upstash store is emptied before each test;
//  - a test FAILS if the page throws an uncaught error or the browser reports a Content Security
//    Policy violation, even when its own checks passed.
import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";
import crypto from "node:crypto";
import path from "node:path";
import { E2E } from "./env";

export { expect };
export const FIXTURES = path.resolve(__dirname, "../fixtures");
export const fixture = (name: string) => path.join(FIXTURES, name);

/** A session token the server accepts (or, with another secret, one it must refuse). */
export function mintSession(opts: { secret?: string; ageDays?: number; idleDays?: number } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const iat = now - (opts.ageDays ?? 0) * 86400;
  const lastRenew = now - (opts.idleDays ?? 0) * 86400;
  const sid = crypto.randomBytes(16).toString("base64url");
  const body = Buffer.from(JSON.stringify({ v: 2, sid, iat, exp: lastRenew + 30 * 86400, max: iat + 90 * 86400 })).toString("base64url");
  const sig = crypto.createHmac("sha256", "ags-session-v2:" + (opts.secret ?? E2E.sessionSecret)).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export const sessionCookie = (value: string) => ({ name: "__Host-ags_session", value, domain: "localhost", path: "/", secure: true, httpOnly: true, sameSite: "Lax" as const });

export async function signInCookie(ctx: BrowserContext) {
  await ctx.addCookies([sessionCookie(mintSession())]);
}

export async function resetStore() {
  await fetch(`http://127.0.0.1:${E2E.kvAdminPort}/__reset`);
}
export async function storeKeys(): Promise<string[]> {
  return (await fetch(`http://127.0.0.1:${E2E.kvAdminPort}/__keys`)).json();
}

/** Problems seen in a page: uncaught errors and CSP violations. */
export function watchPage(p: Page, problems: string[]) {
  p.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
  p.on("console", (m) => {
    if (m.text().startsWith("[e2e] CSP violation") || /Refused to/.test(m.text())) problems.push(`CSP: ${m.text()}`);
  });
}

/** Reports every CSP violation the browser raises, in every page and frame of a context. */
export async function watchCsp(ctx: BrowserContext) {
  await ctx.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      console.error(`[e2e] CSP violation: ${e.violatedDirective} blocked ${e.blockedURI || "inline"}`);
    });
  });
}

type Fixtures = { signedIn: boolean; problems: string[]; freshStore: void };

export const test = base.extend<Fixtures>({
  signedIn: [true, { option: true }],
  // Every test starts with an empty fake Upstash store (sessions, login failures, AI counts).
  freshStore: [
    async ({}, use) => {
      await resetStore();
      await use();
    },
    { auto: true },
  ],
  problems: async ({}, use) => {
    await use([]);
  },
  context: async ({ context, signedIn, problems }, use) => {
    if (signedIn) await signInCookie(context);
    await watchCsp(context);
    context.on("page", (p) => watchPage(p, problems));
    await use(context);
  },
  page: async ({ page, problems }, use) => {
    await use(page);
    expect(problems, "uncaught page errors or CSP violations").toEqual([]);
  },
});

// ─── App helpers ────────────────────────────────────────────────────────

export const HOME_READY = "text=Build Your Ideal";

export async function openApp(p: Page) {
  await p.goto("/");
  await p.waitForSelector(HOME_READY);
}

/** Tab in the bottom bar, then optionally a row on that screen. */
export async function go(p: Page, tab: string, row?: string) {
  await p.locator(`nav[aria-label=Main] >> text=${tab}`).dispatchEvent("click");
  await p.waitForTimeout(250);
  if (row) {
    await p.locator(`button:has-text("${row}")`).first().click();
    await p.waitForTimeout(400);
  }
}

export async function signInWithPasscode(p: Page, passcode: string = E2E.passcode) {
  await p.fill('input[aria-label="App passcode"]', passcode);
  await p.locator('button[type=submit]').click();
  await p.waitForURL((u) => new URL(u).pathname === "/");
  await p.waitForSelector(HOME_READY);
}

/** Opens the app and loads the synthetic example week (Oct 18–24, 2026). */
export async function openWithExampleData(p: Page) {
  await p.goto("/");
  await p.evaluate(seedExampleData);
  await openApp(p);
}

/** The example data's week has just ended on this date; set it on the browser clock. */
export const EXAMPLE_TODAY = new Date("2026-10-28T12:00:00");

// Synthetic example data for an isolated test browser (never a real user's phone).
// Runs inside the page, so it must be self-contained.
export function seedExampleData() {
  const set = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
  localStorage.clear();
  set("ags:missed:since", "2026-09-27");
  const snaps: Record<string, unknown> = {};
  const plan: Record<string, [string, string]> = { "2026-10-19": ["push", "Push Day"], "2026-10-20": ["pull", "Pull Day"], "2026-10-21": ["legs", "Leg Day"], "2026-10-22": ["push", "Push Day"], "2026-10-23": ["pull", "Pull Day"] };
  for (let d = 18; d <= 24; d++) {
    const k = `2026-10-${d}`;
    snaps[k] = plan[k] ? { choice: plan[k][0], name: plan[k][1], cardio: null } : { choice: "rest", name: "Rest", cardio: null };
  }
  set("ags:schedule:days", snaps);
  const h = (date: string, session: string, volumeLb: number, ex: string[], cardioMin = 0) => ({ date, session, label: session, volumeLb, sets: 20, prs: 0, cardioMin, exercises: ex });
  set("ags:history", [
    h("2026-10-12", "Push Day", 9000, ["Incline Dumbbell Press"]), h("2026-10-13", "Pull Day", 9000, ["Meadows Row"]),
    h("2026-10-15", "Push Day", 9000, ["Incline Dumbbell Press"]), h("2026-10-16", "Pull Day", 9000, ["Meadows Row"]),
    h("2026-10-19", "Push Day", 10000, ["Incline Dumbbell Press"], 20), h("2026-10-20", "Pull Day", 10500, ["Meadows Row"]),
    h("2026-10-22", "Push Day", 10200, ["Incline Dumbbell Press"]), h("2026-10-23", "Pull Day", 10400, ["Meadows Row"], 25),
  ]);
  set("ags:workouts", [
    { id: "2026-10-12|Push Day|", date: "2026-10-12", session: "Push Day", savedAt: 1, exercises: [{ name: "Incline Dumbbell Press", sets: [{ weightLb: 60, reps: 12 }] }] },
    { id: "2026-10-19|Push Day|", date: "2026-10-19", session: "Push Day", savedAt: 2, exercises: [{ name: "Incline Dumbbell Press", sets: [{ weightLb: 65, reps: 10 }] }] },
  ]);
  const b = (id: string, date: string, weightLb: number, extra = {}) => ({ id, date, weightLb, source: "manual", ...extra });
  set("ags:body:entries", [
    b("a", "2026-09-28", 202), b("b", "2026-10-01", 201.6, { waistIn: 36.5 }), b("c", "2026-10-06", 201.2), b("d", "2026-10-08", 201),
    b("e", "2026-10-11", 201), b("f", "2026-10-13", 200.6), b("g", "2026-10-15", 200.2),
    b("h", "2026-10-19", 200.4, { waistIn: 36 }), b("i", "2026-10-22", 200.0), b("j", "2026-10-24", 199.8, { waistIn: 35.6 }),
  ]);
  set("ags:body:goal", { type: "lose", targetLb: 185 });
  const full = { morning: true, pfc: 3, squat: 3, cortisol: true, sleep: [true, true, true] };
  const logs: Record<string, unknown> = {};
  for (let d = 18; d <= 24; d++) logs[`2026-10-${d}`] = d % 3 === 0 ? { morning: true, pfc: 2 } : full;
  set("ags:habits", logs);
  set("ags:meals", { "2026-10-19": { breakfast: true, lunch: true, dinner: true }, "2026-10-20": { breakfast: true } });
  set("ags:cronometer", [19, 20, 21, 22, 23].map((d) => ({ date: `2026-10-${d}`, kcal: 1400 + d, protein: 150, carbs: 70, netCarbs: 60, fat: 60, completed: true })));
}

/** Everything the app keeps in this browser: `ags:` records and the SHA-256 of each stored file. */
export function readAppState(p: Page) {
  return p.evaluate(async () => {
    const recs: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith("ags:")) recs[k] = localStorage.getItem(k)!;
    }
    const dbs = (await indexedDB.databases()).map((d) => d.name);
    const files: Record<string, Blob> = dbs.includes("ags")
      ? await new Promise((res) => {
          const r = indexedDB.open("ags", 1);
          r.onsuccess = () => {
            const out: Record<string, Blob> = {};
            const c = r.result.transaction("files").objectStore("files").openCursor();
            c.onsuccess = () => {
              const cur = c.result;
              if (cur) {
                out[String(cur.key)] = cur.value;
                cur.continue();
              } else {
                r.result.close();
                res(out);
              }
            };
          };
        })
      : {};
    const hashes: Record<string, string> = {};
    for (const [k, blob] of Object.entries(files)) {
      const d = await window.crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
      hashes[k] = blob.type + ":" + Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("");
    }
    return { recs, dbs, hashes, caches: "caches" in window ? await caches.keys() : [] };
  });
}

/** Adds progress photos through the Visual evolution screen (must already be open). */
export async function addPhotos(p: Page, photos: [date: string, file: string][]) {
  for (const [date, file] of photos) {
    const n = await p.evaluate(() => JSON.parse(localStorage.getItem("ags:photos") || "[]").length);
    await p.fill("input[type=date]", date);
    await p.setInputFiles('input[aria-label="Upload a progress photo"]', fixture(file));
    await p.waitForFunction((want) => JSON.parse(localStorage.getItem("ags:photos") || "[]").length === want, n + 1);
  }
}
