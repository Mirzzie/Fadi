"use server";

import { revalidatePath } from "next/cache";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { logger } from "@/lib/observability/logger";
import { issueMcpToken, revokeMcpToken, type McpTokenView } from "@/lib/mcp/tokens";

const PATH = "/dashboard/settings";

export async function createMcpToken(input: {
  name: string;
}): Promise<{ ok: true; token: string; view: McpTokenView } | { ok: false; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  try {
    const { token, view } = await issueMcpToken(user.id, input.name);
    logger.info("mcp.token_created", { userId: user.id, prefix: view.prefix });
    revalidatePath(PATH);
    return { ok: true, token, view };
  } catch (error) {
    logger.error("mcp.token_create_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Couldn't create the token. Please try again." };
  }
}

export async function revokeMcpTokenAction(input: { id: string }): Promise<{ ok: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };
  const ok = await revokeMcpToken(user.id, input.id);
  if (ok) revalidatePath(PATH);
  return { ok };
}
