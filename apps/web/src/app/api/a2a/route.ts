import { createWorkItemsRepository } from "@careeros/database";

import {
  type HeldChange,
  handleA2AMessage,
  A2A_VERSION,
  A2A_VERSION_NOT_SUPPORTED,
  type A2ADeps,
  type JsonRpcRequest,
  type PlanView,
} from "@/lib/a2a/server";
import { getDatabase } from "@/lib/database/client";
import { serverEnv } from "@/lib/env.server";
import { envTokenMatches, resolveMcpToken } from "@/lib/mcp/tokens";
import { logger } from "@/lib/observability/logger";

/**
 * Fadi A2A endpoint — a voice client (Buddy) hands Fadi a piece of work and follows it.
 *
 * JSON-RPC 2.0 over POST, A2A 1.0 (`a2a.SendMessage`, `a2a.GetTask`, `a2a.CancelTask`). The same
 * bearer tokens as /api/mcp resolve the user, and the endpoint is off until one does. Tasks are
 * work-kernel plans; the rules live in lib/a2a/server.ts and lib/work, not here.
 */

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "A2A-Version": A2A_VERSION,
    },
  });
}

async function resolveUserId(req: Request): Promise<string | null> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  if (serverEnv.FADIOS_MCP_USER_ID && envTokenMatches(token, serverEnv.FADIOS_MCP_TOKEN)) {
    return serverEnv.FADIOS_MCP_USER_ID;
  }
  return resolveMcpToken(token);
}

function depsFor(userId: string): A2ADeps {
  const work = () => createWorkItemsRepository(getDatabase());

  async function plan(id: string): Promise<PlanView | null> {
    const item = await work().get(userId, id);
    if (!item || item.kind !== "plan") return null;
    const steps = await work().listChildren(userId, id);
    return {
      id: item.id,
      title: item.title,
      status: item.status,
      goalId: item.parentId,
      steps: steps.map((step) => ({
        title: step.title,
        status: step.status,
        reason: step.reason,
        detail: step.detail,
        personal: !step.refs.some((ref) => ref.type === "capability"),
      })),
    };
  }

  return {
    plan,
    resolve: async (text) =>
      (await import("@/lib/work/intent")).resolveIntent(userId, text.slice(0, 200)),
    open: async (template, refs) =>
      (await import("@/lib/work/run-plan")).startPlan(userId, template, refs, { status: "open" }),
    // Same press as "Take up a plan" on Today: open → active, and never two plans running.
    approve: async (id) => {
      const current = await work().get(userId, id);
      if (!current || current.kind !== "plan" || current.status !== "open") {
        return { ok: false, reason: "That plan is not waiting for approval." };
      }
      const busy = await (await import("@/lib/work/run-plan")).runningPlan(userId);
      if (busy)
        return {
          ok: false,
          reason: `Fadi is already working on "${busy.title}". Finish or stop that first.`,
        };
      await work().setStatus(userId, id, "active");
      return { ok: true };
    },
    advance: async (id) => {
      const outcome = await (await import("@/lib/work/run-plan")).advancePlan(userId, id, "agent");
      return {
        state: outcome.state,
        summary: "summary" in outcome ? outcome.summary : undefined,
        reason: "reason" in outcome ? outcome.reason : undefined,
      };
    },
    // The person's own step ("you submit"): Fadi only records that they said it is done.
    markPersonalDone: async (id) => {
      const steps = await work().listChildren(userId, id);
      const next = steps.find((step) => step.status !== "done" && step.status !== "dropped");
      if (!next || next.refs.some((ref) => ref.type === "capability")) {
        return { ok: false, reason: "The next step is one Fadi does. Say continue instead." };
      }
      await work().setStatus(userId, next.id, "done");
      return { ok: true };
    },
    stop: async (id) => {
      await work().setStatus(userId, id, "dropped", { reason: "Stopped by voice." });
    },
    claim: async (id) => {
      const { getKv } = await import("@/lib/kv/store");
      const kv = getKv();
      const key = `a2a:busy:${userId}:${id}`;
      const token = crypto.randomUUID();
      // Longer than any one step should take; released as soon as the action returns.
      if (!(await kv.setNx(key, token, 180))) return null;
      return async () => {
        await kv.deleteIfValue(key, token);
      };
    },
    converse: async (text, contextId) => {
      const { runVoiceTurn } = await import("@/lib/agent/voice-turn");
      const turn = await runVoiceTurn(userId, { text, contextId });
      return {
        speech: turn.speech,
        contextId: turn.contextId,
        pending: turn.pending ? { id: turn.pending.id, readBack: turn.pending.readBack } : null,
      };
    },
    heldChange: async (id) => {
      const { getPendingAction } = await import("@/lib/agent/voice-turn");
      const { getKv } = await import("@/lib/kv/store");
      const waiting = await getPendingAction(userId, id);
      if (waiting) {
        return {
          id,
          contextId: waiting.contextId,
          readBack: waiting.readBack,
          state: "waiting",
          speech: `Fadi will ${waiting.readBack}.`,
        };
      }
      // What became of it, so a client polling the task hears the outcome, not "not found".
      const done = await getKv().get(`a2a:change:${userId}:${id}`);
      return done ? (JSON.parse(done) as HeldChange) : null;
    },
    confirmChange: async (id) => {
      const { confirmPendingAction, getPendingAction } = await import("@/lib/agent/voice-turn");
      const { getKv } = await import("@/lib/kv/store");
      const before = await getPendingAction(userId, id);
      const result = await confirmPendingAction(userId, id);
      if (before) {
        const record: HeldChange = {
          id,
          contextId: before.contextId,
          readBack: before.readBack,
          state: result.ok ? "done" : "failed",
          speech: result.speech,
        };
        await getKv().set(`a2a:change:${userId}:${id}`, JSON.stringify(record), 3600);
      }
      return result;
    },
    cancelChange: async (id) => {
      const { cancelPendingAction, getPendingAction } = await import("@/lib/agent/voice-turn");
      const { getKv } = await import("@/lib/kv/store");
      const before = await getPendingAction(userId, id);
      await cancelPendingAction(userId, id);
      if (before) {
        const record: HeldChange = {
          id,
          contextId: before.contextId,
          readBack: before.readBack,
          state: "cancelled",
          speech: "Cancelled. Nothing was changed.",
        };
        await getKv().set(`a2a:change:${userId}:${id}`, JSON.stringify(record), 3600);
      }
    },
    seen: async (messageId) => {
      const { getKv } = await import("@/lib/kv/store");
      // First sight claims it for ten minutes; anything later is the same message again.
      return !(await getKv().setNx(`a2a:msg:${userId}:${messageId.slice(0, 200)}`, "1", 600));
    },
  };
}

export async function POST(req: Request): Promise<Response> {
  const version = req.headers.get("a2a-version");
  if (version && version !== A2A_VERSION) {
    return json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: A2A_VERSION_NOT_SUPPORTED, message: "Supported A2A version: 1.0" },
      },
      400
    );
  }
  const userId = await resolveUserId(req);
  if (!userId) {
    return json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } },
      401
    );
  }
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }
  // A voice client polls GetTask every 30 s; sixty requests a minute is generous for that and
  // stops a leaked token from hammering the work kernel.
  const { consumeRateLimit } = await import("@/lib/security/rate-limit");
  const rate = await consumeRateLimit({ key: `a2a:${userId}`, limit: 60, windowMs: 60_000 });
  if (!rate.allowed) {
    return json(
      { jsonrpc: "2.0", id: null, error: { code: -32029, message: "Too many requests" } },
      429
    );
  }
  const message = payload as JsonRpcRequest;
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return json(
      { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } },
      400
    );
  }
  const response = await handleA2AMessage(message, depsFor(userId));
  // Method names only: the person's words and plan contents stay out of the log.
  logger.info("a2a.request", {
    userId,
    method: message.method,
    failed: Boolean(response && "error" in response),
  });
  return response ? json(response) : new Response(null, { status: 202 });
}

export async function GET(): Promise<Response> {
  return json(
    { jsonrpc: "2.0", id: null, error: { code: -32601, message: "Use POST (JSON-RPC)." } },
    405
  );
}
