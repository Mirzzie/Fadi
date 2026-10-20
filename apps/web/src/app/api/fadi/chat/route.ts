import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth/auth";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { buildProviderChain } from "@/lib/ai/registry";
import { getUserProviderConfigs } from "@/lib/ai/user-settings";
import { createResilientChatStream } from "@/lib/ai/resilient";
import { buildFadiContext } from "@/lib/ai/context/builder";
import { buildFadiMessages } from "@/lib/ai/prompts/system";
import { executeFadiTool, getFadiTools } from "@/lib/ai/tools/registry";
import { toToolSpec, type FadiToolContext } from "@/lib/ai/tools/types";
import { createAgentMessagesRepository } from "@careeros/database";
import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";
import { consumeRateLimit } from "@/lib/security/rate-limit";

/** A one-shot SSE response carrying a single message — so the client always gets a
 *  readable stream (no opaque "Failed to reach Fadi") even on the unhappy paths. */
function sseMessage(text: string): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(enc.encode(`data: ${JSON.stringify(text)}\n\n`));
      controller.enqueue(enc.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" },
  });
}

const chatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .max(20)
    .optional()
    .default([]),
});

export async function POST(req: NextRequest) {
  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await getCurrentAuthUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Rate limit at the request boundary. Every chat turn spends the user's own AI key
  // AND runs buildFadiContext (many DB reads + live-market lookups) AND may fire tool
  // calls — none of which pass through getUserDocGenerate's limiter, so this endpoint
  // is a separate, higher-frequency spend path that must be guarded on its own. The
  // ceiling is generous for a human conversation but stops a runaway client/loop from
  // draining the key or hammering the database. Answered as SSE so the client renders
  // it like any other Fadi reply instead of an opaque error.
  const rate = await consumeRateLimit({
    key: `fadi-chat:${user.id}`,
    limit: 40,
    windowMs: 5 * 60 * 1000,
  });
  if (!rate.allowed) {
    const mins = Math.max(1, Math.ceil(rate.retryAfterSeconds / 60));
    return sseMessage(
      `Let's take a breath — that's a lot of messages very fast. Give me about ${mins} minute${mins === 1 ? "" : "s"} and we'll pick right back up. Nothing you've done is lost.`,
    );
  }

  // Parse request
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return new Response("Invalid request body", { status: 400 });
  }

  const { message, history } = parsed.data;

  // Build context
  // Live market signals (GDELT/HN/Remotive) are cached, so Fadi's answers stay
  // grounded in real data without per-message fetch latency.
  // Context build touches live market data + several reads — never let a hiccup
  // there turn into an opaque 500 / "Failed to reach Fadi" on the client.
  let context: Awaited<ReturnType<typeof buildFadiContext>>;
  try {
    context = await buildFadiContext(user.id, { includeLiveMarket: true });
  } catch (err) {
    logger.error("fadi.chat.context_failed", {
      userId: user.id,
      error: err instanceof Error ? err.message : "unknown",
    });
    return sseMessage("I hit a snag gathering your context just now — give me a moment and try again.");
  }

  if (!context) {
    return sseMessage(
      "Let's finish your setup first — add your target role, goal, and career history, and I'll be ready to help.",
    );
  }

  // Build messages
  const messages = buildFadiMessages(context, history, message);

  // Resolve the user's provider chain (primary → fallback) and stream resiliently:
  // retry transient rate limits, switch providers when one is exhausted.
  const chain = buildProviderChain(await getUserProviderConfigs(user.id));

  // No usable provider → say so honestly (BYO-key model) instead of failing opaquely.
  if (chain.length === 0) {
    return sseMessage(
      "I run on your own AI key for privacy — add one in Settings → AI provider and I'll be right here with you.",
    );
  }

  logger.info("fadi.chat.started", {
    userId: user.id,
    providers: chain.map((p) => `${p.id}:${p.model}`).join(", "),
    historyLength: history.length,
  });

  // Fadi's tools (search_jobs, get_performance, …) + the first provider in the
  // chain that supports function calling. If none do, we stream plainly.
  const tools = getFadiTools().map(toToolSpec);
  // All tool-capable providers (primary → fallback) so the agentic loop fails
  // over when one is rate-limited/exhausted (e.g. Groq's daily token cap).
  const toolProviders = chain.filter((p) => typeof p.runWithTools === "function");

  // Generation capability for tools that draft content (generate_document),
  // bound to the user's primary provider.
  const genProvider = chain[0];
  const toolCtx: FadiToolContext = {
    userId: user.id,
    generate: genProvider
      ? {
          structured: (system, userMsg, schema, name) =>
            genProvider.parseStructured(
              [
                { role: "system", content: system },
                { role: "user", content: userMsg },
              ],
              schema,
              name,
              { temperature: 0.4 },
            ),
          text: (system, userMsg) =>
            genProvider.chat(
              [
                { role: "system", content: system },
                { role: "user", content: userMsg },
              ],
              { temperature: 0.6 },
            ),
        }
      : undefined,
  };

  const encoder = new TextEncoder();

  const sseStream = new ReadableStream({
    async start(controller) {
      const sendText = (t: string) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(t)}\n\n`));
      const finish = () => {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      };

      // Persist the conversation so it survives reloads and is shared between
      // Desk and Fadi modes (both load the same history). Best-effort.
      const agentRepo = createAgentMessagesRepository(getDatabase());
      agentRepo.createForUser(user.id, { role: "user", content: message }).catch(() => {});
      const saveAssistant = async (text: string, toolNames?: string) => {
        if (!text.trim()) return;
        try {
          await agentRepo.createForUser(user.id, {
            role: "assistant",
            content: text,
            metadata: toolNames ? { tools: toolNames } : {},
          });
        } catch {
          /* best-effort */
        }
      };

      // Agentic path: try each tool-capable provider (primary → fallback) so Fadi
      // stays up when one is rate-limited/exhausted (e.g. Groq's daily cap).
      for (const tp of toolProviders) {
        try {
          const result = await tp.runWithTools!(
            messages,
            tools,
            (name, args) => executeFadiTool(name, args, toolCtx),
            { temperature: 0.6 },
            {
              // Render result cards as soon as the tools run…
              onToolResults: (results) => {
                if (results.length > 0) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ fadiTools: results })}\n\n`),
                  );
                }
              },
              // …then stream Fadi's answer token by token.
              onToken: (t) => sendText(t),
            },
          );
          // Answer already streamed via onToken; backfill a line if a tool ran
          // but produced no narration.
          if (!result.text.trim() && result.toolResults.length > 0) sendText("Here's what I found.");
          const saved = result.text.trim() || (result.toolResults.length > 0 ? "Here's what I found." : "");
          await saveAssistant(saved, result.toolResults.map((t) => t.name).join(", ") || undefined);
          logger.info("fadi.chat.completed", {
            userId: user.id,
            provider: tp.id,
            tools: result.toolResults.map((t) => t.name).join(", "),
          });
          finish();
          return;
        } catch (err) {
          logger.warn("fadi.chat.tool_run_failed", {
            userId: user.id,
            provider: tp.id,
            error: err instanceof Error ? err.message : "unknown",
          });
          // Try the next provider in the chain.
        }
      }

      // Every tool provider failed (e.g. all keys rate-limited). Deterministic
      // safety net so Fadi still ACTS for the common intents rather than
      // fabricating or just writing prose.
      {
        {
          // Document drafting intent → generate_document (writes into the editor).
          if (
            /\b(generate|draft|write|create|make|build|tailor)\b/i.test(message) &&
            /\b(resume|cv|cover[\s-]?letter|cold email|value prop(osition)?|vpd)\b/i.test(message)
          ) {
            try {
              const kind = /cover[\s-]?letter/i.test(message)
                ? "cover_letter"
                : /\bemail\b/i.test(message)
                  ? "email"
                  : /value prop|vpd/i.test(message)
                    ? "value_proposition"
                    : "resume";
              const r = await executeFadiTool("generate_document", { kind }, toolCtx);
              if (r.data) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ fadiTools: [{ name: "generate_document", view: r.view ?? "document", data: r.data }] })}\n\n`,
                  ),
                );
              }
              sendText(r.summary);
              await saveAssistant(r.summary, "generate_document");
              logger.info("fadi.chat.completed", { userId: user.id, tools: "generate_document(fallback)" });
              finish();
              return;
            } catch (toolErr) {
              logger.warn("fadi.chat.fallback_tool_failed", {
                userId: user.id,
                error: toolErr instanceof Error ? toolErr.message : "unknown",
              });
            }
          }

          // Job-search intent → real live cards (never fabricated listings).
          if (/\b(jobs?|roles?|positions?|openings?|listings?|vacanc|hiring)\b/i.test(message)) {
            try {
              const r = await executeFadiTool("search_jobs", { location: message }, toolCtx);
              if (r.data) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ fadiTools: [{ name: "search_jobs", view: r.view ?? "jobs", data: r.data }] })}\n\n`,
                  ),
                );
              }
              sendText(r.summary);
              await saveAssistant(r.summary, "search_jobs");
              logger.info("fadi.chat.completed", { userId: user.id, tools: "search_jobs(fallback)" });
              finish();
              return;
            } catch (toolErr) {
              logger.warn("fadi.chat.fallback_tool_failed", {
                userId: user.id,
                error: toolErr instanceof Error ? toolErr.message : "unknown",
              });
            }
          }
          // Otherwise fall through to a plain stream (anti-fabrication is enforced
          // by Fadi's system prompt) so Fadi still answers conversationally.
        }
      }

      // Fallback: plain resilient stream (no tools).
      const reader = createResilientChatStream(chain, messages, { temperature: 0.6 }).getReader();
      let streamed = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          streamed += value;
          sendText(value);
        }
      } catch (err) {
        logger.error("fadi.chat.stream_error", {
          userId: user.id,
          error: err instanceof Error ? err.message : "unknown",
        });
        sendText("\n\nSomething went wrong. Please try again.");
      } finally {
        await saveAssistant(streamed);
        reader.releaseLock();
        finish();
      }
    },
  });

  return new Response(sseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
