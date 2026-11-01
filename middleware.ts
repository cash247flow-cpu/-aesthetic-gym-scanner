import { NextResponse, type NextRequest } from "next/server";
import { NOT_CONFIGURED, authMode, sessionSecret } from "@/lib/passcode";
import { LEGACY_COOKIE, SESSION_COOKIE, cookieMaxAge, cookieOptions, nowSeconds, signSession, verifySession } from "@/lib/session";
import { buildCsp, newNonce } from "@/lib/csp";
import { kvFromEnv } from "@/lib/kv";
import { checkSession } from "@/lib/guard";

// Pages that must work before signing in.
const PUBLIC = new Set(["/login", "/api/login"]);

/** Continue to the page or route, with a per-request CSP nonce for Next's scripts. */
function pass(req: NextRequest, dev: boolean) {
  const nonce = newNonce();
  const csp = buildCsp(nonce, dev);
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

/** The old year-long cookie is no longer accepted; tidy it away when a browser still sends it. */
function dropLegacy(req: NextRequest, res: NextResponse) {
  if (req.cookies.has(LEGACY_COOKIE)) res.cookies.set(LEGACY_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

// Everything except static files goes through here. Fails closed (see lib/passcode.ts).
export async function middleware(req: NextRequest) {
  const mode = authMode();
  const dev = process.env.NODE_ENV === "development";
  const path = req.nextUrl.pathname;

  if (mode === "misconfigured") {
    return path.startsWith("/api/")
      ? NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 })
      : new NextResponse(NOT_CONFIGURED, { status: 503, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  }
  if (mode === "open-dev" || PUBLIC.has(path)) return dropLegacy(req, pass(req, dev));

  const now = nowSeconds();
  const v = await verifySession(req.cookies.get(SESSION_COOKIE)?.value, sessionSecret()!, now);
  // A device signed out from another device (per-device sign-out) is refused here.
  const revoked = v.ok && (await checkSession(kvFromEnv(), v.session.sid, req.headers.get("user-agent"), !!v.renewed)) === "revoked";
  if (v.ok && !revoked) {
    const res = dropLegacy(req, pass(req, dev));
    // Using the app renews the 30-day idle limit (at most once a day, never past 90 days).
    if (v.renewed) res.cookies.set(SESSION_COOKIE, await signSession(v.renewed, sessionSecret()!), cookieOptions(cookieMaxAge(v.renewed, now)));
    return res;
  }

  const res = path.startsWith("/api/")
    ? NextResponse.json({ error: "Enter the app passcode first." }, { status: 401 })
    : (() => {
        const login = req.nextUrl.clone();
        login.pathname = "/login";
        login.search = revoked ? "?revoked=1" : !v.ok && v.reason === "expired" ? "?expired=1" : "";
        return NextResponse.redirect(login);
      })();
  if (req.cookies.has(SESSION_COOKIE)) res.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  return dropLegacy(req, res);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|exercises/|apple-icon|manifest.webmanifest|robots.txt|sw.js).*)"],
};
