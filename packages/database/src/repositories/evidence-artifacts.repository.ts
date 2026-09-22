import { and, asc, eq, inArray, or } from "drizzle-orm";

import type { DbOrTx } from "../client";
import {
  evidenceArtifacts,
  evidenceItems,
  type EvidenceArtifact,
  type NewEvidenceArtifact,
} from "../schema";

export type ProofInput = Pick<
  NewEvidenceArtifact,
  "kind" | "url" | "label" | "sortOrder" | "sourcePortfolioItemId"
>;

/** Proof for a fact, always scoped through the owning user. */
export function createEvidenceArtifactsRepository(db: DbOrTx) {
  async function ownerHasFact(userId: string, factId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: evidenceItems.id })
      .from(evidenceItems)
      .where(
        and(
          eq(evidenceItems.userId, userId),
          eq(evidenceItems.isCanonical, true),
          or(eq(evidenceItems.factId, factId), eq(evidenceItems.id, factId))
        )
      )
      .limit(1);
    return Boolean(row);
  }

  return {
    async listForUser(userId: string): Promise<EvidenceArtifact[]> {
      return db
        .select()
        .from(evidenceArtifacts)
        .where(eq(evidenceArtifacts.userId, userId))
        .orderBy(asc(evidenceArtifacts.factId), asc(evidenceArtifacts.sortOrder));
    },

    async listForFacts(userId: string, factIds: string[]): Promise<EvidenceArtifact[]> {
      if (factIds.length === 0) return [];
      return db
        .select()
        .from(evidenceArtifacts)
        .where(
          and(eq(evidenceArtifacts.userId, userId), inArray(evidenceArtifacts.factId, factIds))
        )
        .orderBy(asc(evidenceArtifacts.factId), asc(evidenceArtifacts.sortOrder));
    },

    /** Copy proof from a presentation into the durable fact-owned store. */
    async addForFact(
      userId: string,
      factId: string,
      proof: ProofInput[]
    ): Promise<EvidenceArtifact[]> {
      if (proof.length === 0) return [];
      if (!(await ownerHasFact(userId, factId))) throw new Error("Evidence fact unavailable.");
      return db
        .insert(evidenceArtifacts)
        .values(proof.map((item) => ({ ...item, userId, factId })))
        .onConflictDoNothing({
          target: [evidenceArtifacts.userId, evidenceArtifacts.factId, evidenceArtifacts.url],
        })
        .returning();
    },
  };
}
