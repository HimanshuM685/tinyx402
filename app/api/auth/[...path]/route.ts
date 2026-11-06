import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";

const off = () => NextResponse.json({ error: "auth_disabled", message: "NEON_AUTH_BASE_URL is not set" }, { status: 503 });

export const { GET, POST } = auth ? auth.handler() : { GET: off, POST: off };
