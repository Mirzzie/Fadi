import "server-only";

import { createUsersRepository } from "@careeros/database";

import { getCurrentAuthUser, type AuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { verifyExtensionToken } from "@/lib/extension/token";

/**
 * Resolve the user for an /api/extension/* call. Two paths, in order:
 *  1. A normal Fadi session cookie (works when the request carries it — same-origin calls).
 *  2. An `Authorization: Bearer <extension-token>` header — the extension's path, because a
 *     chrome-extension:// popup can't send Fadi's SameSite session cookie cross-site.
 * Returns null when neither identifies a user.
 */
export async function getExtensionUser(req: Request): Promise<AuthUser | null> {
  const session = await getCurrentAuthUser();
  if (session) return session;

  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
  const userId = verifyExtensionToken(token);
  if (!userId) return null;

  const user = await createUsersRepository(getDatabase()).findById(userId);
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    externalAuthProvider: "better_auth",
    externalAuthUserId: user.id,
  };
}
