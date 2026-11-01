// Tiny client for Upstash Redis over its HTTPS REST API (no extra package; Edge + Node).
// Configured by the Vercel "Upstash for Redis" integration (KV_REST_API_URL / KV_REST_API_TOKEN)
// or Upstash's own names (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN).
//
// Every call has a short timeout. Callers treat a failure as "store unavailable" and fall back to
// the protections that don't need it (Vercel login, signed expiring sessions) — an outage of this
// optional store must never lock the owner out.

export type Cmd = (string | number)[];
export interface KV {
  pipeline(cmds: Cmd[]): Promise<unknown[]>;
}

const TIMEOUT_MS = 1500;

export function upstash(url: string, token: string): KV {
  const base = url.replace(/\/+$/, "");
  return {
    async pipeline(cmds) {
      const res = await fetch(`${base}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(cmds),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`kv ${res.status}`);
      const out = (await res.json()) as { result?: unknown; error?: string }[];
      if (!Array.isArray(out) || out.length !== cmds.length) throw new Error("kv bad response");
      return out.map((r) => {
        if (r.error) throw new Error("kv command error");
        return r.result;
      });
    },
  };
}

let override: KV | null | undefined;
/** Tests swap in an in-memory store. */
export function setKVForTests(kv: KV | null | undefined) {
  override = kv;
}

export function kvFromEnv(): KV | null {
  if (override !== undefined) return override;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || !/^https:\/\//.test(url)) return null;
  return upstash(url, token);
}

/** In-memory store with the handful of Redis commands this app uses (tests only). */
export function memoryKV(now: () => number = () => Date.now()): KV & { dump(): Map<string, unknown> } {
  const data = new Map<string, unknown>();
  const exp = new Map<string, number>();
  const live = (k: string) => {
    const e = exp.get(k);
    if (e !== undefined && e <= now()) {
      data.delete(k);
      exp.delete(k);
    }
    return data.has(k);
  };
  const run = (c: Cmd): unknown => {
    const [op, k, ...a] = c.map(String);
    switch (op.toUpperCase()) {
      case "GET":
        return live(k) ? data.get(k) : null;
      case "SET": {
        data.set(k, a[0]);
        const i = a.findIndex((x) => x.toUpperCase() === "EX");
        if (i >= 0) exp.set(k, now() + Number(a[i + 1]) * 1000);
        else exp.delete(k);
        return "OK";
      }
      case "INCR": {
        const v = (live(k) ? Number(data.get(k)) : 0) + 1;
        data.set(k, String(v));
        return v;
      }
      case "EXPIRE":
        if (!live(k)) return 0;
        if (a[1]?.toUpperCase() === "NX" && exp.has(k)) return 0;
        exp.set(k, now() + Number(a[0]) * 1000);
        return 1;
      case "TTL":
        return !live(k) ? -2 : exp.has(k) ? Math.ceil((exp.get(k)! - now()) / 1000) : -1;
      case "EXISTS":
        return live(k) ? 1 : 0;
      case "DEL":
        return [k, ...a].filter((x) => data.delete(x)).length;
      case "SADD": {
        const s = (live(k) ? data.get(k) : new Set()) as Set<string>;
        a.forEach((x) => s.add(x));
        data.set(k, s);
        return a.length;
      }
      case "SREM": {
        const s = (live(k) ? data.get(k) : new Set()) as Set<string>;
        a.forEach((x) => s.delete(x));
        return a.length;
      }
      case "SMEMBERS":
        return live(k) ? [...(data.get(k) as Set<string>)] : [];
      case "HSET": {
        const h = (live(k) ? data.get(k) : {}) as Record<string, string>;
        for (let i = 0; i < a.length; i += 2) h[a[i]] = a[i + 1];
        data.set(k, h);
        return a.length / 2;
      }
      case "HGETALL": {
        if (!live(k)) return [];
        return Object.entries(data.get(k) as Record<string, string>).flat();
      }
      default:
        throw new Error(`memoryKV: ${op} not supported`);
    }
  };
  return { pipeline: async (cmds) => cmds.map(run), dump: () => data };
}
