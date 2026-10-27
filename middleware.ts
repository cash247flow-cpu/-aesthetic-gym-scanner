import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authToken, passcodeRequired, sameString } from "@/lib/passcode";

// Everything except the login screen and static files needs the passcode cookie.
export async function middleware(req: NextRequest) {
  if (!passcodeRequired()) return NextResponse.next();
  const cookie = req.cookies.get(AUTH_COOKIE)?.value ?? "";
  if (cookie && sameString(cookie, await authToken())) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Enter the app passcode first." }, { status: 401 });
  }
  const login = req.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/((?!login|api/login|_next/static|_next/image|favicon.ico|icons/|exercises/|apple-icon|manifest.webmanifest|sw.js).*)",
  ],
};
