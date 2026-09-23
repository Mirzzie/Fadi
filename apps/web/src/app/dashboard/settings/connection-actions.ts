"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createMcpConnectionsRepository } from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { encryptSecret } from "@/lib/security/crypto";
import { probeServer } from "@/lib/mcp/client";

/**
 * Connecting another tool to Fadi.
 *
 * Adding a server does two things at once, on purpose: it saves the connection AND asks the
 * server what it can do. A connection that has never been reached is not a connection, and a
 * list of servers whose state nobody has checked is the "green dot that means nothing" problem
 * that the job sources already taught us.
 */

type Result = { ok: true; tools: number } | { ok: false; error: string };

const input = z.object({
  label: z.string().trim().min(1).max(60),
  url: z.string().trim().url().max(500),
  token: z.string().trim().max(500).optional(),
  allowToAct: z.boolean().optional(),
});

/** `Deploy Bot` → `deploy-bot`, which namespaces its tools as `deploy-bot.<tool>`. */
function slugOf(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "server"
  );
}

export async function connectServerAction(raw: {
  label: string;
  url: string;
  token?: string;
  allowToAct?: boolean;
}): Promise<Result> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Give it a name and a valid URL." };

  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const { label, url, token, allowToAct } = parsed.data;

  // Ask before saving: a server that cannot be reached, or refuses Fadi, is reported as that
  // rather than stored as "connected" and discovered later by a plan that needed it.
  const probe = await probeServer(url, token ?? null);
  if (!probe.ok) return { ok: false, error: probe.detail };

  try {
    const repo = createMcpConnectionsRepository(getDatabase());
    const connection = await repo.upsert(user.id, {
      label,
      slug: slugOf(label),
      url,
      ...(token ? { authCiphertext: encryptSecret(token) } : {}),
      autoApprove: Boolean(allowToAct),
    });
    await repo.recordProbe(user.id, connection.id, { status: "connected", tools: probe.tools });

    revalidatePath("/dashboard/settings");
    return { ok: true, tools: probe.tools.length };
  } catch {
    return { ok: false, error: "Could not save that connection." };
  }
}

/** Ask again what it can do, and record how the conversation went either way. */
export async function recheckServerAction(id: string): Promise<Result> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Unknown connection." };

  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const repo = createMcpConnectionsRepository(getDatabase());
  const connection = await repo.get(user.id, id);
  if (!connection) return { ok: false, error: "Unknown connection." };

  const { decryptSecret } = await import("@/lib/security/crypto");
  const token = connection.authCiphertext ? decryptSecret(connection.authCiphertext) : null;
  const probe = await probeServer(connection.url, token);

  await repo.recordProbe(user.id, id, {
    status: probe.ok ? "connected" : probe.status,
    detail: probe.ok ? "" : probe.detail,
    ...(probe.ok ? { tools: probe.tools } : {}),
  });
  revalidatePath("/dashboard/settings");

  return probe.ok ? { ok: true, tools: probe.tools.length } : { ok: false, error: probe.detail };
}

export async function setServerMayActAction(id: string, mayAct: boolean): Promise<{ ok: boolean }> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false };

  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };

  await createMcpConnectionsRepository(getDatabase()).setAutoApprove(user.id, id, mayAct);
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function disconnectServerAction(id: string): Promise<{ ok: boolean }> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false };

  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };

  const removed = await createMcpConnectionsRepository(getDatabase()).remove(user.id, id);
  revalidatePath("/dashboard/settings");
  return { ok: removed };
}
