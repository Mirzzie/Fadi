import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { createAgentMessagesRepository } from "@careeros/database";
import { getDatabase } from "@/lib/database/client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fadi's persisted conversation — loaded on mount so Desk and Fadi modes share
 *  the same history and chats survive reloads. */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const user = await getCurrentAuthUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // ?workItem=<id> reads that piece of work's thread; without it, the general conversation.
  // The id is only a filter on rows that are already this person's, so a wrong one reads empty.
  const requested = new URL(request.url).searchParams.get("workItem");
  const workItemId = requested && UUID.test(requested) ? requested : null;

  const repo = createAgentMessagesRepository(getDatabase());
  const rows = await repo.listRecentForUser(user.id, 50, { workItemId });

  return Response.json({
    messages: rows.map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      // Lets the client announce (speak) a digest that landed while the user
      // was away — only acted on when it's the newest message and still fresh.
      isDigest: Boolean((r.metadata as Record<string, unknown> | null)?.digest),
      createdAt: r.createdAt,
    })),
  });
}
