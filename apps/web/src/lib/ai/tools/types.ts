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
  | "none";

export interface FadiToolResult {
  /** Natural-language result for the model to speak/narrate. */
  summary: string;
  /** Structured payload for visual rendering (job cards, stat tiles, …). */
  data?: unknown;
  /** Render hint for the chat UI. */
  view?: FadiToolView;
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

export interface FadiTool {
  readonly name: string;
  readonly description: string;
  /**
   * Required on purpose. A capability that does not say what it touches cannot be routed,
   * approved or receipted safely, and a default would let a new tool inherit "harmless"
   * by forgetting to answer.
   */
  readonly risk: ToolRisk;
  /**
   * What running it does, in the person's words, for the receipt they read afterwards.
   * Omitted for reads, which produce no receipt.
   */
  readonly effect?: string;
  /** JSON Schema for the tool's arguments (OpenAI/Groq/Gemini tool format). */
  readonly parameters: Record<string, unknown>;
  execute(args: Record<string, unknown>, ctx: FadiToolContext): Promise<FadiToolResult>;
}

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
