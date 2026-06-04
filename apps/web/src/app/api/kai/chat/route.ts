import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth/auth";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { buildProviderChain } from "@/lib/ai/registry";
import { getUserProviderConfigs } from "@/lib/ai/user-settings";
import { createResilientChatStream } from "@/lib/ai/resilient";
import { buildKaiContext } from "@/lib/ai/context/builder";
import { buildKaiMessages } from "@/lib/ai/prompts/system";
import { logger } from "@/lib/observability/logger";

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
  const context = await buildKaiContext(user.id);

  if (!context) {
    return new Response(
      JSON.stringify({ error: "Complete onboarding before talking to Kai." }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    );
  }

  // Build messages
  const messages = buildKaiMessages(context, history, message);

  // Resolve the user's provider chain (primary → fallback) and stream resiliently:
  // retry transient rate limits, switch providers when one is exhausted.
  const chain = buildProviderChain(await getUserProviderConfigs(user.id));

  logger.info("kai.chat.started", {
    userId: user.id,
    providers: chain.map((p) => `${p.id}:${p.model}`).join(", "),
    historyLength: history.length,
  });

  const stream = createResilientChatStream(chain, messages, { temperature: 0.6 });

  // Encode as SSE text/event-stream
  const encoder = new TextEncoder();

  const sseStream = new ReadableStream({
    async start(controller) {
      const reader = stream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            break;
          }

          // Escape the value for SSE
          const escaped = JSON.stringify(value);
          controller.enqueue(encoder.encode(`data: ${escaped}\n\n`));
        }
      } catch (err) {
        logger.error("kai.chat.stream_error", {
          userId: user.id,
          error: err instanceof Error ? err.message : "unknown",
        });
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify("\n\nSomething went wrong. Please try again.")}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
        reader.releaseLock();
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
