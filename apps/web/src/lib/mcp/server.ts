/**
 * Fadi as an MCP server — the "Lego connector" that lets any agentic AI client
 * (Claude Code, OpenClaw, Cursor, …) use Fadi's career capabilities as tools.
 *
 * This is the protocol layer only: it maps Fadi's existing agent tools to the
 * Model Context Protocol and dispatches JSON-RPC messages. It is transport- and
 * auth-agnostic on purpose — the route handler injects how to list/call tools (so
 * this stays pure and unit-testable, and the same core can later serve a hosted
 * multi-tenant deployment or a self-hosted single-user one).
 *
 * Implements the minimal surface a client needs: initialize, tools/list,
 * tools/call, ping (plus notifications, which get no response).
 */

import type { FadiTool, FadiToolResult } from "@/lib/ai/tools/types";

export const MCP_PROTOCOL_VERSION = "2025-06-18";
export const MCP_SERVER_INFO = { name: "Fadi", title: "Fadi — your honest career mentor", version: "0.1.0" };

/** An MCP tool definition (what tools/list returns). */
export type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

/** Map a Fadi tool to an MCP tool. Our `parameters` is already JSON Schema. */
export function toMcpTool(tool: FadiTool): McpTool {
  const schema = (tool.parameters ?? { type: "object", properties: {} }) as Record<string, unknown>;
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: schema.type ? schema : { type: "object", properties: {}, ...schema },
  };
}

/** Map a Fadi tool result to an MCP tools/call result. */
export function toMcpToolResult(result: FadiToolResult): {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
} {
  const out: ReturnType<typeof toMcpToolResult> = {
    content: [{ type: "text", text: result.summary || "(no result)" }],
  };
  if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) {
    out.structuredContent = result.data as Record<string, unknown>;
  }
  return out;
}

// ── JSON-RPC 2.0 ────────────────────────────────────────────────────────────
export type JsonRpcId = string | number | null;
export type JsonRpcRequest = { jsonrpc: "2.0"; id?: JsonRpcId; method: string; params?: Record<string, unknown> };
export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
  | { jsonrpc: "2.0"; id: JsonRpcId; error: { code: number; message: string; data?: unknown } };

export const RPC_METHOD_NOT_FOUND = -32601;
export const RPC_INVALID_PARAMS = -32602;
export const RPC_INTERNAL_ERROR = -32603;

function ok(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, result };
}
function err(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

/** What the transport must provide — kept injectable so this layer stays pure. */
export type McpDeps = {
  listTools: () => McpTool[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<FadiToolResult>;
};

/**
 * Handle one JSON-RPC message. Returns the response, or null for a notification
 * (a message with no id — e.g. notifications/initialized — which gets no reply).
 */
export async function handleMcpMessage(
  message: JsonRpcRequest,
  deps: McpDeps,
): Promise<JsonRpcResponse | null> {
  const { id, method, params } = message;
  const isNotification = id === undefined;

  switch (method) {
    case "initialize":
      return ok(id ?? null, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: MCP_SERVER_INFO,
        instructions:
          "Fadi exposes career-coaching tools: find and fit-check jobs, pull a company's live roles, draft referral outreach, run a rejection autopsy, prep STAR interview answers from the user's real history, and read their momentum and career-weather. Everything is grounded in the user's real data; tools never fabricate.",
      });

    case "notifications/initialized":
    case "notifications/cancelled":
      return null; // notifications get no response

    case "ping":
      return ok(id ?? null, {});

    case "tools/list":
      return ok(id ?? null, { tools: deps.listTools() });

    case "tools/call": {
      if (isNotification) return null;
      const name = typeof params?.name === "string" ? params.name : "";
      const args = (params?.arguments as Record<string, unknown> | undefined) ?? {};
      if (!name) return err(id ?? null, RPC_INVALID_PARAMS, "tools/call requires a tool name");
      try {
        const result = await deps.callTool(name, args);
        return ok(id ?? null, toMcpToolResult(result));
      } catch (e) {
        return err(id ?? null, RPC_INTERNAL_ERROR, e instanceof Error ? e.message : "tool execution failed");
      }
    }

    default:
      if (isNotification) return null;
      return err(id ?? null, RPC_METHOD_NOT_FOUND, `Unknown method: ${method}`);
  }
}
