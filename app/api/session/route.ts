import { NextResponse, type NextRequest } from "next/server";
import { authMode, sessionSecret } from "@/lib/passcode";
import { SESSION_COOKIE, nowSeconds, verifySession } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET → this browser's session times, for the "This phone" card. No ids or secrets returned.
export async function GET(req: NextRequest) {
  if (authMode() === "open-dev") return NextResponse.json({ mode: "open-dev" }, { headers: { "cache-control": "no-store" } });
  const v = await verifySession(req.cookies.get(SESSION_COOKIE)?.value, sessionSecret() ?? "", nowSeconds());
  if (!v.ok) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const s = v.renewed ?? v.session;
  const iso = (t: number) => new Date(t * 1000).toISOString();
  return NextResponse.json({ signedInAt: iso(s.iat), idleExpiresAt: iso(s.exp), absoluteExpiresAt: iso(s.max) }, { headers: { "cache-control": "no-store" } });
}
