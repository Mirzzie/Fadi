import { describe, expect, it } from "vitest";

import {
  handleMcpMessage,
  MCP_PROTOCOL_VERSION,
  toMcpTool,
  toMcpToolResult,
  type McpDeps,
} from "./server";

const deps: McpDeps = {
  listTools: () => [
    { name: "evaluate_fit", description: "Fit check", inputSchema: { type: "object", properties: {} } },
  ],
  callTool: async (name, args) => ({
    summary: `called ${name} with ${JSON.stringify(args)}`,
    data: { ok: true },
    view: "none",
  }),
  listResources: () => [{ uri: "fadi://profile", name: "Profile", mimeType: "application/json" }],
  readResource: async (uri) =>
    uri === "fadi://profile" ? { uri, mimeType: "application/json", text: "{}" } : null,
};

describe("toMcpTool", () => {
  it("maps a Fadi tool to an MCP tool, keeping its JSON-schema params", () => {
    const t = toMcpTool({
      name: "scan_company_jobs",
      description: "Pull a company's roles",
      parameters: { type: "object", properties: { company: { type: "string" } }, required: ["company"] },
      execute: async () => ({ summary: "", view: "none" }),
    });
    expect(t.name).toBe("scan_company_jobs");
    expect(t.inputSchema).toMatchObject({ type: "object", required: ["company"] });
  });
});

describe("toMcpToolResult", () => {
  it("uses the summary as text and attaches object data as structuredContent", () => {
    const r = toMcpToolResult({ summary: "hi", data: { a: 1 }, view: "none" });
    expect(r.content).toEqual([{ type: "text", text: "hi" }]);
    expect(r.structuredContent).toEqual({ a: 1 });
  });

  it("omits structuredContent for non-object data", () => {
    expect(toMcpToolResult({ summary: "x", data: [1, 2], view: "none" }).structuredContent).toBeUndefined();
  });

  it("propagates isError for a failed tool result, omits it otherwise", () => {
    expect(toMcpToolResult({ summary: "boom", view: "none", isError: true }).isError).toBe(true);
    expect(toMcpToolResult({ summary: "ok", view: "none" }).isError).toBeUndefined();
  });
});

describe("toMcpTool annotations", () => {
  const base = {
    name: "track_application",
    description: "d",
    parameters: { type: "object", properties: {} },
    execute: async () => ({ summary: "", view: "none" as const }),
  };
  it("includes annotations when provided", () => {
    const t = toMcpTool(base, { readOnlyHint: false, destructiveHint: false, idempotentHint: false });
    expect(t.annotations).toEqual({ readOnlyHint: false, destructiveHint: false, idempotentHint: false });
  });
  it("omits annotations when not provided", () => {
    expect(toMcpTool(base).annotations).toBeUndefined();
  });
});

describe("handleMcpMessage", () => {
  it("initialize advertises the tools capability + protocol version", async () => {
    const res = await handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "initialize" }, deps);
    expect(res).toMatchObject({
      id: 1,
      result: { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: { tools: {} } },
    });
  });

  it("tools/list returns the mapped tools", async () => {
    const res = await handleMcpMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, deps);
    expect((res as { result: { tools: unknown[] } }).result.tools).toHaveLength(1);
  });

  it("tools/call executes the tool and wraps the result", async () => {
    const res = await handleMcpMessage(
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "evaluate_fit", arguments: { jobDescription: "x" } } },
      deps,
    );
    const result = (res as { result: ReturnType<typeof toMcpToolResult> }).result;
    expect(result.content[0].text).toContain("called evaluate_fit");
    expect(result.structuredContent).toEqual({ ok: true });
  });

  it("a notification (no id) gets no response", async () => {
    expect(await handleMcpMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, deps)).toBeNull();
  });

  it("an unknown method returns method-not-found", async () => {
    const res = await handleMcpMessage({ jsonrpc: "2.0", id: 9, method: "does/not/exist" }, deps);
    expect((res as { error: { code: number } }).error.code).toBe(-32601);
  });

  it("tools/call without a name is an invalid-params error", async () => {
    const res = await handleMcpMessage({ jsonrpc: "2.0", id: 10, method: "tools/call", params: {} }, deps);
    expect((res as { error: { code: number } }).error.code).toBe(-32602);
  });

  it("initialize advertises the resources capability", async () => {
    const res = await handleMcpMessage({ jsonrpc: "2.0", id: 11, method: "initialize" }, deps);
    expect(
      (res as { result: { capabilities: { resources?: unknown } } }).result.capabilities.resources,
    ).toBeDefined();
  });

  it("resources/list returns the resources", async () => {
    const res = await handleMcpMessage({ jsonrpc: "2.0", id: 20, method: "resources/list" }, deps);
    expect((res as { result: { resources: unknown[] } }).result.resources).toHaveLength(1);
  });

  it("resources/read returns contents for a known uri", async () => {
    const res = await handleMcpMessage(
      { jsonrpc: "2.0", id: 21, method: "resources/read", params: { uri: "fadi://profile" } },
      deps,
    );
    expect((res as { result: { contents: Array<{ uri: string }> } }).result.contents[0].uri).toBe(
      "fadi://profile",
    );
  });

  it("resources/read on an unknown uri is an invalid-params error", async () => {
    const res = await handleMcpMessage(
      { jsonrpc: "2.0", id: 22, method: "resources/read", params: { uri: "fadi://nope" } },
      deps,
    );
    expect((res as { error: { code: number } }).error.code).toBe(-32602);
  });

  it("tools/call maps an isError tool result to result.isError", async () => {
    const failing: McpDeps = {
      ...deps,
      callTool: async () => ({ summary: "Unknown tool", view: "none", isError: true }),
    };
    const res = await handleMcpMessage(
      { jsonrpc: "2.0", id: 23, method: "tools/call", params: { name: "nope" } },
      failing,
    );
    expect((res as { result: { isError?: boolean } }).result.isError).toBe(true);
  });

  it("a tool that throws returns an isError result, not a JSON-RPC error", async () => {
    const throwing: McpDeps = {
      ...deps,
      callTool: async () => {
        throw new Error("boom");
      },
    };
    const res = await handleMcpMessage(
      { jsonrpc: "2.0", id: 24, method: "tools/call", params: { name: "x" } },
      throwing,
    );
    const r = res as { result?: { isError?: boolean; content: Array<{ text: string }> }; error?: unknown };
    expect(r.error).toBeUndefined();
    expect(r.result?.isError).toBe(true);
    expect(r.result?.content[0].text).toContain("boom");
  });
});
