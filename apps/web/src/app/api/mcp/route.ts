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

/**
 * FadiOS MCP endpoint — exposes FadiOS's career tools to any MCP client
 * (Claude Code, OpenClaw, Cursor, …) over Streamable HTTP (JSON-RPC POST).
 *
 * Auth (self-host v1): a single Bearer token mapped to one user via
 * FADIOS_MCP_TOKEN + FADIOS_MCP_USER_ID. This is the local-first "Claude Code with
 * FadiOS" path; hosted multi-tenant (per-user tokens in the DB) layers on later
 * without changing the protocol core.
 */

export const dynamic = "force-dynamic";

/** Resolve the caller's user id from the Bearer token. Null = unauthorized. */
function resolveUserId(req: Request): string | null {
  const expected = serverEnv.FADIOS_MCP_TOKEN;
  const userId = serverEnv.FADIOS_MCP_USER_ID;
  if (!expected || !userId) return null; // MCP not configured on this instance

  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  // length check first so a constant-time-ish compare doesn't leak via length only
  if (!token || token.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0 ? userId : null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request): Promise<Response> {
  const userId = resolveUserId(req);
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
