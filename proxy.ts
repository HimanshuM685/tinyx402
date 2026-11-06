import { NextResponse, type NextRequest } from "next/server";
import { processAuthMiddleware, NEON_AUTH_HEADER_MIDDLEWARE_NAME } from "@neon/auth/server";
import { authConfig } from "./lib/auth/server"; // relative: scripts/selftest.ts imports this file without the tsconfig alias

/**
 * Google returns to `?neon_auth_session_verifier=…` and only the middleware exchanges that
 * verifier for the session cookie, so without this file sign-in silently does nothing.
 *
 * Every page here is public — the x402 API is what's paid for, not the site — so this skips
 * `auth.middleware()`, whose job is route protection, and drives the processor directly:
 * exchange the verifier, refresh the session cookie, never redirect. That also means no list
 * of public paths to keep in sync with `app/`, and no page that can be forgotten.
 *
 * `loginUrl` is off-origin on purpose: the processor allows its path *before* exchanging the
 * verifier, so any same-origin value would break sign-in from that one page. Nothing ever
 * redirects there.
 */
const NO_LOGIN_PAGE = "https://login.invalid/unused";

export default async function proxy(request: NextRequest) {
  if (!authConfig) return NextResponse.next(); // Google login not configured

  const result = await processAuthMiddleware({
    request,
    pathname: request.nextUrl.pathname,
    skipRoutes: [],
    loginUrl: NO_LOGIN_PAGE,
    baseUrl: authConfig.baseUrl,
    cookieSecret: authConfig.cookies.secret,
    sameSite: authConfig.cookies.sameSite,
  });

  if (result.action === "redirect_oauth") {
    const res = NextResponse.redirect(result.redirectUrl);
    for (const cookie of result.cookies) res.headers.append("Set-Cookie", cookie);
    return res;
  }

  // "redirect_login" only means "no session here", which is fine on a public page. Its cookies
  // still matter: they clear session data left behind by an expired token.
  const headers = new Headers(request.headers);
  if (result.action === "allow") headers.set(NEON_AUTH_HEADER_MIDDLEWARE_NAME, "true");
  const res = NextResponse.next({ request: { headers } });
  for (const cookie of result.cookies ?? []) res.headers.append("Set-Cookie", cookie);
  return res;
}

export const config = {
  // /api/* is out: the x402 API never reads a session, and a session round-trip per paid
  // request would be pure latency. The verifier only ever lands on a page navigation.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
