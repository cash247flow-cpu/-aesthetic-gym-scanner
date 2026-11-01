import { NextResponse } from "next/server";
import { LEGACY_COOKIE, SESSION_COOKIE, cookieOptions } from "@/lib/session";

export const dynamic = "force-dynamic";

// POST → signs this browser out (removes its session cookie). Behind the passcode gate.
export async function POST() {
  const res = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  res.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  res.cookies.set(LEGACY_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
