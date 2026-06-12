import "server-only";

import {
  createAgentMessagesRepository,
  createAgentRunsRepository,
  type AgentFinding,
} from "@careeros/database";

import { getDatabase } from "@/lib/database/client";

import { composeDigestMessage, composeDigestSubline } from "./digest-format";

/**
 * The "since you were away" digest. Composed ONLY from agent_findings rows —
 * every sentence traces to a ledger entry, so Scout's claim of background work
 * is auditable, never generated. No findings → no digest → no claim.
 */

export type AgencyDigest = {
  findings: AgentFinding[];
  lastRunAt: Date | null;
  /** Scout-voiced digest, ready to land in chat / be spoken. */
  message: string;
};

export async function getAgencyDigest(userId: string): Promise<AgencyDigest | null> {
  const db = getDatabase();
  const runsRepo = createAgentRunsRepository(db);

  const [findings, lastRun] = await Promise.all([
    runsRepo.listUnseenForUser(userId, 12),
    runsRepo.getLastFinishedRunForUser(userId),
  ]);

  if (findings.length === 0) return null;

  return {
    findings,
    lastRunAt: lastRun?.finishedAt ? new Date(lastRun.finishedAt) : null,
    message: composeDigestMessage(findings),
  };
}

/**
 * Persist the digest as Scout's opening chat message and mark its findings seen
 * — one delivery per finding, shared across Desk and Scout modes via the same
 * agent_messages history.
 */
export async function deliverDigestToChat(userId: string, digest: AgencyDigest): Promise<void> {
  const db = getDatabase();
  await createAgentMessagesRepository(db).createForUser(userId, {
    role: "assistant",
    content: digest.message,
    metadata: {
      digest: true,
      findingIds: digest.findings.map((f) => f.id),
    },
  });
  await createAgentRunsRepository(db).markSeenForUser(userId);
}

/** Short spoken/subline form — the orb greeting, not the full briefing. */
export function digestSubline(digest: AgencyDigest): string {
  return composeDigestSubline(digest.findings);
}
