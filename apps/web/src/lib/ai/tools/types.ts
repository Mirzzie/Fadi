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
}

import type { ZodSchema } from "zod";

export interface FadiToolContext {
  userId: string;
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

export interface FadiTool {
  readonly name: string;
  readonly description: string;
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
