import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CAN FADI TAKE TWO STEPS?
 *
 * It could not. runWithTools made one tool-resolution call, executed whatever was asked
 * for, then answered with the tools taken away — so Fadi got exactly one guess. It could
 * not call inspect_machine, see there was no Docker, and propose something else; it could
 * not ask for a grant after being refused and retry; it could not check that the thing it
 * just did had worked. Every one of those needs two rounds.
 *
 * These drive the provider against a scripted fake so the rounds are observable.
 */

type Msg = { role: string; content?: string | null; tool_calls?: unknown[] };

const create = vi.fn();

vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
  },
}));

function toolCall(name: string, args: Record<string, unknown> = {}, id = name) {
  return { id, type: "function", function: { name, arguments: JSON.stringify(args) } };
}

/** A non-streaming round that asks for tools. */
const asks = (...calls: ReturnType<typeof toolCall>[]) => ({
  choices: [{ message: { role: "assistant", content: null, tool_calls: calls } }],
});

/** The streamed final answer. */
const answers = (text: string) => ({
  async *[Symbol.asyncIterator]() {
    yield { choices: [{ delta: { content: text } }] };
  },
});

/** A non-streaming round that asks for nothing — the model saying it is done. */
const done = () => ({ choices: [{ message: { role: "assistant", content: null, tool_calls: [] } }] });

/**
 * Script the rounds. After each tool round the loop asks again — that is the whole point of
 * it — so a chain of N tool rounds is N asks, then a "done", then the streamed answer.
 */
function script(rounds: ReturnType<typeof asks>[], text: string) {
  let i = 0;
  create.mockImplementation(async (body: { stream?: boolean }) => {
    if (body.stream) return answers(text);
    return i < rounds.length ? rounds[i++] : done();
  });
}

beforeEach(() => {
  // Braces. An expression body returns the mock, and vitest calls whatever a hook returns
  // as a cleanup function — invoking it with no arguments after every test. Third time
  // this pattern has cost me a cycle today; it is now a habit to check for.
  create.mockReset();
});

async function run(executeTool: (n: string, a: Record<string, unknown>) => Promise<{ summary: string }>) {
  const { OpenAIProvider } = await import("./openai");
  const provider = new OpenAIProvider("k", "m", { id: "test", name: "Test" });
  return provider.runWithTools!(
    [{ role: "user", content: "get my lab going" }],
    [{ type: "function", function: { name: "inspect_machine", description: "", parameters: {} } }] as never,
    executeTool as never,
    {},
    {},
  );
}

describe("the tool loop", () => {
  it("CHAINS: a second call informed by the first result", async () => {
    // The shape that was impossible: look, then decide what to do about what you saw.
    script(
      [asks(toolCall("inspect_machine")), asks(toolCall("start_lab_machine", { template: "linux-ubuntu" }))],
      "Started Ubuntu, since there was no Docker.",
    );

    const seen: string[] = [];
    const result = await run(async (name) => {
      seen.push(name);
      return { summary: name === "inspect_machine" ? "No Docker here." : "Proposed." };
    });

    expect(seen).toEqual(["inspect_machine", "start_lab_machine"]);
    expect(result.toolResults).toHaveLength(2);
    expect(result.text).toContain("no Docker");
  });

  it("answers directly when no tool is needed, without a second call", async () => {
    create.mockResolvedValueOnce({ choices: [{ message: { role: "assistant", content: "Hello." } }] });
    const result = await run(async () => ({ summary: "" }));
    expect(result.text).toBe("Hello.");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("stops looping the moment the model stops asking", async () => {
    script([asks(toolCall("inspect_machine"))], "Here is what I found.");

    const result = await run(async () => ({ summary: "Docker 29." }));
    expect(result.toolResults).toHaveLength(1);
    // One tool round, one round where it asks for nothing, one streamed answer.
    expect(create).toHaveBeenCalledTimes(3);
  });

  it("IS BOUNDED: a model that loops forever costs a few calls, not a bill", async () => {
    create.mockImplementation(async (body: { stream?: boolean }) =>
      body.stream ? answers("Stopping there.") : asks(toolCall("inspect_machine", { n: Math.random() })),
    );

    const result = await run(async () => ({ summary: "again" }));

    // Five rounds then an answer. Without a ceiling this test would not terminate.
    expect(result.toolResults.length).toBeLessThanOrEqual(5);
    expect(create.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it("tells the model it ran out, so the answer can admit it", async () => {
    create.mockImplementation(async (body: { stream?: boolean; messages?: Msg[] }) =>
      body.stream ? answers("I did not finish.") : asks(toolCall("inspect_machine", { n: Math.random() })),
    );

    await run(async () => ({ summary: "again" }));

    const final = create.mock.calls.at(-1)?.[0] as { messages: Msg[] };
    const last = final.messages.at(-1);
    // Hiding the cutoff would produce a confident answer about work that stopped early.
    expect(String(last?.content)).toMatch(/used all the tool calls/i);
  });

  it("does not repeat an identical call inside one round", async () => {
    script([asks(toolCall("inspect_machine", {}, "a"), toolCall("inspect_machine", {}, "b"))], "Done.");

    let executions = 0;
    await run(async () => {
      executions += 1;
      return { summary: "Docker 29." };
    });

    // Llama on Groq repeats calls; executing the same thing twice in one breath is waste.
    expect(executions).toBe(1);
  });

  it("ALLOWS the same call in a LATER round, because the world may have changed", async () => {
    // "Check it again now that I have changed something" is the whole point of looping.
    script(
      [asks(toolCall("inspect_machine", {}, "first")), asks(toolCall("inspect_machine", {}, "second"))],
      "Now it is there.",
    );

    let executions = 0;
    await run(async () => {
      executions += 1;
      return { summary: "checked" };
    });

    expect(executions).toBe(2);
  });
});
