import { getCurrentAuthUser } from "@/lib/auth/session";
import { createAgentRunsRepository } from "@careeros/database";
import { getDatabase } from "@/lib/database/client";

/**
 * The OS activity feed — recent background-agency findings (the auditable ledger
 * behind Fadi's "while you were away" work). GET returns the recent feed plus an
 * unseen count for the menu-bar bell; POST marks everything seen once the user has
 * looked. No generation here: every row traces to an agent_findings entry.
 */
export async function GET() {
  // getCurrentAuthUser resolves the session itself and returns null when absent,
  // so a single call both authenticates and yields the user (no double decode).
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
      href: deepLink(f.kind, f.href, f.data),
      seen: f.seenAt != null,
      createdAt: f.createdAt,
    })),
  });
}

/**
 * Resolve a finding's click target. A "new_role" finding carries its jobId, so we
 * deep-link to that job's workspace — which loads the job by id and so always opens
 * the actual role, even if the jobs board is filtered to a different location. Also
 * repairs older findings stored with the generic "/dashboard/jobs" href.
 */
function deepLink(kind: string, href: string | null, data: unknown): string | null {
  const jobId = (data as { jobId?: unknown } | null)?.jobId;
  if (kind === "new_role" && typeof jobId === "string") {
    return `/dashboard/applications/${jobId}/workspace`;
  }
  return href;
}

export async function POST() {
  // getCurrentAuthUser resolves the session itself and returns null when absent,
  // so a single call both authenticates and yields the user (no double decode).
  const user = await getCurrentAuthUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  await createAgentRunsRepository(getDatabase()).markSeenForUser(user.id);
  return Response.json({ ok: true });
}
