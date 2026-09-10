import { and, asc, eq } from "drizzle-orm";

import type { Database } from "../client";
import { labResources, type LabResource, type NewLabResource } from "../schema/index";

/**
 * What the user has to work with.
 *
 * Declared, never discovered — a resource exists because its owner described it. Fadi
 * does not scan a network or probe for machines, so the registry is only ever as
 * complete as the person chose to make it, which is also why an unmeasured attribute
 * has to read as "unknown" rather than "fine" everywhere downstream.
 */
export function createLabResourcesRepository(db: Database) {
  return {
    async listForUser(userId: string): Promise<LabResource[]> {
      return db
        .select()
        .from(labResources)
        .where(eq(labResources.userId, userId))
        .orderBy(asc(labResources.createdAt));
    },

    async create(
      userId: string,
      input: Omit<NewLabResource, "id" | "userId" | "createdAt" | "updatedAt">,
    ): Promise<LabResource> {
      const [row] = await db
        .insert(labResources)
        .values({ ...input, userId })
        .returning();
      return row;
    },

    async update(
      userId: string,
      id: string,
      patch: Partial<Pick<LabResource, "label" | "kind" | "arch" | "memoryMb" | "diskGb" | "virtualization" | "alwaysOn" | "notes">>,
    ): Promise<LabResource | null> {
      const [row] = await db
        .update(labResources)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(labResources.userId, userId), eq(labResources.id, id)))
        .returning();
      return row ?? null;
    },

    async remove(userId: string, id: string): Promise<void> {
      await db
        .delete(labResources)
        .where(and(eq(labResources.userId, userId), eq(labResources.id, id)));
    },
  };
}
