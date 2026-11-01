import { NextResponse } from "next/server";
import { NOT_CONFIGURED, authMode, passcodeDigest, sameString, sessionSecret } from "@/lib/passcode";
import { LEGACY_COOKIE, SESSION_COOKIE, cookieMaxAge, cookieOptions, newSession, nowSeconds, signSession } from "@/lib/session";
import { kvFromEnv } from "@/lib/kv";
import { clearLoginFailures, clientId, loginBlocked, recordLoginFailure, registerSession } from "@/lib/guard";

export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// POST { passcode } → starts a new signed session on this browser (lib/session.ts).
// Failed passcodes are rate-limited per network address and overall (lib/guard.ts).
export async function POST(req: Request) {
  const mode = authMode();
  if (mode === "misconfigured") return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  if (mode === "open-dev") return NextResponse.json({ ok: true });

  const kv = kvFromEnv();
  const client = await clientId(req.headers, sessionSecret()!);
  const limit = await loginBlocked(kv, client);
  if (limit.blocked) {
    const mins = Math.ceil(limit.retryAfterS / 60);
    return NextResponse.json(
      { error: `Too many wrong passcodes. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterS), "cache-control": "no-store" } },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { passcode?: unknown };
  const given = typeof body.passcode === "string" ? body.passcode : "";

  if (!sameString(await passcodeDigest(given), await passcodeDigest())) {
    await recordLoginFailure(kv, client);
    await sleep(800); // slows down guessing
    return NextResponse.json({ error: "Wrong passcode." }, { status: 401 });
  }

  const now = nowSeconds();
  const session = newSession(now);
  await clearLoginFailures(kv, client);
  await registerSession(kv, session.sid, req.headers.get("user-agent"), now * 1000);
  const res = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  res.cookies.set(SESSION_COOKIE, await signSession(session, sessionSecret()!), cookieOptions(cookieMaxAge(session, now)));
  res.cookies.set(LEGACY_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
