// Optional app lock for the most private screens (Visual evolution, Body tracker, Data on this
// phone). Off unless the user turns it on.
//
// Unlock with the phone's own screen lock (fingerprint / face / phone PIN, via a passkey —
// WebAuthn with user verification) and/or an app PIN (6–12 digits, stored only as a salted
// PBKDF2 hash). Wrong PINs are throttled. Forgot the PIN? The app passcode resets the lock.
//
// What it is: a privacy screen against someone holding your unlocked phone. What it isn't:
// encryption — the data on the phone isn't encrypted by this, and someone with developer tools
// on an unlocked computer could get past it.

export const LOCK_KEY = "ags:lock"; // device-specific: never included in backups
export const PIN_ITERATIONS = 210_000;
export const MIN_PIN = 6;
export const MAX_PIN = 12;

export type Relock = "leave" | "5" | "15";
export type LockConfig = {
  enabled: true;
  pin: { salt: string; hash: string; iterations: number } | null;
  device: { credentialId: string } | null; // passkey on this phone
  relock: Relock;
  failures: number;
  blockedUntil: number; // ms epoch
};

// ─── PIN ────────────────────────────────────────────────────────────────
export const pinProblem = (pin: string) =>
  !/^\d+$/.test(pin) ? "Use digits only." : pin.length < MIN_PIN || pin.length > MAX_PIN ? `Use ${MIN_PIN}–${MAX_PIN} digits.` : /^(\d)\1+$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin) ? "Too easy to guess — avoid repeated or sequential digits." : null;

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(pin: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256));
}

export async function hashPin(pin: string, iterations = PIN_ITERATIONS): Promise<LockConfig["pin"]> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: b64(salt), hash: b64(await derive(pin, salt, iterations)), iterations };
}

export async function verifyPin(pin: string, stored: NonNullable<LockConfig["pin"]>): Promise<boolean> {
  const got = await derive(pin, unb64(stored.salt), stored.iterations);
  const want = unb64(stored.hash);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

// ─── Throttling wrong PINs ──────────────────────────────────────────────
/** After 5 wrong PINs: wait 30 s, then doubling, up to 1 hour. */
export function afterFailure(c: LockConfig, now: number): LockConfig {
  const failures = c.failures + 1;
  const wait = failures < 5 ? 0 : Math.min(3600_000, 30_000 * 2 ** (failures - 5));
  return { ...c, failures, blockedUntil: wait ? now + wait : 0 };
}
export const afterSuccess = (c: LockConfig): LockConfig => ({ ...c, failures: 0, blockedUntil: 0 });
export const waitSeconds = (c: LockConfig, now: number) => Math.max(0, Math.ceil((c.blockedUntil - now) / 1000));

// ─── When to lock again ─────────────────────────────────────────────────
/** Unlocked since `unlockedAt`; last activity at `lastActive`. "leave" also locks when the app is hidden (handled by the caller). */
export function stillUnlocked(relock: Relock, unlockedAt: number | null, lastActive: number, now: number): boolean {
  if (unlockedAt === null) return false;
  const idleLimit = relock === "15" ? 15 * 60_000 : 5 * 60_000; // "leave" also expires after 5 minutes idle
  return now - lastActive < idleLimit;
}

// ─── Storage ────────────────────────────────────────────────────────────
export function loadLock(): LockConfig | null {
  try {
    const v = JSON.parse(localStorage.getItem(LOCK_KEY) ?? "null") as LockConfig | null;
    return v?.enabled && (v.pin || v.device) ? v : null;
  } catch {
    return null;
  }
}
export function saveLock(c: LockConfig | null) {
  try {
    if (c) localStorage.setItem(LOCK_KEY, JSON.stringify(c));
    else localStorage.removeItem(LOCK_KEY);
  } catch {
    /* ignore */
  }
}

// ─── Phone screen lock (passkey with user verification) ─────────────────
export async function deviceUnlockAvailable(): Promise<boolean> {
  try {
    return typeof PublicKeyCredential !== "undefined" && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

/** Creates a passkey on this phone that only unlocks after fingerprint / face / phone PIN. */
export async function registerDevice(): Promise<{ credentialId: string } | null> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "AESTHETIQ app lock", id: location.hostname },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "AESTHETIQ app lock", displayName: "AESTHETIQ app lock" },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;
  return cred ? { credentialId: b64(new Uint8Array(cred.rawId)) } : null;
}

/** Asks the phone to verify its owner. True only if the phone confirmed user verification. */
export async function unlockWithDevice(credentialId: string): Promise<boolean> {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: "public-key", id: unb64(credentialId) as BufferSource, transports: ["internal"] }],
      userVerification: "required",
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) return false;
  const data = new Uint8Array((cred.response as AuthenticatorAssertionResponse).authenticatorData);
  return data.length > 32 && (data[32] & 0x04) !== 0; // UV flag: the phone verified you
}
