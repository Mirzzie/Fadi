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

    async get(userId: string, id: string): Promise<LabResource | null> {
      const [row] = await db
        .select()
        .from(labResources)
        .where(and(eq(labResources.userId, userId), eq(labResources.id, id)))
        .limit(1);
      return row ?? null;
    },

    /**
     * Record a machine Fadi DETECTED, without accumulating a copy per click.
     *
     * Detection is idempotent by nature — looking at this laptop twice finds the same
     * laptop — so the registry must reconcile rather than append. Three clicks of "detect"
     * produced three identical rows, which then made placement read "unmeasured: This
     * machine, This machine, This machine" and turned an inventory into noise.
     *
     * Matched on label because that is what detection produces deterministically: the same
     * machine yields the same label every time. A row the PERSON wrote with the same label
     * is updated too, which is the friendlier reading of typing the same name twice.
     *
     * Never nulls a value that is already recorded: a detection run without host access
     * knows less than the row it is updating, and letting it overwrite memory with null
     * would make the registry worse every time someone declined a permission.
     */
    async upsertDetected(
      userId: string,
      input: Omit<NewLabResource, "id" | "userId" | "createdAt" | "updatedAt">,
    ): Promise<LabResource> {
      const [existing] = await db
        .select()
        .from(labResources)
        .where(and(eq(labResources.userId, userId), eq(labResources.label, input.label)))
        .limit(1);

      if (!existing) {
        const [row] = await db.insert(labResources).values({ ...input, userId }).returning();
        return row;
      }

      const [row] = await db
        .update(labResources)
        .set({
          kind: input.kind ?? existing.kind,
          arch: input.arch ?? existing.arch,
          virtualization: input.virtualization ?? existing.virtualization,
          memoryMb: input.memoryMb ?? existing.memoryMb,
          diskGb: input.diskGb ?? existing.diskGb,
          notes: input.notes ?? existing.notes,
          endpoint: input.endpoint ?? existing.endpoint,
          scopes: input.scopes ?? existing.scopes,
          updatedAt: new Date(),
        })
        .where(eq(labResources.id, existing.id))
        .returning();
      return row;
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
