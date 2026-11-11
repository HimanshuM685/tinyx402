import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";

const off = () => NextResponse.json({ error: "auth_disabled", message: "NEON_AUTH_BASE_URL is not set" }, { status: 503 });

// All five verbs: the auth API is a proxy, and a missing export answers 405 instead of proxying.
export const { GET, POST, PUT, DELETE, PATCH } = auth
  ? auth.handler()
  : { GET: off, POST: off, PUT: off, DELETE: off, PATCH: off };
