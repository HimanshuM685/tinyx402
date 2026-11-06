import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/auth/server";
import { getOrCreateWallet, MAX_PLATFORM_PAYMENT } from "@/lib/wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Signed-in user's platform wallet (created on first call). Web app only; the x402 API needs no login. */
export async function GET() {
  if (!auth) return NextResponse.json({ user: null, auth: false }, { status: 503 }); // Google login not configured
  const user = await currentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  try {
    const address = await getOrCreateWallet(user.id);
    return NextResponse.json({ user: { name: user.name, email: user.email, image: user.image }, address, maxPerPayment: String(MAX_PLATFORM_PAYMENT) });
  } catch (e) {
    // Signed in, but the wallet store is unreachable — DATABASE_URL unset, or `pnpm db:push` never run.
    // Distinct from 401 on purpose: the UI must not redraw this as "signed out".
    console.error("wallet unavailable:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "wallet_unavailable", message: "Signed in, but your wallet could not be loaded. The server's wallet storage is not configured." }, { status: 500 });
  }
}
