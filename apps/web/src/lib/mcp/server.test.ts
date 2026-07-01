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
});
