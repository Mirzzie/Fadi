import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { createAgentRunsRepository } from "@careeros/database";
import { getDatabase } from "@/lib/database/client";

/**
 * The OS activity feed — recent background-agency findings (the auditable ledger
 * behind Scout's "while you were away" work). GET returns the recent feed plus an
 * unseen count for the menu-bar bell; POST marks everything seen once the user has
 * looked. No generation here: every row traces to an agent_findings entry.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const user = await getCurrentAuthUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const repo = createAgentRunsRepository(getDatabase());
  const [recent, unseen] = await Promise.all([
    repo.listRecentForUser(user.id, 12),
    repo.listUnseenForUser(user.id, 20),
  ]);

  return Response.json({
    unseenCount: unseen.length,
    findings: recent.map((f) => ({
      id: f.id,
      kind: f.kind,
      title: f.title,
      detail: f.detail,
      href: f.href,
      seen: f.seenAt != null,
      createdAt: f.createdAt,
    })),
  });
}

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const user = await getCurrentAuthUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  await createAgentRunsRepository(getDatabase()).markSeenForUser(user.id);
  return Response.json({ ok: true });
}
