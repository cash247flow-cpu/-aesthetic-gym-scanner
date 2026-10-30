// App passcode gate. Every page and API route needs a cookie proving the passcode was entered,
// so nobody who finds the link can use the app or its Gemini key. Works in middleware (Edge).
//
// Fails closed: if APP_PASSCODE is missing or blank, access is refused (503) everywhere — on
// Vercel (Production and Preview) and in any production build, including `next start` locally.
// The only open mode is `next dev` on a developer's own machine (NODE_ENV=development and not
// running on Vercel). There is no flag or header that can switch the gate off.
//
// TEMPORARY: one shared passcode is fine for a single owner's private app, but it is not
// suitable for multiple users in production (no per-user accounts, revocation or roles).

export const AUTH_COOKIE = "ags_auth";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 365; // stay signed in for a year on that phone

export type AuthMode = "passcode" | "open-dev" | "misconfigured";
type AuthEnv = { APP_PASSCODE?: string; NODE_ENV?: string; VERCEL?: string; VERCEL_ENV?: string };

// Literal process.env reads (inlined/available in both the Edge and Node runtimes).
const runtimeEnv = (): AuthEnv => ({
  APP_PASSCODE: process.env.APP_PASSCODE,
  NODE_ENV: process.env.NODE_ENV,
  VERCEL: process.env.VERCEL,
  VERCEL_ENV: process.env.VERCEL_ENV,
});

export function authMode(env: AuthEnv = runtimeEnv()): AuthMode {
  if ((env.APP_PASSCODE ?? "").trim()) return "passcode";
  const localDev = env.NODE_ENV === "development" && !env.VERCEL && !env.VERCEL_ENV;
  return localDev ? "open-dev" : "misconfigured";
}

/** Shown when sign-in isn't configured — says nothing about the configuration itself. */
export const NOT_CONFIGURED = "This app's sign-in isn't set up yet, so it's locked. The owner needs to finish the hosting setup.";

/** Cookie value: a hash of the passcode, so changing APP_PASSCODE signs every device out. */
export async function authToken(passcode = process.env.APP_PASSCODE ?? ""): Promise<string> {
  const data = new TextEncoder().encode(`ags-v1:${passcode}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string compare. */
export function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
