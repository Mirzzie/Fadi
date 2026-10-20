import { and, desc, eq, isNull, or } from "drizzle-orm";

import type { Database } from "../client";
import { documents, type Document } from "../schema";

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

    async createForUser(userId: string, input: CreateDocumentInput): Promise<Document> {
      const [doc] = await db
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
      return doc;
    },

    /** Update a document the user owns; returns null if it isn't theirs. */
    async updateForUser(
      userId: string,
      id: string,
      input: UpdateDocumentInput
    ): Promise<Document | null> {
      const [doc] = await db
        .update(documents)
        .set({ ...input, updatedAt: new Date() })
        .where(and(eq(documents.userId, userId), eq(documents.id, id)))
        .returning();
      return doc ?? null;
    },

    async deleteForUser(userId: string, id: string): Promise<void> {
      await db.delete(documents).where(and(eq(documents.userId, userId), eq(documents.id, id)));
    },
  };
}
