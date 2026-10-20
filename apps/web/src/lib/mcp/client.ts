import "server-only";

import { fetchSafeUrl, isSafeFetchUrl } from "@/lib/security/url-guard";
import { logger } from "@/lib/observability/logger";

/**
 * Fadi as an MCP CLIENT — speaking to somebody else's server.
 *
 * This is the extension point: a connected server's tools become capabilities, and everything
 * downstream (routing, the risk gate, receipts) works on them unchanged. What makes that safe
 * is not trusting the server about itself.
 *
 * - The URL is fetched by our server, so it is SSRF-guarded on every call, not once at setup:
 *   a hostname that resolved to a public address yesterday can resolve to 169.254.169.254 today.
 * - Descriptions reach the model. They are capped, stripped of control characters, and labelled
 *   as coming from an external server, because a tool description is an instruction channel.
 * - Nothing the server says about its own risk is used. Every tool it offers is `external`.
 * - A call is given a deadline. A server that never answers must not hold a plan open forever.
 */

const TIMEOUT_MS = 20_000;
const MAX_DESCRIPTION = 400;
const MAX_TOOLS = 40;
const MAX_RESULT = 8_000;

export type McpTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type McpProbe =
  | { ok: true; tools: McpTool[] }
  | { ok: false; status: "unreachable" | "refused"; detail: string };

export type McpCall = { ok: true; text: string } | { ok: false; detail: string };

/** Untrusted text on its way into a prompt: one line, capped, no control characters. */
function clean(text: unknown, max = MAX_DESCRIPTION): string {
  if (typeof text !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return text
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

async function rpc(
  url: string,
  token: string | null,
  method: string,
  params: Record<string, unknown>
): Promise<
  { ok: true; result: unknown } | { ok: false; status: "unreachable" | "refused"; detail: string }
> {
  if (!(await isSafeFetchUrl(url))) {
    return { ok: false, status: "refused", detail: "That address is not one Fadi may call." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchSafeUrl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, status: "refused", detail: "The server refused Fadi's credentials." };
    }
    if (!response.ok) {
      return {
        ok: false,
        status: "unreachable",
        detail: `The server answered ${response.status}.`,
      };
    }

    const body = (await response.json()) as { result?: unknown; error?: { message?: string } };
    if (body.error) {
      return {
        ok: false,
        status: "refused",
        detail: clean(body.error.message) || "The server returned an error.",
      };
    }
    return { ok: true, result: body.result };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      status: "unreachable",
      detail: aborted ? "The server did not answer in time." : "Fadi could not reach the server.",
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Ask a server who it is and what it can do. Also the health check. */
export async function probeServer(url: string, token: string | null): Promise<McpProbe> {
  const hello = await rpc(url, token, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "Fadi", version: "1" },
  });
  if (!hello.ok) return { ok: false, status: hello.status, detail: hello.detail };

  const listed = await rpc(url, token, "tools/list", {});
  if (!listed.ok) return { ok: false, status: listed.status, detail: listed.detail };

  const raw = (listed.result as { tools?: unknown[] } | undefined)?.tools;
  if (!Array.isArray(raw)) {
    return { ok: false, status: "refused", detail: "The server did not list any tools." };
  }

  const tools: McpTool[] = [];
  for (const entry of raw.slice(0, MAX_TOOLS)) {
    const tool = entry as { name?: unknown; description?: unknown; inputSchema?: unknown };
    const name = clean(tool.name, 64).replace(/[^a-zA-Z0-9_.-]/g, "_");
    if (!name) continue;
    tools.push({
      name,
      description: clean(tool.description),
      parameters:
        tool.inputSchema && typeof tool.inputSchema === "object"
          ? (tool.inputSchema as Record<string, unknown>)
          : { type: "object", properties: {} },
    });
  }
  return { ok: true, tools };
}

/** Run one of a server's tools and bring back what it said, as text. */
export async function callTool(
  url: string,
  token: string | null,
  name: string,
  args: Record<string, unknown>
): Promise<McpCall> {
  const called = await rpc(url, token, "tools/call", { name, arguments: args });
  if (!called.ok) return { ok: false, detail: called.detail };

  const result = called.result as
    | { content?: Array<{ type?: string; text?: string }>; isError?: boolean }
    | undefined;

  const text = (result?.content ?? [])
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => clean(part.text, MAX_RESULT))
    .join("\n")
    .slice(0, MAX_RESULT);

  if (result?.isError) {
    logger.info("mcp.client.tool_error", { name });
    return { ok: false, detail: text || "The server reported an error." };
  }
  return { ok: true, text: text || "The server answered with nothing to show." };
}
