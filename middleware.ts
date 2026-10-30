import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, NOT_CONFIGURED, authMode, authToken, sameString } from "@/lib/passcode";
import { buildCsp, newNonce } from "@/lib/csp";

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
  if (mode === "open-dev" || PUBLIC.has(path)) return pass(req, dev);

  const cookie = req.cookies.get(AUTH_COOKIE)?.value ?? "";
  if (cookie && sameString(cookie, await authToken())) return pass(req, dev);

  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: "Enter the app passcode first." }, { status: 401 });
  }
  const login = req.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|exercises/|apple-icon|manifest.webmanifest|robots.txt|sw.js).*)"],
};
