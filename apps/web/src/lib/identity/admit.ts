import "server-only";

import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { createEvidenceRepository, type Database, type EvidenceItem } from "@careeros/database";
import { findSameThings, identicalRecord, type IdentityInput } from "@careeros/portfolio";
import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";

// Legacy rendering markers remain readable; new uncertainty lives in reviewStatus.
export const UNCONFIRMED_LINK = "unconfirmed-auto-link";
export const NEEDS_DECISION = "needs-your-decision";

export type Candidate = {
  kind: string;
  title: string;
  organization?: string | null;
  attribution?: string | null;
  period?: string | null;
  detail?: string | null;
  metrics?: string | null;
  tags?: string[] | null;
  marketTags?: string[] | null;
  url?: string | null;
  imageUrl?: string | null;
};
export type Authorship = "human" | "machine";
export function authorshipOf(origin: string | null | undefined): Authorship {
  return origin === "ai" || origin === "learning" ? "machine" : "human";
}

export type Admission =
  | { decision: "create" }
  | { decision: "absorb"; intoId: string; factId: string; sure: true; reasons: string[] }
  | { decision: "review"; intoId: string; factId: string; sure: false; reasons: string[] };

type Meta = {
  factId: string;
  origin?: string | null;
  detail?: string | null;
  reviewStatus?: string;
  isCanonical?: boolean;
};
type Input = Candidate & { origin?: string };

export function toIdentity(c: Candidate, id: string): IdentityInput {
  return {
    id,
    kind: c.kind,
    title: c.title,
    organization: c.organization ?? null,
    attribution: c.attribution ?? "personal",
    period: c.period ?? null,
    detail: c.detail ?? null,
    metrics: c.metrics ?? null,
    url: c.url ?? null,
    imageUrl: c.imageUrl ?? null,
    // Market vocabulary ranks relevance; it must not manufacture identity.
    tags: c.tags ?? [],
  };
}

/** Exact replay reuses a row; all inferred sameness requires a decision. */
export function admitAgainst(
  candidate: Input,
  pool: IdentityInput[],
  meta: (id: string) => Meta
): Admission {
  const me = toIdentity(candidate, "__candidate__");
  const exact = pool.find((item) => identicalRecord(me, item));
  if (exact)
    return {
      decision: "absorb",
      intoId: exact.id,
      factId: meta(exact.id).factId,
      sure: true,
      reasons: ["identical recorded fields"],
    };
  // Pending candidates can be replayed but must not become anchors for other candidates.
  const accepted = pool.filter(
    (item) => meta(item.id).reviewStatus !== "pending" && meta(item.id).isCanonical !== false
  );
  const match = findSameThings([me, ...accepted]).find((m) => m.a === me.id || m.b === me.id);
  if (!match) return { decision: "create" };
  const intoId = match.a === me.id ? match.b : match.a;
  return {
    decision: "review",
    intoId,
    factId: meta(intoId).factId,
    sure: false,
    reasons: match.reasons,
  };
}

function normalize(c: Input) {
  return {
    kind: c.kind,
    title: c.title.trim(),
    organization: c.organization?.trim() || null,
    attribution: c.attribution ?? "personal",
    period: c.period?.trim() || null,
    detail: (c.detail ?? "").trim(),
    metrics: c.metrics?.trim() || null,
    tags: (c.tags ?? [])
      .map((t) => t.toLowerCase().trim())
      .filter(Boolean)
      .slice(0, 8),
    marketTags: (c.marketTags ?? [])
      .map((t) => t.toLowerCase().trim())
      .filter(Boolean)
      .slice(0, 8),
    origin: c.origin ?? "manual",
  };
}

type Admitted = { row: EvidenceItem; admission: Admission; insertedId: string };

/** Caller holds the owner row lock throughout read/decision/write. No provider calls. */
async function persist(userId: string, candidate: Input, db: Database): Promise<Admitted> {
  const repo = createEvidenceRepository(db);
  const existing = await repo.listAllForUser(userId);
  const admission = admitAgainst(
    candidate,
    existing.map((e) => toIdentity(e, e.id)),
    (id) => {
      const e = existing.find((row) => row.id === id)!;
      return {
        factId: e.factId ?? e.id,
        origin: e.origin,
        detail: e.detail,
        reviewStatus: e.reviewStatus,
        isCanonical: e.isCanonical,
      };
    }
  );
  if (admission.decision === "absorb") {
    const exact = existing.find((e) => e.id === admission.intoId)!;
    // listRenderings deliberately excludes canonicals. Read the actual fact leader.
    const row =
      exact.reviewStatus === "pending"
        ? exact
        : await repo.getCanonicalForFact(userId, admission.factId);
    if (!row) throw new Error("This evidence group needs repair before it can be reused.");
    return { row, admission, insertedId: exact.id };
  }
  const id = randomUUID();
  const row = await repo.create(userId, {
    ...normalize(candidate),
    id,
    factId: id,
    isCanonical: true,
    reviewStatus: admission.decision === "review" ? "pending" : "accepted",
    reviewTargetId: admission.decision === "review" ? admission.intoId : null,
    reviewReasons: admission.decision === "review" ? admission.reasons : [],
  });
  // MY CAREER keeps the history of this fact. Written in the SAME transaction as the fact
  // itself, so a fact can never exist without the record of how it came to say that. A record
  // held for review is recorded too, as pending — its history starts when it arrives, not when
  // someone gets round to deciding.
  await recordAdmittedVersion(db, userId, row);
  return { row, admission, insertedId: row.id };
}

/** Serialize admissions for one owner, including repeated and concurrent imports. */
export async function admitEvidence(
  userId: string,
  candidate: Input,
  options: { db?: Database } = {}
): Promise<Admitted> {
  return (options.db ?? getDatabase()).transaction(async (tx) => {
    await tx.execute(sql`select id from users where id = ${userId} for update`);
    return persist(userId, candidate, tx as unknown as Database);
  });
}

/** One transaction for the entire batch; later items see earlier writes. */
export async function admitEvidenceBatch(
  userId: string,
  candidates: Input[]
): Promise<{
  created: EvidenceItem[];
  absorbed: number;
  uncertain: number;
}> {
  return getDatabase().transaction(async (tx) => {
    await tx.execute(sql`select id from users where id = ${userId} for update`);
    const created: EvidenceItem[] = [];
    let absorbed = 0;
    const pendingIds = new Set<string>();
    for (const candidate of candidates) {
      const result = await persist(userId, candidate, tx as unknown as Database);
      if (result.admission.decision === "create") created.push(result.row);
      else if (result.admission.decision === "absorb") absorbed += 1;
      if (result.row.reviewStatus === "pending") pendingIds.add(result.row.id);
    }
    return { created, absorbed, uncertain: pendingIds.size };
  });
}

/**
 * Append this fact's current state to My Career.
 *
 * Best-effort by design: history is a record ABOUT the fact, and failing to write it must never
 * stop the person saving their own career. A miss is logged and the next change re-records the
 * state, because the snapshot is the whole state rather than a diff.
 */
async function recordAdmittedVersion(db: Database, userId: string, row: EvidenceItem): Promise<void> {
  try {
    const { createCareerCoreRepository } = await import("@careeros/database");
    await createCareerCoreRepository(db).recordFactVersion(userId, {
      factId: row.factId ?? row.id,
      status: row.reviewStatus === "pending" ? "retracted" : "active",
      snapshot: {
        evidenceItemId: row.id,
        kind: row.kind,
        title: row.title,
        organization: row.organization,
        period: row.period,
        detail: row.detail,
        metrics: row.metrics,
        tags: row.tags ?? [],
        origin: row.origin,
      },
    });
  } catch (error) {
    logger.warn("career.record_version_failed", {
      userId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
