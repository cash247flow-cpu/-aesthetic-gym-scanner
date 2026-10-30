import { NextResponse } from "next/server";
import { AUTH_COOKIE, AUTH_MAX_AGE, NOT_CONFIGURED, authMode, authToken, sameString } from "@/lib/passcode";

export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// POST { passcode } → sets the sign-in cookie.
export async function POST(req: Request) {
  const mode = authMode();
  if (mode === "misconfigured") return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  if (mode === "open-dev") return NextResponse.json({ ok: true });
  const body = (await req.json().catch(() => ({}))) as { passcode?: unknown };
  const given = typeof body.passcode === "string" ? body.passcode : "";

  if (!sameString(await authToken(given), await authToken())) {
    await sleep(800); // slows down guessing
    return NextResponse.json({ error: "Wrong passcode." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await authToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_MAX_AGE,
  });
  return res;
}
