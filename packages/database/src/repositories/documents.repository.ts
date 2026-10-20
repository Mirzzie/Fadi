import { and, desc, eq, isNull, or } from "drizzle-orm";

import type { Database } from "../client";
import {
  documentRevisions,
  documents,
  type Document,
  type DocumentRevision,
  type DocumentRevisionSnapshot,
} from "../schema";

export type DocumentKind = "resume" | "cover_letter" | "email" | "value_proposition" | "note";

export type CreateDocumentInput = {
  careerProfileId?: string | null;
  jobId?: string | null;
  applicationId?: string | null;
  kind: DocumentKind | string;
  title: string;
  content?: string;
  format?: string;
  template?: string | null;
  jobContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type UpdateDocumentInput = Partial<{
  title: string;
  content: string;
  format: string;
  template: string | null;
  jobContext: Record<string, unknown>;
  metadata: Record<string, unknown>;
}>;

export type UpdateDocumentResult =
  | { status: "updated"; document: Document }
  | { status: "conflict"; document: Document }
  | { status: "not_found" };

function revisionSnapshot(doc: Document): DocumentRevisionSnapshot {
  return {
    title: doc.title,
    content: doc.content,
    format: doc.format,
    template: doc.template,
    jobContext: doc.jobContext,
    metadata: doc.metadata,
  };
}

export function createDocumentsRepository(db: Database) {
  return {
    /** All of a user's documents. Pass a track to scope to that career path
     *  (plus legacy/untagged docs, so nothing disappears after the migration). */
    async listForUser(userId: string, careerProfileId?: string | null): Promise<Document[]> {
      const scope = careerProfileId
        ? and(
            eq(documents.userId, userId),
            or(eq(documents.careerProfileId, careerProfileId), isNull(documents.careerProfileId)),
          )
        : eq(documents.userId, userId);
      return db.select().from(documents).where(scope).orderBy(desc(documents.updatedAt));
    },

    async listForJob(userId: string, jobId: string): Promise<Document[]> {
      return db
        .select()
        .from(documents)
        .where(and(eq(documents.userId, userId), eq(documents.jobId, jobId)))
        .orderBy(desc(documents.updatedAt));
    },

    async getForUser(userId: string, id: string): Promise<Document | null> {
      const [doc] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.userId, userId), eq(documents.id, id)))
        .limit(1);
      return doc ?? null;
    },

    async listRevisionsForUser(userId: string, documentId: string): Promise<DocumentRevision[]> {
      return db
        .select()
        .from(documentRevisions)
        .where(
          and(eq(documentRevisions.userId, userId), eq(documentRevisions.documentId, documentId))
        )
        .orderBy(desc(documentRevisions.version));
    },

    async getRevisionForUser(
      userId: string,
      documentId: string,
      version: number
    ): Promise<DocumentRevision | null> {
      const [revision] = await db
        .select()
        .from(documentRevisions)
        .where(
          and(
            eq(documentRevisions.userId, userId),
            eq(documentRevisions.documentId, documentId),
            eq(documentRevisions.version, version)
          )
        )
        .limit(1);
      return revision ?? null;
    },

    async createForUser(userId: string, input: CreateDocumentInput): Promise<Document> {
      return db.transaction(async (tx) => {
        const [doc] = await tx
          .insert(documents)
          .values({
            userId,
            careerProfileId: input.careerProfileId ?? null,
            jobId: input.jobId ?? null,
            applicationId: input.applicationId ?? null,
            kind: input.kind,
            title: input.title,
            content: input.content ?? "",
            format: input.format ?? "richtext",
            template: input.template ?? null,
            jobContext: input.jobContext ?? {},
            metadata: input.metadata ?? {},
          })
          .returning();
        await tx.insert(documentRevisions).values({
          documentId: doc.id,
          userId,
          version: doc.version,
          snapshot: revisionSnapshot(doc),
        });
        return doc;
      });
    },

    /**
     * Compare-and-save a document the user owns. The row lock serializes concurrent
     * writers; expectedVersion rejects an older editor after the first writer wins.
     * Every accepted state is retained as an immutable revision in the same transaction.
     */
    async updateForUser(
      userId: string,
      id: string,
      expectedVersion: number,
      input: UpdateDocumentInput
    ): Promise<UpdateDocumentResult> {
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(documents)
          .where(and(eq(documents.userId, userId), eq(documents.id, id)))
          .limit(1)
          .for("update");
        if (!current) return { status: "not_found" };
        if (current.version !== expectedVersion) {
          return { status: "conflict", document: current };
        }

        // Existing documents predate revision storage. Preserve the loaded state
        // before its first versioned update; the unique key makes this idempotent.
        await tx
          .insert(documentRevisions)
          .values({
            documentId: current.id,
            userId,
            version: current.version,
            snapshot: revisionSnapshot(current),
          })
          .onConflictDoNothing({
            target: [documentRevisions.documentId, documentRevisions.version],
          });

        const [updated] = await tx
          .update(documents)
          .set({ ...input, version: current.version + 1, updatedAt: new Date() })
          .where(
            and(
              eq(documents.userId, userId),
              eq(documents.id, id),
              eq(documents.version, expectedVersion)
            )
          )
          .returning();
        if (!updated) {
          const [winner] = await tx
            .select()
            .from(documents)
            .where(and(eq(documents.userId, userId), eq(documents.id, id)))
            .limit(1);
          return winner ? { status: "conflict", document: winner } : { status: "not_found" };
        }

        await tx.insert(documentRevisions).values({
          documentId: updated.id,
          userId,
          version: updated.version,
          snapshot: revisionSnapshot(updated),
        });
        return { status: "updated", document: updated };
      });
    },

    async deleteForUser(userId: string, id: string): Promise<void> {
      await db.delete(documents).where(and(eq(documents.userId, userId), eq(documents.id, id)));
    },
  };
}
