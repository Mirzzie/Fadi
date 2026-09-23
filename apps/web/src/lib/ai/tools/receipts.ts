import "server-only";

import { createWorkItemsRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";
import type { FadiTool, FadiToolContext, FadiToolResult, ToolOutcome } from "./types";

/**
 * A receipt for anything Fadi does that the person would want to see afterwards.
 *
 * Reads are not recorded. Answering a question leaves nothing behind to account for, and a
 * durable row for every lookup would bury the three things that actually happened under a
 * hundred that did not matter. Writes and anything reaching outside Fadi are recorded before
 * they run, so a crash still leaves the attempt visible rather than silence.
 *
 * THE CONTRACT, stated so nobody has to infer it: a receipt records a consequential action and
 * outlives the work it served, but writing one never blocks the action the person asked for. A
 * database that cannot take the receipt loses the receipt, not the work — and says so loudly in
 * the log. So this is a complete record of what Fadi did whenever the database was reachable,
 * and it is not a ledger that can prove nothing else happened.
 *
 * The receipt never claims more than the tool did. A tool that stopped to ask a question, or
 * refused, or failed, says so on its own result, and the status follows that word — not the
 * absence of a thrown error. "Drafted and saved a document — drafting isn't available this
 * turn", recorded as done, is the shape of lie this exists to prevent.
 */

/** How an outcome is filed. Only `performed` may be recorded as done. */
const STATUS_OF: Record<ToolOutcome, "done" | "needs_input" | "refused" | "failed"> = {
  performed: "done",
  needs_input: "needs_input",
  refused: "refused",
  failed: "failed",
};
const MAX_RECEIPT = 300;

/** A lost receipt is a hole in the account of what Fadi did, so it is an error, not a shrug. */
function report(stage: "start" | "finish", tool: string, userId: string, err: unknown): null {
  logger.error("fadi.receipt.lost", {
    stage,
    tool,
    userId,
    error: err instanceof Error ? err.message : "unknown",
  });
  return null;
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_RECEIPT);
}

export async function runWithReceipt(
  tool: FadiTool,
  args: Record<string, unknown>,
  ctx: FadiToolContext
): Promise<FadiToolResult> {
  if (tool.risk === "read") return tool.execute(args, ctx);
  const consequential = tool;

  const work = createWorkItemsRepository(getDatabase());
  const execution = await work
    .startExecution(ctx.userId, {
      action: consequential.effect,
      risk: consequential.risk,
      surface: ctx.surface ?? "chat",
      workItemId: ctx.workItemId ?? null,
    })
    .catch((err) => {
      // A missing receipt must never stop the work the person asked for.
      logger.warn("fadi.receipt.start_failed", {
        userId: ctx.userId,
        tool: consequential.name,
        error: err instanceof Error ? err.message : "unknown",
      });
      return null;
    });

  try {
    const result = await consequential.execute(args, ctx);
    // The type makes `outcome` compulsory for these tools; this is the runtime floor for a
    // caller that got past it. An accountability surface fails closed: unknown is not done.
    const outcome: ToolOutcome = result.isError ? "failed" : (result.outcome ?? "failed");
    const unreported = !result.isError && !result.outcome;
    if (execution) {
      await work
        .finishExecution(ctx.userId, execution.id, {
          status: STATUS_OF[outcome],
          receipt: unreported ? "Fadi could not tell whether this ran." : oneLine(result.summary),
          error: unreported
            ? `${consequential.name} reported no outcome`
            : outcome === "failed"
              ? oneLine(result.summary)
              : null,
        })
        .catch((err) => report("finish", consequential.name, ctx.userId, err));
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
        .catch((failure) => report("finish", consequential.name, ctx.userId, failure));
    }
    throw err;
  }
}
