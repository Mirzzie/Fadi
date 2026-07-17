import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { ZodSchema } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { aiErrorMessage, isStructuredOutputUnsupported } from "./errors";
import type {
  AIMessage,
  AIProvider,
  ChatOptions,
  ProviderCapability,
  ToolExecutor,
  ToolRunCallbacks,
  ToolRunResult,
  ToolSpec,
} from "./types";

/**
 * Pull a JSON object out of a model's text response — tolerant of code fences
 * and stray prose around it, which non-strict providers often add.
 */
function extractJsonObject(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall back to the outermost {...} span.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Could not extract JSON from the model response.");
  }
}

/**
 * OpenAI-compatible provider. Works for OpenAI itself and any compatible
 * endpoint (Groq, Ollama, Google's OpenAI-compat gateway) via `baseURL`.
 */
export class OpenAIProvider implements AIProvider {
  readonly id: string;
  readonly name: string;
  readonly model: string;
  readonly isConfigured: boolean;
  readonly capabilities: ProviderCapability[] = [
    "chat",
    "streaming",
    "structured_output",
    "realtime_voice",
    "tts",
    "stt",
    "vision",
  ];

  private client: OpenAI | null;

  constructor(
    apiKey: string | undefined,
    model = "gpt-4.1-mini",
    options: {
      baseURL?: string;
      id?: string;
      name?: string;
      keyless?: boolean;
      headers?: Record<string, string>;
    } = {},
  ) {
    this.id = options.id ?? "openai";
    this.name = options.name ?? "OpenAI";
    this.model = model;
    // Keyless local endpoints (Ollama) are "configured" once a baseURL exists.
    this.isConfigured = Boolean(apiKey) || (Boolean(options.keyless) && Boolean(options.baseURL));
    this.client =
      apiKey || options.keyless
        ? new OpenAI({
            apiKey: apiKey || "ollama",
            baseURL: options.baseURL,
            defaultHeaders: options.headers,
          })
        : null;
  }

  async chat(messages: AIMessage[], options?: ChatOptions): Promise<string> {
    if (!this.client) {
      return "Fadi is not configured. Add an AI provider and API key in Settings.";
    }
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: options?.temperature ?? 0.5,
      max_tokens: options?.maxTokens,
    });
    return response.choices[0]?.message.content ?? "";
  }

  async openChatStream(
    messages: AIMessage[],
    options?: ChatOptions,
  ): Promise<AsyncIterable<string>> {
    if (!this.client) throw new Error("AI provider is not configured.");
    // create() throws here on auth/quota/rate-limit, before any tokens.
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: options?.temperature ?? 0.5,
      max_tokens: options?.maxTokens,
      stream: true,
    });
    async function* iterate() {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta.content ?? "";
        if (delta) yield delta;
      }
    }
    return iterate();
  }

  streamChat(messages: AIMessage[], options?: ChatOptions): ReadableStream<string> {
    if (!this.client) {
      return new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Fadi is not configured. Add an AI provider and API key in Settings.");
          controller.close();
        },
      });
    }
    const open = () => this.openChatStream(messages, options);
    const self = { id: this.id, name: this.name };
    return new ReadableStream<string>({
      async start(controller) {
        try {
          for await (const chunk of await open()) controller.enqueue(chunk);
        } catch (err) {
          controller.enqueue(`\n\n${aiErrorMessage(err, self)}`);
        } finally {
          controller.close();
        }
      },
    });
  }

  async parseStructured<T>(
    messages: AIMessage[],
    schema: ZodSchema<T>,
    schemaName: string,
    options?: ChatOptions,
  ): Promise<T> {
    if (!this.client) {
      throw new Error("AI provider is not configured.");
    }
    const client = this.client;
    const temperature = options?.temperature ?? 0.4;

    // Build the strict json_schema format ONCE. OpenAI's helper throws at
    // *construction* for schemas it can't express in strict mode — most commonly a
    // field that is `.optional()` but not `.nullable()`. That is not a provider
    // failure and must never abort the whole call: if it throws, we skip the strict
    // path and use the tolerant JSON path below, which validates with `schema.parse`
    // and handles optional fields natively. (This exact bug was hard-failing evidence
    // extraction and interview-question drafting — the helper was also called a second
    // time for the fallback guide, so even the fallback threw.)
    let strictFormat: ReturnType<typeof zodResponseFormat> | null = null;
    try {
      strictFormat = zodResponseFormat(schema, schemaName);
    } catch {
      strictFormat = null;
    }

    // 1) Native structured outputs (strict json_schema). OpenAI + newer Gemini
    //    honor this; many free/local/OpenRouter models reject it.
    if (strictFormat) {
      try {
        const response = await client.chat.completions.parse({
          model: this.model,
          messages,
          response_format: strictFormat,
          temperature,
        });
        const parsed = response.choices[0]?.message.parsed;
        if (parsed) return parsed;
        // Got a response but no parsed object — fall through to tolerant parsing
        // using the raw content rather than failing outright.
        const raw = response.choices[0]?.message.content;
        if (raw) return schema.parse(extractJsonObject(raw));
      } catch (err) {
        // Auth/quota/rate-limit etc. are real — let them bubble up to the caller.
        // Only fall back when the provider simply can't do json_schema mode.
        if (!isStructuredOutputUnsupported(err)) throw err;
      }
    }

    // 2) Tolerant path for any OpenAI-compatible model (and for schemas strict mode
    //    can't express): instruct JSON, then validate against the same Zod schema.
    //    Use the strict schema's shape when we have it, otherwise a non-strict
    //    conversion (which handles optionals) so the guidance is still schema-shaped.
    const jsonSchema =
      (strictFormat as { json_schema?: { schema?: unknown } } | null)?.json_schema?.schema ??
      // Cast: the bundled zod-to-json-schema is typed against a different zod build; it
      // only reads the schema shape at runtime, so this is safe.
      zodToJsonSchema(schema as unknown as Parameters<typeof zodToJsonSchema>[0], schemaName);
    const guide: AIMessage = {
      role: "system",
      content: jsonSchema
        ? `Respond with ONLY a single JSON object that matches this JSON Schema. No markdown, no code fences, no commentary.\n\nSchema:\n${JSON.stringify(jsonSchema)}`
        : "Respond with ONLY a single valid JSON object. No markdown, no code fences, no commentary.",
    };
    const tolerantMessages = [...messages, guide];
    const maxTokens = options?.maxTokens ?? 4096;

    let content = "";
    try {
      const r = await client.chat.completions.create({
        model: this.model,
        messages: tolerantMessages,
        response_format: { type: "json_object" },
        temperature,
        max_tokens: maxTokens,
      });
      content = r.choices[0]?.message.content ?? "";
    } catch (err) {
      if (!isStructuredOutputUnsupported(err)) throw err;
      // Model doesn't even support json_object mode (older Ollama, etc.) — plain.
      const r = await client.chat.completions.create({
        model: this.model,
        messages: tolerantMessages,
        temperature,
        max_tokens: maxTokens,
      });
      content = r.choices[0]?.message.content ?? "";
    }

    if (!content) {
      throw new Error("AI provider returned an empty structured response.");
    }
    return schema.parse(extractJsonObject(content));
  }

  /**
   * Tool-calling conversation. The model may request tools; we execute them,
   * feed results back, and loop until it answers (capped to avoid runaways).
   * Collects each tool's visual payload so the chat can render it.
   */
  async runWithTools(
    messages: AIMessage[],
    tools: ToolSpec[],
    executeTool: ToolExecutor,
    options?: ChatOptions,
    callbacks?: ToolRunCallbacks,
  ): Promise<ToolRunResult> {
    if (!this.client) throw new Error("AI provider is not configured.");
    const client = this.client;

    const convo: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const toolResults: ToolRunResult["toolResults"] = [];

    // Phase 1 — a single tool-resolution pass (non-streaming, so we can read the
    // tool calls). Low temperature → far more reliable tool-call JSON on Groq.
    const first = await client.chat.completions.create({
      model: this.model,
      messages: convo,
      tools,
      tool_choice: "auto",
      temperature: 0.2,
    });
    const choice = first.choices[0]?.message;
    const calls = (choice?.tool_calls ?? []).filter((c) => c.type === "function");

    if (calls.length === 0) {
      // No tools needed — return the direct answer (delivered whole).
      const text = choice?.content ?? "";
      callbacks?.onToken?.(text);
      return { text, toolResults };
    }

    // Execute the requested tools (de-duped: llama on Groq tends to repeat calls).
    convo.push(choice as OpenAI.Chat.Completions.ChatCompletionMessageParam);
    const executed = new Set<string>();
    for (const call of calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        /* leave empty on malformed JSON */
      }
      const key = `${call.function.name}:${JSON.stringify(args)}`;
      if (executed.has(key)) {
        convo.push({ role: "tool", tool_call_id: call.id, content: "(already provided above)" });
        continue;
      }
      executed.add(key);
      const result = await executeTool(call.function.name, args);
      toolResults.push({ name: call.function.name, view: result.view ?? "none", data: result.data });
      convo.push({ role: "tool", tool_call_id: call.id, content: result.summary });
    }
    callbacks?.onToolResults?.(toolResults);

    // Phase 2 — STREAM the final answer (no tools offered, so it must answer).
    const stream = await client.chat.completions.create({
      model: this.model,
      messages: convo,
      temperature: options?.temperature ?? 0.5,
      stream: true,
    });
    let text = "";
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        text += delta;
        callbacks?.onToken?.(delta);
      }
    }
    return { text, toolResults };
  }

  /**
   * Transcribe audio via Whisper. Groq (whisper-large-v3-turbo, free tier) and
   * OpenAI (whisper-1) support this; other OpenAI-compatible endpoints (Gemini,
   * Ollama, OpenRouter) do not, so this throws for them.
   */
  async transcribe(file: File): Promise<string> {
    if (!this.client) throw new Error("AI provider is not configured.");
    const model =
      this.id === "groq"
        ? "whisper-large-v3-turbo"
        : this.id === "openai"
          ? "whisper-1"
          : null;
    if (!model) {
      throw new Error(`${this.name} doesn't support audio transcription.`);
    }
    const res = await this.client.audio.transcriptions.create({ file, model });
    return (res as { text?: string }).text ?? "";
  }

  /** Cheap call to confirm the key/model/endpoint actually work. */
  async validate(): Promise<{ ok: boolean; message: string }> {
    if (!this.client) {
      return { ok: false, message: "No API key configured for this provider." };
    }
    try {
      await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      });
      return { ok: true, message: `Connected to ${this.name} (${this.model}).` };
    } catch (err) {
      return { ok: false, message: aiErrorMessage(err, { id: this.id, name: this.name }) };
    }
  }
}
