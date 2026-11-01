import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/passcode";

export const dynamic = "force-dynamic";

// POST → removes this browser's passcode cookie (used by "Delete everything on this phone").
// Behind the passcode gate like every API route.
export async function POST() {
  const res = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  res.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
