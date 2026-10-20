/**
 * Fadi's tool layer — the seam that turns Fadi from a chatbox into an agent. Each
 * tool is a capability Fadi can invoke when the user asks ("list jobs in Dublin",
 * "what's my performance", "what's new"). A tool returns BOTH a `summary` (so Fadi
 * can narrate/speak the result) and structured `data` + a `view` hint (so the
 * chat can ALSO render it visually). New external-source plugins register here,
 * so the system grows over time. Mirrors the data-source provider pattern.
 */

/** How the client should visually render a tool's result inside the chat. */
export type FadiToolView =
  | "jobs"
  | "performance"
  | "updates"
  | "document"
  | "application"
  | "labor"
  | "world_shifts"
  | "track_created"
  /** data is { href, label }: the client goes there. */
  | "navigate"
  | "none";

/**
 * What actually happened when a capability ran.
 *
 * Most tools answer "did it work?" by returning prose, and prose is not a status: a document
 * tool that says "drafting isn't available this turn" was returning an ordinary success, and
 * the receipt read "Drafted and saved a document — drafting isn't available this turn", marked
 * done. A surface built to account for Fadi's actions cannot be allowed to contradict itself.
 *
 * - `performed`   it did the thing.
 * - `needs_input` it stopped to ask the person something. Nothing changed.
 * - `refused`     it declined, or the person had not allowed it. Nothing changed.
 * - `failed`      it tried and could not.
 */
export type ToolOutcome = "performed" | "needs_input" | "refused" | "failed";

export interface FadiToolResult {
  /** Natural-language result for the model to speak/narrate. */
  summary: string;
  /**
   * The same result, written to be HEARD: whole sentences, the answer first, no lists, symbols
   * or "role(s)". Voice (Buddy) says this instead of the summary when a tool sets it; it must
   * come from the same data as the summary and claim nothing the summary does not.
   */
  spoken?: string;
  /** Structured payload for visual rendering (job cards, stat tiles, …). */
  data?: unknown;
  /** Render hint for the chat UI. */
  view?: FadiToolView;
  /**
   * What happened, for the receipt. Required in practice of every consequential tool — a test
   * holds that each of their no-op paths says so — because the default cannot be guessed:
   * a summary that reads like an apology is still a summary.
   */
  outcome?: ToolOutcome;
  /**
   * True when this result represents a genuine FAILURE (the tool couldn't do its
   * job — e.g. unknown tool). Surfaced to MCP clients as `result.isError: true` so
   * strict clients can branch on it. NOT set for soft/guidance responses ("your
   * evidence pool is empty yet") — those are successful, informative answers.
   */
  isError?: boolean;
}

import type { ZodSchema } from "zod";

export interface FadiToolContext {
  userId: string;
  /**
   * WHO IS CALLING — the chat model, an MCP client, or a background agent.
   *
   * Only matters for tools that touch the user's machine, and there it matters a great
   * deal: the audit log records an actor, and an actor that says "model" for every caller
   * cannot answer the question the log exists for. "An MCP client I connected last month
   * asked to inspect my hypervisor" is a different fact from "the assistant I am talking
   * to right now did", and a person reviewing a list of denials needs to tell them apart.
   *
   * Defaults to "chat" when unset, because the chat route is the oldest caller and an
   * omission there should read as the least alarming truth, not the most.
   */
  surface?: "chat" | "mcp" | "agent";
  /** The work this call serves, so its receipt lands on that piece of work. */
  workItemId?: string | null;
  /**
   * The conversation this call belongs to, when one exists (the voice turn sets it). Tools that
   * run a multi-turn flow — e.g. a spoken mock-interview session — key their ephemeral state to
   * it so "answer the question" continues the same session. Unset for stateless one-shot callers.
   */
  contextId?: string | null;
  /**
   * Generation capability, supplied by the chat route from the user's provider,
   * so tools that need the model (e.g. generate_document) can produce content
   * without holding a provider reference themselves.
   */
  generate?: {
    structured<T>(system: string, user: string, schema: ZodSchema<T>, name: string): Promise<T>;
    text(system: string, user: string): Promise<string>;
  };
}

/**
 * What a capability can touch — declared on the tool, not discovered when it runs.
 *
 * Routing, approval and the receipt all need to reason about a tool BEFORE calling it, so the
 * risk lives on the contract and is copied onto the execution when one is opened.
 *
 * - `read`     answers a question. Nothing of the person's changes.
 * - `write`    changes the person's own records inside Fadi.
 * - `external` reaches outside Fadi — their machine, another service, the world.
 */
export type ToolRisk = "read" | "write" | "external";

/** A consequential tool must say what happened on EVERY path — the compiler holds it. */
export type ConsequentialResult = FadiToolResult & { outcome: ToolOutcome };

interface ToolBase {
  readonly name: string;
  readonly description: string;
  /** JSON Schema for the tool's arguments (OpenAI/Groq/Gemini tool format). */
  readonly parameters: Record<string, unknown>;
  /**
   * The argument that names an existing record of the person's ("job", "application"), when
   * there is one. Lets a voice caller fill it from what the person picked by position ("the
   * second one") instead of trusting the model's guess at a name.
   */
  readonly target?: string;
}

/** Answers a question. Nothing of the person's changes, so there is nothing to account for. */
export interface ReadTool extends ToolBase {
  readonly risk: "read";
  readonly effect?: never;
  execute(args: Record<string, unknown>, ctx: FadiToolContext): Promise<FadiToolResult>;
}

/**
 * Changes something, or reaches outside Fadi. Must name what it attempts, and must report the
 * outcome of every return path — including the ones that ask a question and do nothing, which
 * is exactly where a receipt used to be able to claim a success that never happened.
 */
export interface ConsequentialTool extends ToolBase {
  readonly risk: "write" | "external";
  /** What it attempts, named neutrally: the status says whether it happened. */
  readonly effect: string;
  execute(args: Record<string, unknown>, ctx: FadiToolContext): Promise<ConsequentialResult>;
  /**
   * Optional: work out exactly what a held change will touch, WITHOUT changing anything. A
   * caller that must confirm first (voice) reads `readBack` to the person and later executes
   * with `args` — which pin the record by id — so "confirm" acts on what was read back, not on
   * whatever the name matches by then. `ok: false` is a question for the person; nothing is held.
   */
  prepare?(
    args: Record<string, unknown>,
    ctx: FadiToolContext
  ): Promise<
    { ok: true; readBack: string; args: Record<string, unknown> } | { ok: false; summary: string }
  >;
}

/**
 * The risk is required on purpose, and splitting the type on it is what makes the rest
 * enforceable: a capability that does not say what it touches cannot be routed, approved or
 * receipted safely, and a default would let a new tool inherit "harmless" by forgetting.
 */
export type FadiTool = ReadTool | ConsequentialTool;

/** The OpenAI/Groq/Gemini-compatible function-tool spec sent to the model. */
export function toToolSpec(tool: FadiTool) {
  return {
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}
