import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CHOOSING CLAUDE USED TO TURN FADI INTO A CHATBOT.
 *
 * runWithTools is optional on the provider interface and only the OpenAI-compatible
 * provider implemented it. The chat route filters for providers that have it and falls
 * through to "plain resilient stream (no tools)" when none do — so picking Anthropic
 * silently removed Fadi's ability to act. No error, no warning; it just answered instead
 * of doing.
 */

const create = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
  },
}));

const toolUse = (name: string, input: Record<string, unknown> = {}, id = name) => ({
  type: "tool_use" as const,
  id,
  name,
  input,
});

const says = (...content: unknown[]) => ({ content, stop_reason: "tool_use" });
const answers = (text: string) => ({
  content: [{ type: "text", text }],
  stop_reason: "end_turn",
});

beforeEach(() => {
  create.mockReset();
});

async function run(executeTool: (n: string, a: Record<string, unknown>) => Promise<{ summary: string }>) {
  const { AnthropicProvider } = await import("./anthropic");
  const provider = new AnthropicProvider("key", "claude-opus-5");
  return provider.runWithTools!(
    [
      { role: "system", content: "You are Fadi." },
      { role: "user", content: "set up my lab" },
    ],
    [
      {
        type: "function",
        function: { name: "inspect_machine", description: "look", parameters: { type: "object" } },
      },
    ] as never,
    executeTool as never,
    {},
    {},
  );
}

describe("Anthropic can use tools at all", () => {
  it("calls a tool and answers with the result", async () => {
    create.mockResolvedValueOnce(says(toolUse("inspect_machine"))).mockResolvedValueOnce(
      answers("Docker is running."),
    );

    const result = await run(async () => ({ summary: "Docker 29.7.2" }));

    expect(result.toolResults).toHaveLength(1);
    expect(result.text).toBe("Docker is running.");
  });

  it("converts the OpenAI tool shape to Anthropic's", async () => {
    create.mockResolvedValueOnce(answers("Hello."));
    await run(async () => ({ summary: "" }));

    const sent = create.mock.calls[0][0];
    // Anthropic takes flat {name, description, input_schema}; the registry speaks the
    // OpenAI function shape. Sending the wrong one is a 400, not a degraded answer.
    expect(sent.tools[0]).toHaveProperty("input_schema");
    expect(sent.tools[0]).not.toHaveProperty("function");
    expect(sent.tools[0].name).toBe("inspect_machine");
  });

  it("lifts the system prompt out of messages, where Anthropic wants it", async () => {
    create.mockResolvedValueOnce(answers("Hello."));
    await run(async () => ({ summary: "" }));

    const sent = create.mock.calls[0][0];
    expect(sent.system).toContain("You are Fadi");
    expect(sent.messages.some((m: { role: string }) => m.role === "system")).toBe(false);
  });

  it("CHAINS: a second call informed by the first", async () => {
    create
      .mockResolvedValueOnce(says(toolUse("inspect_machine")))
      .mockResolvedValueOnce(says(toolUse("start_lab_machine", { template: "linux-ubuntu" }, "b")))
      .mockResolvedValueOnce(answers("Started Ubuntu."));

    const seen: string[] = [];
    await run(async (name) => {
      seen.push(name);
      return { summary: name === "inspect_machine" ? "No Docker." : "Proposed." };
    });

    expect(seen).toEqual(["inspect_machine", "start_lab_machine"]);
  });

  it("returns every tool_result in ONE user message", async () => {
    create
      .mockResolvedValueOnce(says(toolUse("inspect_machine", {}, "a"), toolUse("lab_capacity", {}, "b")))
      .mockResolvedValueOnce(answers("Done."));

    await run(async () => ({ summary: "ok" }));

    const second = create.mock.calls[1][0];
    const userTurns = second.messages.filter((m: { role: string }) => m.role === "user");
    // Splitting results across messages is accepted and quietly teaches the model to stop
    // calling tools in parallel.
    const withResults = userTurns.filter(
      (m: { content: unknown }) =>
        Array.isArray(m.content) &&
        (m.content as { type: string }[]).some((b) => b.type === "tool_result"),
    );
    expect(withResults).toHaveLength(1);
    expect((withResults[0].content as unknown[]).length).toBe(2);
  });

  it("returns a FAILED tool as a result, not as a dropped block", async () => {
    create.mockResolvedValueOnce(says(toolUse("inspect_machine"))).mockResolvedValueOnce(answers("It failed."));

    await run(async () => {
      throw new Error("docker is not running");
    });

    const second = create.mock.calls[1][0];
    const results = (second.messages.at(-1).content as { type: string; is_error?: boolean; content: string }[])
      .filter((b) => b.type === "tool_result");
    // A tool_use with no matching tool_result is rejected by the API — dropping it turns a
    // tool failure into a broken conversation.
    expect(results).toHaveLength(1);
    expect(results[0].is_error).toBe(true);
    expect(results[0].content).toContain("docker is not running");
  });

  it("IS BOUNDED, and says so when it runs out", async () => {
    create.mockImplementation(async (body: { tools?: unknown }) =>
      body.tools ? says(toolUse("inspect_machine", { n: Math.random() })) : answers("I did not finish."),
    );

    const result = await run(async () => ({ summary: "again" }));

    expect(result.toolResults.length).toBeLessThanOrEqual(5);
    const final = create.mock.calls.at(-1)?.[0] as { messages: { content: unknown }[] };
    expect(String(final.messages.at(-1)?.content)).toMatch(/used all the tool calls/i);
  });
});
