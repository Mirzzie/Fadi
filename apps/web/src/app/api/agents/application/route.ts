import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth/auth";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { buildKaiContext } from "@/lib/ai/context/builder";
import { resolveProviderForUser } from "@/lib/ai/registry";
import { applicationAgent } from "@/lib/agents/application.agent";
import { logger } from "@/lib/observability/logger";

const requestSchema = z.object({
  jobId: z.string().uuid(),
  jobTitle: z.string().optional(),
  jobCompany: z.string().optional(),
  jobDescription: z.string().max(12000).optional(),
  message: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .max(30)
    .optional()
    .default([]),
});

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await getCurrentAuthUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return new Response("Invalid request", { status: 400 });
  }

  const { jobId, jobTitle, jobCompany, jobDescription, message, history } = parsed.data;

  const userContext = await buildKaiContext(user.id);

  if (!userContext) {
    return new Response(
      JSON.stringify({ error: "Complete onboarding to use the application workspace." }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    );
  }

  const provider = resolveProviderForUser();

  logger.info("agent.application.started", {
    userId: user.id,
    jobId,
    provider: provider.name,
    model: provider.model,
  });

  const task = {
    id: crypto.randomUUID(),
    type: "application" as const,
    context: {
      userId: user.id,
      userContext,
      jobId,
      jobTitle,
      jobCompany,
      jobDescription,
    },
    input: message,
    conversationHistory: history,
  };

  const encoder = new TextEncoder();

  const sseStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of applicationAgent.stream(task, provider)) {
          const escaped = JSON.stringify(chunk.delta);
          controller.enqueue(encoder.encode(`data: ${escaped}\n\n`));

          if (chunk.artifact) {
            const artifactJson = JSON.stringify({ artifact: chunk.artifact });
            controller.enqueue(encoder.encode(`data: ${artifactJson}\n\n`));
          }
        }
      } catch (err) {
        logger.error("agent.application.stream_error", {
          userId: user.id,
          jobId,
          error: err instanceof Error ? err.message : "unknown",
        });
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify("\n\nSomething went wrong. Please try again.")}\n\n`,
          ),
        );
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
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
