import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, cookieOptions, nowSeconds, verifySession } from "@/lib/session";
import { sessionSecret } from "@/lib/passcode";
import { kvFromEnv } from "@/lib/kv";
import { listSessions, revokeSession } from "@/lib/guard";

export const dynamic = "force-dynamic";
const noStore = { "cache-control": "no-store" };

async function current(req: NextRequest) {
  const secret = sessionSecret();
  const v = secret ? await verifySession(req.cookies.get(SESSION_COOKIE)?.value, secret, nowSeconds()) : null;
  return v?.ok ? v.session.sid : null;
}

// GET → devices signed in to this app (needs the session store; `available: false` without it).
export async function GET(req: NextRequest) {
  const kv = kvFromEnv();
  const devices = await listSessions(kv);
  if (devices === null) return NextResponse.json({ available: false }, { headers: noStore });
  const me = await current(req);
  return NextResponse.json(
    { available: true, devices: devices.map((d) => ({ id: d.sid, device: d.device, createdAt: d.createdAt, lastSeen: d.lastSeen, current: d.sid === me })) },
    { headers: noStore },
  );
}

// POST { id } signs out one device; POST { others: true } signs out every device except this one.
export async function POST(req: NextRequest) {
  const kv = kvFromEnv();
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; others?: unknown };
  const me = await current(req);
  const devices = await listSessions(kv);
  if (devices === null) return NextResponse.json({ error: "Device sign-out isn't set up yet." }, { status: 503, headers: noStore });
  const targets =
    body.others === true
      ? devices.filter((d) => d.sid !== me).map((d) => d.sid)
      : typeof body.id === "string" && /^[A-Za-z0-9_-]{10,64}$/.test(body.id) && devices.some((d) => d.sid === body.id)
        ? [body.id]
        : null;
  if (!targets) return NextResponse.json({ error: "Unknown device." }, { status: 400, headers: noStore });
  for (const sid of targets) await revokeSession(kv, sid);
  const res = NextResponse.json({ ok: true, signedOut: targets.length }, { headers: noStore });
  if (me && targets.includes(me)) res.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  return res;
}
