// App passcode. When APP_PASSCODE is set (e.g. on Vercel), every page and API route needs a
// cookie proving the passcode was entered — so nobody who finds the link can use your Gemini
// key. Without APP_PASSCODE (local dev) the app stays open. Works in middleware (Edge runtime).

export const AUTH_COOKIE = "ags_auth";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 365; // stay signed in for a year on that phone

export const passcodeRequired = () => !!process.env.APP_PASSCODE;

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
