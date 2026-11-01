// Signed, expiring sign-in sessions (replaces the old year-long cookie that was just a hash of
// the passcode). Works in middleware (Edge) and route handlers — WebCrypto only.
//
// Cookie value: base64url(JSON payload) + "." + base64url(HMAC-SHA-256(payload)), keyed by the
// server-only SESSION_SECRET. A session:
//   • has a random id, the time you signed in, and two limits —
//     idle:     30 days without using the app → signed out (renewed while you use it);
//     absolute: 90 days after signing in → signed out, whatever happens;
//   • can't be forged or extended without SESSION_SECRET, and reveals nothing about the passcode;
//   • ends on this phone with "Sign out"; changing SESSION_SECRET (and redeploying) ends every
//     session on every device — the lost-phone procedure. There's no per-device list on the
//     server (that needs a database), so revoking one device means revoking all.

export const SESSION_COOKIE = "__Host-ags_session"; // __Host-: Secure, path "/", no Domain
export const LEGACY_COOKIE = "ags_auth"; // the old cookie — no longer accepted, removed when seen
export const IDLE_SECONDS = 30 * 24 * 3600;
export const ABSOLUTE_SECONDS = 90 * 24 * 3600;
export const REFRESH_AFTER_SECONDS = 24 * 3600; // renew the idle limit at most once a day
export const MIN_SECRET_CHARS = 32;

export type Session = { v: 2; sid: string; iat: number; exp: number; max: number }; // seconds since epoch

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function fromB64url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export const secretUsable = (secret: string | undefined) => (secret ?? "").trim().length >= MIN_SECRET_CHARS;

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(`ags-session-v2:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signSession(s: Session, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(s)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

export function newSession(nowSec: number): Session {
  const id = new Uint8Array(16);
  crypto.getRandomValues(id);
  return { v: 2, sid: b64url(id), iat: nowSec, exp: nowSec + IDLE_SECONDS, max: nowSec + ABSOLUTE_SECONDS };
}

export type Verified = { ok: true; session: Session; renewed: Session | null } | { ok: false; reason: "missing" | "malformed" | "bad_signature" | "expired" };

/** Checks signature and limits; if it's been a day since the last renewal, returns a renewed copy. */
export async function verifySession(token: string | undefined, secret: string, nowSec: number): Promise<Verified> {
  if (!token) return { ok: false, reason: "missing" };
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined || token.length > 1024) return { ok: false, reason: "malformed" };
  const sigBytes = fromB64url(sig);
  const bodyBytes = fromB64url(body);
  if (!sigBytes || !bodyBytes) return { ok: false, reason: "malformed" };
  // Constant-time check (crypto.subtle.verify) before the payload is trusted at all.
  if (!(await crypto.subtle.verify("HMAC", await hmacKey(secret), sigBytes as BufferSource, enc.encode(body)))) return { ok: false, reason: "bad_signature" };
  let s: Session;
  try {
    s = JSON.parse(new TextDecoder().decode(bodyBytes));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (s?.v !== 2 || typeof s.sid !== "string" || ![s.iat, s.exp, s.max].every(Number.isInteger)) return { ok: false, reason: "malformed" };
  if (nowSec >= s.exp || nowSec >= s.max || s.iat > nowSec + 300) return { ok: false, reason: "expired" };
  const lastRenewal = s.exp - IDLE_SECONDS;
  const renewed = nowSec - lastRenewal >= REFRESH_AFTER_SECONDS ? { ...s, exp: Math.min(nowSec + IDLE_SECONDS, s.max) } : null;
  return { ok: true, session: s, renewed };
}

export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: true, // required by the __Host- prefix (browsers accept it on http://localhost too)
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

/** Seconds the browser should keep the cookie: until the session's own expiry. */
export const cookieMaxAge = (s: Session, nowSec: number) => Math.max(0, Math.min(s.exp, s.max) - nowSec);

export const nowSeconds = () => Math.floor(Date.now() / 1000);
