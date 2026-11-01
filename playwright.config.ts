// End-to-end tests: a production build in a real browser (Chromium), with synthetic data and
// synthetic secrets only. Run `npm run build` first, then `npm run e2e`.
//
// Two local servers are started for the run:
//   1. a fake Upstash (HTTPS, throwaway self-signed certificate) for the login limit, AI caps and
//      per-device sign-out — no real Upstash account or network is involved;
//   2. `next start` with test-only values for APP_PASSCODE / SESSION_SECRET and no Gemini key.
import { defineConfig, devices } from "@playwright/test";
import { E2E } from "./e2e/support/env";
import { ensureCert } from "./e2e/support/cert";

const cert = ensureCert();

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts$/,
  // One server and one shared fake store: run the files one after another.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    ...devices["Pixel 7"],
    browserName: "chromium",
    baseURL: E2E.baseURL,
    viewport: { width: 360, height: 780 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: `npx tsx e2e/support/fake-upstash.ts`,
      url: `http://127.0.0.1:${E2E.kvAdminPort}/__health`,
      env: { E2E_CERT_DIR: cert.dir },
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `npx next start -p ${E2E.port}`,
      url: `${E2E.baseURL}/login`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NODE_ENV: "production",
        APP_PASSCODE: E2E.passcode,
        SESSION_SECRET: E2E.sessionSecret,
        GEMINI_API_KEY: "",
        KV_REST_API_URL: `https://localhost:${E2E.kvPort}`,
        KV_REST_API_TOKEN: E2E.kvToken,
        NODE_EXTRA_CA_CERTS: cert.certFile,
        AI_DAILY_LIMIT_PER_SESSION: "2",
        AI_DAILY_LIMIT_TOTAL: "100",
      },
    },
  ],
});
