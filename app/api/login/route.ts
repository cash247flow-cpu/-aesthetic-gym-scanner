import { NextResponse } from "next/server";
import { NOT_CONFIGURED, authMode, passcodeDigest, sameString, sessionSecret } from "@/lib/passcode";
import { LEGACY_COOKIE, SESSION_COOKIE, cookieMaxAge, cookieOptions, newSession, nowSeconds, signSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// POST { passcode } → starts a new signed session on this browser (lib/session.ts).
export async function POST(req: Request) {
  const mode = authMode();
  if (mode === "misconfigured") return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  if (mode === "open-dev") return NextResponse.json({ ok: true });
  const body = (await req.json().catch(() => ({}))) as { passcode?: unknown };
  const given = typeof body.passcode === "string" ? body.passcode : "";

  if (!sameString(await passcodeDigest(given), await passcodeDigest())) {
    await sleep(800); // slows down guessing
    return NextResponse.json({ error: "Wrong passcode." }, { status: 401 });
  }

  const now = nowSeconds();
  const session = newSession(now);
  const res = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  res.cookies.set(SESSION_COOKIE, await signSession(session, sessionSecret()!), cookieOptions(cookieMaxAge(session, now)));
  res.cookies.set(LEGACY_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
