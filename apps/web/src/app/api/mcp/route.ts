import { getUserDocGenerate } from "@/lib/ai/user-generate";
import { executeFadiTool, getFadiTools } from "@/lib/ai/tools/registry";
import type { FadiToolContext } from "@/lib/ai/tools/types";
import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/observability/logger";
import {
  handleMcpMessage,
  toMcpTool,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type McpDeps,
} from "@/lib/mcp/server";
import { envTokenMatches, resolveMcpToken } from "@/lib/mcp/tokens";

/**
 * Fadi MCP endpoint — exposes Fadi's career tools to any MCP client
 * (Claude Code, OpenClaw, Cursor, …) over Streamable HTTP (JSON-RPC POST).
 *
 * Auth accepts either:
 *  - a per-user personal access token minted in the app (multi-user / hosted), or
 *  - the single self-host env token (FADIOS_MCP_TOKEN + FADIOS_MCP_USER_ID).
 * Both resolve to the user the tools act as. MCP is off until at least one is set.
 */

export const dynamic = "force-dynamic";

function bearer(req: Request): string {
  return (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

/** Resolve the caller's user id from the Bearer token. Null = unauthorized. */
async function resolveUserId(req: Request): Promise<string | null> {
  const token = bearer(req);
  if (!token) return null;

  // Self-host single env token (fast path).
  if (serverEnv.FADIOS_MCP_USER_ID && envTokenMatches(token, serverEnv.FADIOS_MCP_TOKEN)) {
    return serverEnv.FADIOS_MCP_USER_ID;
  }
  // Per-user personal access token (multi-user).
  return resolveMcpToken(token);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request): Promise<Response> {
  const userId = await resolveUserId(req);
  if (!userId) {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } }, 401);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }

  // Build the execution context once per request (userId + the user's own AI provider).
  const generate = await getUserDocGenerate(userId);
  const ctx: FadiToolContext = { userId, generate: generate ?? undefined };
  const deps: McpDeps = {
    listTools: () => getFadiTools().map(toMcpTool),
    callTool: (name, args) => executeFadiTool(name, args, ctx),
  };

  const messages = Array.isArray(payload) ? (payload as JsonRpcRequest[]) : [payload as JsonRpcRequest];
  const responses: JsonRpcResponse[] = [];
  for (const message of messages) {
    if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
      responses.push({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } });
      continue;
    }
    const res = await handleMcpMessage(message, deps);
    if (res) responses.push(res);
  }

  logger.info("mcp.request", {
    userId,
    methods: messages.map((m) => m?.method).filter(Boolean).join(","),
    responded: responses.length,
  });

  // Only notifications → 202 with no body (per Streamable HTTP).
  if (responses.length === 0) return new Response(null, { status: 202 });
  return json(Array.isArray(payload) ? responses : responses[0]);
}

/** GET is reserved for a server-initiated SSE stream, which this v1 doesn't open. */
export async function GET(): Promise<Response> {
  return json(
    { jsonrpc: "2.0", id: null, error: { code: -32601, message: "Use POST (JSON-RPC). SSE streaming isn't enabled on this endpoint." } },
    405,
  );
}
