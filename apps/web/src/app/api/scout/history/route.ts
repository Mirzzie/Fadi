import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { createAgentMessagesRepository } from "@careeros/database";
import { getDatabase } from "@/lib/database/client";

/** Scout's persisted conversation — loaded on mount so Desk and Scout modes share
 *  the same history and chats survive reloads. */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const user = await getCurrentAuthUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const repo = createAgentMessagesRepository(getDatabase());
  const rows = await repo.listRecentForUser(user.id, 50);

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
