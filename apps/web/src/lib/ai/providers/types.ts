import type { ZodSchema } from "zod";

// ─── Capabilities ────────────────────────────────────────────────────────────

export type ProviderCapability =
  | "chat"
  | "streaming"
  | "structured_output"
  | "realtime_voice"
  | "tts"
  | "stt"
  | "embeddings"
  | "vision";

// ─── Messages ─────────────────────────────────────────────────────────────────

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// ─── Options ──────────────────────────────────────────────────────────────────

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  userId?: string;
}

// ─── Provider interface ───────────────────────────────────────────────────────

/** A function-tool the model can call (OpenAI/Groq/Gemini tool format). */
export interface ToolSpec {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

/** Executes a tool the model asked for; returns narration + visual payload. */
export type ToolExecutor = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ summary: string; data?: unknown; view?: string }>;

export interface ToolRunResult {
  /** Fadi's final natural-language answer after any tools ran. */
  text: string;
  /** Structured results for visual rendering, in call order. */
  toolResults: Array<{ name: string; view: string; data: unknown }>;
}

/** Stream hooks for runWithTools so the chat can render cards + stream the answer. */
export interface ToolRunCallbacks {
  /** Fired once the tools have run, before the answer streams. */
  onToolResults?(results: ToolRunResult["toolResults"]): void;
  /** Fired per token of the final answer. */
  onToken?(token: string): void;
}

export interface AIProvider {
  readonly id: string;
  readonly name: string;
  readonly model: string;
  readonly isConfigured: boolean;
  readonly capabilities: ProviderCapability[];

  chat(messages: AIMessage[], options?: ChatOptions): Promise<string>;
  /**
   * Run a tool-calling conversation: the model may call tools (executed via
   * `executeTool`), then produces a final answer. Optional — providers that
   * don't support function calling omit it and the caller falls back to chat.
   */
  runWithTools?(
    messages: AIMessage[],
    tools: ToolSpec[],
    executeTool: ToolExecutor,
    options?: ChatOptions,
    callbacks?: ToolRunCallbacks,
  ): Promise<ToolRunResult>;
  streamChat(messages: AIMessage[], options?: ChatOptions): ReadableStream<string>;
  /**
   * Open a streaming response, THROWING on the initial failure (auth/quota/rate
   * limit) before any tokens. Lets an orchestrator retry or fall back cleanly.
   */
  openChatStream?(messages: AIMessage[], options?: ChatOptions): Promise<AsyncIterable<string>>;
  parseStructured<T>(
    messages: AIMessage[],
    schema: ZodSchema<T>,
    schemaName: string,
    options?: ChatOptions,
  ): Promise<T>;
  /** Optional cheap call to confirm the key/model/endpoint work. */
  validate?(): Promise<{ ok: boolean; message: string }>;
  /** Transcribe an audio clip to text (Whisper). Only STT-capable providers. */
  transcribe?(file: File): Promise<string>;
}

// ─── Provider config (for registry) ──────────────────────────────────────────

export interface ProviderConfig {
  id: string;
  apiKey: string;
  model?: string;
  baseURL?: string;
}

// ─── Provider descriptor (for UI listing) ────────────────────────────────────

export interface ProviderDescriptor {
  id: string;
  name: string;
  label: string;
  defaultModel: string;
  models: string[];
  capabilities: ProviderCapability[];
  requiresApiKey: boolean;
  docsUrl: string;
  /** Cost posture, shown honestly in the UI so nobody mistakes a paid API for a subscription. */
  cost: "free" | "paid" | "local";
  /** One honest line under the provider — the thing a first-time user needs to know. */
  note?: string;
}

// ORDER MATTERS: the form defaults to descriptors[0]. Free options lead, because the
// primary user is broke (PLATFORM_IDEOLOGY) and a free key that works beats a paid key
// they don't have. The paid providers carry the honest warning that an API key is NOT
// the same thing as a Claude Pro / ChatGPT Plus subscription — the #1 support confusion.
export const PROVIDER_DESCRIPTORS: ProviderDescriptor[] = [
  {
    id: "groq",
    name: "Groq",
    label: "Groq — free, fast (recommended)",
    defaultModel: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"],
    capabilities: ["chat", "streaming", "structured_output", "stt"],
    requiresApiKey: true,
    docsUrl: "https://console.groq.com/keys",
    cost: "free",
    note: "Genuinely free API tier — no billing, no card. The best place to start. Generous daily limits.",
  },
  {
    id: "google",
    name: "Google",
    label: "Google Gemini — free tier",
    defaultModel: "gemini-2.0-flash",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-2.0-flash-lite"],
    capabilities: ["chat", "streaming", "structured_output", "vision"],
    requiresApiKey: true,
    docsUrl: "https://aistudio.google.com/app/apikey",
    cost: "free",
    note: "Free key from AI Studio. Use gemini-2.0-flash — the most generous free tier.",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    label: "OpenRouter — many models, free tier",
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
    models: [
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemini-2.0-flash-exp:free",
      "deepseek/deepseek-chat-v3-0324:free",
      "openai/gpt-4o-mini",
      "anthropic/claude-3.5-sonnet",
    ],
    capabilities: ["chat", "streaming", "structured_output", "vision"],
    requiresApiKey: true,
    docsUrl: "https://openrouter.ai/keys",
    cost: "free",
    note: "One key, many models. For :free models, enable them once in OpenRouter privacy settings.",
  },
  {
    id: "ollama",
    name: "Ollama",
    label: "Ollama — runs on your own machine",
    defaultModel: "llama3.2",
    models: ["llama3.2", "llama3.1", "mistral", "gemma3", "qwen2.5"],
    capabilities: ["chat", "streaming"],
    requiresApiKey: false,
    docsUrl: "https://ollama.com",
    cost: "local",
    note: "Free and private — models run locally, nothing leaves your machine. Needs Ollama installed.",
  },
  {
    id: "openai",
    name: "OpenAI",
    label: "OpenAI — paid API (not ChatGPT Plus)",
    defaultModel: "gpt-4.1-mini",
    models: ["gpt-4o", "gpt-4.1", "gpt-4.1-mini", "gpt-4o-mini"],
    capabilities: ["chat", "streaming", "structured_output", "realtime_voice", "tts", "stt", "vision"],
    requiresApiKey: true,
    docsUrl: "https://platform.openai.com/api-keys",
    cost: "paid",
    note: "Needs pay-as-you-go API credit at platform.openai.com. A ChatGPT Plus/Pro subscription is a SEPARATE account and does NOT work here.",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    label: "Anthropic Claude — paid API (not Claude Pro)",
    defaultModel: "claude-sonnet-4-6",
    models: ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
    capabilities: ["chat", "streaming", "structured_output", "vision"],
    requiresApiKey: true,
    docsUrl: "https://console.anthropic.com/settings/keys",
    cost: "paid",
    note: "Needs pay-as-you-go API credit at console.anthropic.com. A Claude Pro/Max subscription is a SEPARATE account and does NOT work here.",
  },
];
