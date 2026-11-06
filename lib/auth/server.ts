import "server-only";
import { createNeonAuth } from "@neon/auth/next/server";

// Google login for the web app only. The x402 API (/api/<chain>/v1/*) never checks a session.
export const authConfig =
  process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET
    ? {
        baseUrl: process.env.NEON_AUTH_BASE_URL,
        cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET, sameSite: "lax" as const }, // lax: OAuth return is a cross-site navigation
      }
    : null;

export const auth = authConfig ? createNeonAuth(authConfig) : null;

export async function currentUser() {
  if (!auth) return null;
  const { data } = await auth.getSession();
  return data?.user ?? null;
}
