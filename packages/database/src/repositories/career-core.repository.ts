import { createHash } from "node:crypto";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import type { Database } from "../client";
import {
  careerRecordVersions,
  careerSourceVersions,
  type CareerRecordSnapshot,
  type CareerRecordVersion,
  type CareerSourceVersion,
} from "../schema/index";

/**
 * MY CAREER: keeping what arrived, and every approved state of a fact.
 *
 * Both writes are append-only on purpose. An import that overwrites the previous text destroys
 * the only thing that makes a later comparison possible ("is this externally edited CV saying
 * something new, or the same work worded differently?"). A correction that overwrites a fact
 * destroys the answer to "what did this say when I sent that application?".
 *
 * Neither table makes a claim true. They record what was said, when, and by which route.
 */
export function createCareerCoreRepository(db: Database) {
  return {
    /**
     * Keep an imported source. Identical content reuses the version it already has, so saving the
     * same CV twice does not manufacture a second one; different content appends a new version.
     */
    async preserveSource(
      userId: string,
      input: { sourceKind: string; sourceKey: string; content: string }
    ): Promise<{ version: CareerSourceVersion; reused: boolean }> {
      const content = input.content;
      const contentHash = createHash("sha256").update(content).digest("hex");

      // Serialized per stream: two imports landing together must not both claim version N.
      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(careerSourceVersions)
          .where(
            and(
              eq(careerSourceVersions.userId, userId),
              eq(careerSourceVersions.sourceKind, input.sourceKind),
              eq(careerSourceVersions.sourceKey, input.sourceKey),
              eq(careerSourceVersions.contentHash, contentHash)
            )
          )
          .limit(1);
        if (existing) return { version: existing, reused: true };

        const [{ next }] = await tx
          .select({
            next: sql<number>`coalesce(max(${careerSourceVersions.version}), 0) + 1`,
          })
          .from(careerSourceVersions)
          .where(
            and(
              eq(careerSourceVersions.userId, userId),
              eq(careerSourceVersions.sourceKind, input.sourceKind),
              eq(careerSourceVersions.sourceKey, input.sourceKey)
            )
          );

        const [created] = await tx
          .insert(careerSourceVersions)
          .values({
            userId,
            sourceKind: input.sourceKind,
            sourceKey: input.sourceKey,
            version: Number(next),
            content,
            contentHash,
          })
          .returning();
        return { version: created, reused: false };
      });
    },

    /** Every version of one source stream, oldest first — the material for a three-way compare. */
    async listSourceVersions(
      userId: string,
      sourceKind: string,
      sourceKey: string
    ): Promise<CareerSourceVersion[]> {
      return db
        .select()
        .from(careerSourceVersions)
        .where(
          and(
            eq(careerSourceVersions.userId, userId),
            eq(careerSourceVersions.sourceKind, sourceKind),
            eq(careerSourceVersions.sourceKey, sourceKey)
          )
        )
        .orderBy(asc(careerSourceVersions.version));
    },

    /**
     * Append the current state of a fact.
     *
     * Called after the evidence gate has decided WHAT the fact is; this records THAT decision.
     * An unchanged state is not re-recorded — re-saving a document must not inflate a fact's
     * history — so the version count stays a count of real changes.
     */
    async recordFactVersion(
      userId: string,
      input: {
        factId: string;
        snapshot: CareerRecordSnapshot;
        status?: "active" | "retracted";
        sourceVersionId?: string | null;
      }
    ): Promise<{ version: CareerRecordVersion; unchanged: boolean }> {
      const status = input.status ?? "active";
      return db.transaction(async (tx) => {
        const [latest] = await tx
          .select()
          .from(careerRecordVersions)
          .where(
            and(
              eq(careerRecordVersions.userId, userId),
              eq(careerRecordVersions.factId, input.factId)
            )
          )
          .orderBy(desc(careerRecordVersions.version))
          .limit(1);

        if (
          latest &&
          latest.status === status &&
          stableJson(latest.snapshot) === stableJson(input.snapshot)
        ) {
          return { version: latest, unchanged: true };
        }

        const [created] = await tx
          .insert(careerRecordVersions)
          .values({
            userId,
            factId: input.factId,
            version: (latest?.version ?? 0) + 1,
            status,
            snapshot: input.snapshot,
            sourceVersionId: input.sourceVersionId ?? null,
          })
          .returning();
        return { version: created, unchanged: false };
      });
    },

    /** The history of one fact, oldest first. */
    async listFactVersions(userId: string, factId: string): Promise<CareerRecordVersion[]> {
      return db
        .select()
        .from(careerRecordVersions)
        .where(
          and(eq(careerRecordVersions.userId, userId), eq(careerRecordVersions.factId, factId))
        )
        .orderBy(asc(careerRecordVersions.version));
    },

    /** The current state of a fact — what a generator is allowed to draw on. */
    async currentFactVersion(
      userId: string,
      factId: string
    ): Promise<CareerRecordVersion | null> {
      const [latest] = await db
        .select()
        .from(careerRecordVersions)
        .where(
          and(eq(careerRecordVersions.userId, userId), eq(careerRecordVersions.factId, factId))
        )
        .orderBy(desc(careerRecordVersions.version))
        .limit(1);
      return latest ?? null;
    },
  };
}

/**
 * Compare two snapshots by CONTENT, not by key order.
 *
 * Postgres stores jsonb with its own key ordering, so a snapshot read back never matches the
 * object that produced it under a plain JSON.stringify — every save then looked like a change
 * and a person's history filled with identical versions.
 */
function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`);
  return `{${entries.join(",")}}`;
}
