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

export interface AIProvider {
  readonly id: string;
  readonly name: string;
  readonly model: string;
  readonly isConfigured: boolean;
  readonly capabilities: ProviderCapability[];

  chat(messages: AIMessage[], options?: ChatOptions): Promise<string>;
  streamChat(messages: AIMessage[], options?: ChatOptions): ReadableStream<string>;
  parseStructured<T>(
    messages: AIMessage[],
    schema: ZodSchema<T>,
    schemaName: string,
    options?: ChatOptions,
  ): Promise<T>;
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
}

export const PROVIDER_DESCRIPTORS: ProviderDescriptor[] = [
  {
    id: "openai",
    name: "OpenAI",
    label: "OpenAI",
    defaultModel: "gpt-4.1-mini",
    models: ["gpt-4o", "gpt-4.1", "gpt-4.1-mini", "gpt-4o-mini"],
    capabilities: ["chat", "streaming", "structured_output", "realtime_voice", "tts", "stt", "vision"],
    requiresApiKey: true,
    docsUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    label: "Anthropic (Claude)",
    defaultModel: "claude-sonnet-4-6",
    models: ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
    capabilities: ["chat", "streaming", "structured_output", "vision"],
    requiresApiKey: true,
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "google",
    name: "Google",
    label: "Google (Gemini)",
    defaultModel: "gemini-2.0-flash",
    models: ["gemini-2.5-pro", "gemini-2.0-flash", "gemini-2.0-flash-lite"],
    capabilities: ["chat", "streaming", "structured_output", "vision"],
    requiresApiKey: true,
    docsUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "groq",
    name: "Groq",
    label: "Groq (fast inference)",
    defaultModel: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    capabilities: ["chat", "streaming", "stt"],
    requiresApiKey: true,
    docsUrl: "https://console.groq.com/keys",
  },
  {
    id: "ollama",
    name: "Ollama",
    label: "Ollama (local)",
    defaultModel: "llama3.2",
    models: ["llama3.2", "llama3.1", "mistral", "gemma3", "qwen2.5"],
    capabilities: ["chat", "streaming"],
    requiresApiKey: false,
    docsUrl: "https://ollama.com",
  },
];
