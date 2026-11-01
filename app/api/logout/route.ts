import { NextResponse, type NextRequest } from "next/server";
import { LEGACY_COOKIE, SESSION_COOKIE, cookieOptions, nowSeconds, verifySession } from "@/lib/session";
import { sessionSecret } from "@/lib/passcode";
import { kvFromEnv } from "@/lib/kv";
import { revokeSession } from "@/lib/guard";

export const dynamic = "force-dynamic";

// POST → signs this browser out: removes its session cookie and, when the session store is set
// up, marks the session as signed out so a copied cookie can't be reused. Behind the passcode gate.
export async function POST(req: NextRequest) {
  const secret = sessionSecret();
  const v = secret ? await verifySession(req.cookies.get(SESSION_COOKIE)?.value, secret, nowSeconds()) : null;
  if (v?.ok) await revokeSession(kvFromEnv(), v.session.sid);
  const res = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  res.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  res.cookies.set(LEGACY_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
