import "server-only";

import { createWorkItemsRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";
import type { FadiTool, FadiToolContext, FadiToolResult } from "./types";

/**
 * A receipt for anything Fadi does that the person would want to see afterwards.
 *
 * Reads are not recorded. Answering a question leaves nothing behind to account for, and a
 * durable row for every lookup would bury the three things that actually happened under a
 * hundred that did not matter. Writes and anything reaching outside Fadi are recorded before
 * they run, so a crash still leaves the attempt visible rather than silence.
 *
 * The receipt never claims more than the tool returned: its own summary, trimmed to a line.
 */
const MAX_RECEIPT = 300;

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_RECEIPT);
}

export async function runWithReceipt(
  tool: FadiTool,
  args: Record<string, unknown>,
  ctx: FadiToolContext
): Promise<FadiToolResult> {
  if (tool.risk === "read") return tool.execute(args, ctx);

  const work = createWorkItemsRepository(getDatabase());
  const execution = await work
    .startExecution(ctx.userId, {
      action: tool.effect ?? tool.name,
      risk: tool.risk,
      surface: ctx.surface ?? "chat",
      workItemId: ctx.workItemId ?? null,
    })
    .catch((err) => {
      // A missing receipt must never stop the work the person asked for.
      logger.warn("fadi.receipt.start_failed", {
        userId: ctx.userId,
        tool: tool.name,
        error: err instanceof Error ? err.message : "unknown",
      });
      return null;
    });

  try {
    const result = await tool.execute(args, ctx);
    if (execution) {
      await work
        .finishExecution(ctx.userId, execution.id, {
          // A tool that reports its own failure did not succeed, whatever it returned.
          status: result.isError ? "failed" : "done",
          receipt: oneLine(result.summary),
          error: result.isError ? oneLine(result.summary) : null,
        })
        .catch(() => {});
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    if (execution) {
      await work
        .finishExecution(ctx.userId, execution.id, {
          status: "failed",
          receipt: "It did not finish.",
          error: oneLine(message),
        })
        .catch(() => {});
    }
    throw err;
  }
}
