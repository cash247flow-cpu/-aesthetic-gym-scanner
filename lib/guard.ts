// Server-side guards that need shared storage (lib/kv.ts, Upstash):
//   • login rate limit — failed passcodes per network address and overall;
//   • AI daily caps — photo reads per session and overall per UTC day;
//   • device sessions — list sign-ins, sign out one device or all others.
// Network addresses are stored only as keyed hashes; no IPs, passcodes or photos are stored.
// If the store isn't configured or doesn't answer, every guard steps aside (fail-open) and the
// app relies on its other protections (Vercel login, signed expiring sessions).

import type { KV } from "@/lib/kv";

export const LOGIN = { PER_IP: 5, TOTAL: 50, WINDOW_S: 15 * 60 };
export const SESSION_TTL_S = 90 * 24 * 3600;

const enc = new TextEncoder();
async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(`ags-guard:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(value))).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The caller's network address as Vercel reports it, reduced to a keyed hash. */
export async function clientId(headers: Headers, secret: string) {
  const ip = headers.get("x-real-ip") || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return hmacHex(secret, ip);
}

// ─── Login rate limit ───────────────────────────────────────────────────
export type Limit = { blocked: false } | { blocked: true; retryAfterS: number };

export async function loginBlocked(kv: KV | null, client: string): Promise<Limit> {
  if (!kv) return { blocked: false };
  try {
    const [mine, all, ttlMine, ttlAll] = (await kv.pipeline([
      ["GET", `rl:login:${client}`],
      ["GET", "rl:login:all"],
      ["TTL", `rl:login:${client}`],
      ["TTL", "rl:login:all"],
    ])) as [string | null, string | null, number, number];
    if (Number(mine ?? 0) >= LOGIN.PER_IP) return { blocked: true, retryAfterS: Math.max(1, ttlMine) };
    if (Number(all ?? 0) >= LOGIN.TOTAL) return { blocked: true, retryAfterS: Math.max(1, ttlAll) };
    return { blocked: false };
  } catch {
    return { blocked: false };
  }
}

export async function recordLoginFailure(kv: KV | null, client: string) {
  if (!kv) return;
  try {
    await kv.pipeline([
      ["INCR", `rl:login:${client}`],
      ["EXPIRE", `rl:login:${client}`, LOGIN.WINDOW_S, "NX"],
      ["INCR", "rl:login:all"],
      ["EXPIRE", "rl:login:all", LOGIN.WINDOW_S, "NX"],
    ]);
  } catch {
    /* fail open */
  }
}

export async function clearLoginFailures(kv: KV | null, client: string) {
  if (!kv) return;
  try {
    await kv.pipeline([["DEL", `rl:login:${client}`]]);
  } catch {
    /* fail open */
  }
}

// ─── AI daily caps ──────────────────────────────────────────────────────
export const aiLimits = () => ({
  perSession: Math.max(1, Number(process.env.AI_DAILY_LIMIT_PER_SESSION) || 30),
  total: Math.max(1, Number(process.env.AI_DAILY_LIMIT_TOTAL) || 100),
});
const utcDay = (nowMs: number) => new Date(nowMs).toISOString().slice(0, 10);

/** Counts one photo read; returns false when today's cap for this session or overall is used up. */
export async function takeAiCall(kv: KV | null, sid: string, nowMs = Date.now(), limits = aiLimits()): Promise<{ ok: boolean; reason?: "session" | "total" }> {
  if (!kv) return { ok: true };
  const day = utcDay(nowMs);
  try {
    const [mine, , all] = (await kv.pipeline([
      ["INCR", `ai:${day}:${sid}`],
      ["EXPIRE", `ai:${day}:${sid}`, 2 * 86400, "NX"],
      ["INCR", `ai:${day}:all`],
      ["EXPIRE", `ai:${day}:all`, 2 * 86400, "NX"],
    ])) as number[];
    if (mine > limits.perSession) return { ok: false, reason: "session" };
    if (all > limits.total) return { ok: false, reason: "total" };
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

// ─── Device sessions ────────────────────────────────────────────────────
export type Device = { sid: string; device: string; createdAt: number; lastSeen: number };

/** "Android · Chrome" — no versions, no IP. */
export function deviceLabel(ua: string | null) {
  const u = ua ?? "";
  const os = /Android/.test(u) ? "Android" : /iPhone/.test(u) ? "iPhone" : /iPad/.test(u) ? "iPad" : /Windows/.test(u) ? "Windows" : /Mac OS X|Macintosh/.test(u) ? "Mac" : /Linux/.test(u) ? "Linux" : "Unknown device";
  const br = /SamsungBrowser/.test(u) ? "Samsung Internet" : /Edg\//.test(u) ? "Edge" : /Firefox\//.test(u) ? "Firefox" : /Chrome\//.test(u) ? "Chrome" : /Safari\//.test(u) ? "Safari" : "Browser";
  return `${os} · ${br}`;
}

export async function registerSession(kv: KV | null, sid: string, ua: string | null, nowMs = Date.now()) {
  if (!kv) return;
  try {
    await kv.pipeline([
      ["HSET", `sess:${sid}`, "device", deviceLabel(ua), "createdAt", nowMs, "lastSeen", nowMs],
      ["EXPIRE", `sess:${sid}`, SESSION_TTL_S],
      ["SADD", "sessions", sid],
    ]);
  } catch {
    /* fail open */
  }
}

/**
 * Called on each signed-in request. Returns "revoked" only if this session was explicitly signed
 * out; sessions started before this feature (no record yet) are adopted, not rejected.
 */
export async function checkSession(kv: KV | null, sid: string, ua: string | null, touch: boolean, nowMs = Date.now()): Promise<"ok" | "revoked"> {
  if (!kv) return "ok";
  try {
    const [revoked, known] = (await kv.pipeline([
      ["EXISTS", `revoked:${sid}`],
      ["EXISTS", `sess:${sid}`],
    ])) as number[];
    if (revoked) return "revoked";
    if (!known) await registerSession(kv, sid, ua, nowMs);
    else if (touch) await kv.pipeline([["HSET", `sess:${sid}`, "lastSeen", nowMs]]);
    return "ok";
  } catch {
    return "ok";
  }
}

export async function revokeSession(kv: KV | null, sid: string) {
  if (!kv) return false;
  try {
    await kv.pipeline([
      ["SET", `revoked:${sid}`, "1", "EX", SESSION_TTL_S],
      ["DEL", `sess:${sid}`],
      ["SREM", "sessions", sid],
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function listSessions(kv: KV | null): Promise<Device[] | null> {
  if (!kv) return null;
  try {
    const [sids] = (await kv.pipeline([["SMEMBERS", "sessions"]])) as [string[]];
    if (!sids.length) return [];
    const rows = (await kv.pipeline(sids.map((s) => ["HGETALL", `sess:${s}`]))) as string[][];
    const out: Device[] = [];
    const gone: string[] = [];
    rows.forEach((r, i) => {
      if (!r?.length) return void gone.push(sids[i]);
      const h: Record<string, string> = {};
      for (let j = 0; j < r.length; j += 2) h[r[j]] = r[j + 1];
      out.push({ sid: sids[i], device: h.device ?? "Unknown device", createdAt: Number(h.createdAt), lastSeen: Number(h.lastSeen) });
    });
    if (gone.length) await kv.pipeline([["SREM", "sessions", ...gone]]);
    return out.sort((a, b) => b.lastSeen - a.lastSeen);
  } catch {
    return null;
  }
}
