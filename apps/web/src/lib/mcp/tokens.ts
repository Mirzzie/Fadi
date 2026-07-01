import { createHash, randomBytes } from "node:crypto";

/**
 * MCP personal access tokens (Fadi-as-Lego, multi-user). The raw token is shown
 * once at creation; we persist only its SHA-256 hash. A presented token is resolved
 * to its owning user by hashing and looking up the active record.
 *
 * Pure helpers (generateRawToken / hashToken / tokenPrefix / envTokenMatches) are
 * unit-testable; the DB-backed functions load the repo dynamically.
 */

const RAW_PREFIX = "fos_";

/** A new high-entropy token, e.g. "fos_3kJ9…". Shown to the user once, never stored raw. */
export function generateRawToken(): string {
  return RAW_PREFIX + randomBytes(30).toString("base64url");
}

/** SHA-256 hex of a token — what we store and look up by. Deterministic. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw.trim()).digest("hex");
}

/** A short, safe-to-display prefix (the rest stays secret). */
export function tokenPrefix(raw: string): string {
  return raw.slice(0, 12);
}

/** Constant-time-ish compare for the self-host single env token. */
export function envTokenMatches(presented: string, expected?: string | null): boolean {
  if (!expected || !presented || presented.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < presented.length; i++) diff |= presented.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export type McpTokenView = {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

function toView(row: {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}): McpTokenView {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function repo() {
  const { createMcpTokensRepository } = await import("@careeros/database");
  const { getDatabase } = await import("@/lib/database/client");
  return createMcpTokensRepository(getDatabase());
}

/** Issue a new token for a user. Returns the RAW token once (and never again). */
export async function issueMcpToken(
  userId: string,
  name: string,
): Promise<{ token: string; view: McpTokenView }> {
  const raw = generateRawToken();
  const created = await (await repo()).create(userId, {
    name: name.trim() || "MCP token",
    tokenHash: hashToken(raw),
    prefix: tokenPrefix(raw),
  });
  return { token: raw, view: toView(created) };
}

export async function listMcpTokens(userId: string): Promise<McpTokenView[]> {
  const rows = await (await repo()).listForUser(userId);
  return rows.map(toView);
}

export async function revokeMcpToken(userId: string, id: string): Promise<boolean> {
  return (await repo()).revoke(userId, id);
}

/** Resolve a presented raw token to its owning user id (or null). Stamps last-used. */
export async function resolveMcpToken(raw: string): Promise<string | null> {
  if (!raw?.startsWith(RAW_PREFIX)) return null;
  const r = await repo();
  const record = await r.findActiveByHash(hashToken(raw));
  if (!record) return null;
  void r.touchLastUsed(record.id).catch(() => {});
  return record.userId;
}
