import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/lib/env.server";

// A purpose-built bearer token for the browser extension. It is NOT a Better Auth session
// cookie and cannot stand in for one — it only proves "this user connected an extension",
// so the extension (which can't send SameSite session cookies from its own origin) can call
// the /api/extension/* endpoints. Signed with the app secret via HMAC-SHA256.
const DEV_SECRET = "local-development-better-auth-secret-change-me";
const SECRET = serverEnv.BETTER_AUTH_SECRET ?? DEV_SECRET;
const TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

/** Issue a signed extension token for a Fadi user id. */
export function signExtensionToken(userId: string): string {
  const payload = b64url(JSON.stringify({ uid: userId, exp: Date.now() + TTL_MS }));
  return `${payload}.${sign(payload)}`;
}

/** Verify a token and return its user id, or null if invalid/expired/tampered. */
export function verifyExtensionToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const parts = token.trim().split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = sign(payload);
  // Constant-time comparison; lengths must match for timingSafeEqual.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      uid?: unknown;
      exp?: unknown;
    };
    if (typeof data.uid !== "string" || typeof data.exp !== "number") return null;
    if (Date.now() > data.exp) return null;
    return data.uid;
  } catch {
    return null;
  }
}
