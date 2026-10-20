import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";

import type { Database } from "../client";
import {
  portfolioItems,
  portfolioSites,
  type NewPortfolioItem,
  type NewPortfolioSite,
  type PortfolioItem,
  type PortfolioSite,
} from "../schema";

/**
 * Portfolio sites + items — a presentation projection of the evidence pool.
 * Every method is scoped by user_id (no cross-user reads/writes), except the
 * explicitly public `getPublishedByHandle`, which the Content API uses to serve
 * a live site and returns ONLY published data.
 */
export function createPortfolioRepository(db: Database) {
  return {
    /* ------------------------------- sites ------------------------------- */

    async listSitesForUser(userId: string): Promise<PortfolioSite[]> {
      return db
        .select()
        .from(portfolioSites)
        .where(eq(portfolioSites.userId, userId))
        .orderBy(asc(portfolioSites.createdAt));
    },

    async getSiteForUser(userId: string, siteId: string): Promise<PortfolioSite | null> {
      const [row] = await db
        .select()
        .from(portfolioSites)
        .where(and(eq(portfolioSites.id, siteId), eq(portfolioSites.userId, userId)))
        .limit(1);
      return row ?? null;
    },

    async isHandleAvailable(handle: string, exceptSiteId?: string): Promise<boolean> {
      const [row] = await db
        .select({ id: portfolioSites.id })
        .from(portfolioSites)
        .where(eq(portfolioSites.handle, handle))
        .limit(1);
      return !row || row.id === exceptSiteId;
    },

    async createSite(
      userId: string,
      input: Omit<NewPortfolioSite, "id" | "userId" | "createdAt" | "updatedAt">,
    ): Promise<PortfolioSite> {
      const [created] = await db
        .insert(portfolioSites)
        .values({ ...input, userId })
        .returning();
      return created;
    },

    async updateSite(
      userId: string,
      siteId: string,
      patch: Partial<
        Pick<
          PortfolioSite,
          | "handle"
          | "title"
          | "headline"
          | "template"
          | "theme"
          | "profile"
          | "resumeLinks"
          | "isPublished"
          | "careerProfileId"
        >
      >,
    ): Promise<PortfolioSite | null> {
      const [updated] = await db
        .update(portfolioSites)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(portfolioSites.id, siteId), eq(portfolioSites.userId, userId)))
        .returning();
      return updated ?? null;
    },

    async deleteSite(userId: string, siteId: string): Promise<void> {
      await db
        .delete(portfolioSites)
        .where(and(eq(portfolioSites.id, siteId), eq(portfolioSites.userId, userId)));
    },

    /* ------------------------------- items ------------------------------- */

    async listItemsForUser(userId: string, siteId: string): Promise<PortfolioItem[]> {
      return db
        .select()
        .from(portfolioItems)
        .where(and(eq(portfolioItems.userId, userId), eq(portfolioItems.siteId, siteId)))
        .orderBy(asc(portfolioItems.section), asc(portfolioItems.sortOrder));
    },

    async getItemForUser(userId: string, id: string): Promise<PortfolioItem | null> {
      const [row] = await db
        .select()
        .from(portfolioItems)
        .where(and(eq(portfolioItems.id, id), eq(portfolioItems.userId, userId)))
        .limit(1);
      return row ?? null;
    },

    async createItem(
      userId: string,
      input: Omit<NewPortfolioItem, "id" | "userId" | "createdAt" | "updatedAt">,
    ): Promise<PortfolioItem> {
      const [created] = await db
        .insert(portfolioItems)
        .values({ ...input, userId })
        .returning();
      return created;
    },

    async createItems(
      userId: string,
      rows: Array<Omit<NewPortfolioItem, "id" | "userId" | "createdAt" | "updatedAt">>,
    ): Promise<PortfolioItem[]> {
      if (rows.length === 0) return [];
      return db
        .insert(portfolioItems)
        .values(rows.map((r) => ({ ...r, userId })))
        .returning();
    },

    async updateItem(
      userId: string,
      id: string,
      patch: Partial<
        Pick<
          PortfolioItem,
          | "section"
          | "title"
          | "subtitle"
          | "location"
          | "dateRange"
          | "description"
          | "bullets"
          | "roles"
          | "tag"
          | "url"
          | "imageUrl"
          | "gallery"
          | "sortOrder"
          | "isPublished"
          | "confirmedAt"
        >
      >,
    ): Promise<PortfolioItem | null> {
      // EDITING IS CONFIRMING. The owner had the row open and changed it, so there is
      // nothing further to ask — requiring a second, separate confirmation for work
      // they just did by hand would be the kind of ceremony that trains people to
      // click past it.
      const [updated] = await db
        .update(portfolioItems)
        .set({ confirmedAt: new Date(), ...patch, updatedAt: new Date() })
        .where(and(eq(portfolioItems.id, id), eq(portfolioItems.userId, userId)))
        .returning();
      return updated ?? null;
    },

    /** Confirm rows that arrived automatically — the one action the gate needs. */
    async confirmItems(userId: string, ids: string[]): Promise<number> {
      if (ids.length === 0) return 0;
      const rows = await db
        .update(portfolioItems)
        .set({ confirmedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(portfolioItems.userId, userId), inArray(portfolioItems.id, ids)))
        .returning({ id: portfolioItems.id });
      return rows.length;
    },

    async deleteItem(userId: string, id: string): Promise<void> {
      await db
        .delete(portfolioItems)
        .where(and(eq(portfolioItems.id, id), eq(portfolioItems.userId, userId)));
    },

    /**
     * Replace a site's entire item set atomically (the import "replace" mode).
     *
     * MUST be one transaction. As a bare delete-then-insert, a failure after the
     * delete destroyed every portfolio item the user had and inserted nothing — the
     * worst data-loss path in the platform, triggered by a routine import. Inside a
     * transaction the failure rolls back and the user keeps what they had.
     *
     * The delete is a single statement scoped by (userId, siteId) rather than a loop
     * of per-id deletes, so it cannot partially apply.
     */
    async replaceItems(
      userId: string,
      siteId: string,
      rows: Array<Omit<NewPortfolioItem, "id" | "userId" | "createdAt" | "updatedAt">>,
    ): Promise<PortfolioItem[]> {
      return db.transaction(async (tx) => {
        await tx
          .delete(portfolioItems)
          .where(and(eq(portfolioItems.userId, userId), eq(portfolioItems.siteId, siteId)));
        if (rows.length === 0) return [];
        return tx
          .insert(portfolioItems)
          .values(rows.map((r) => ({ ...r, userId })))
          .returning();
      });
    },

    /** Persist a new order: sort_order = position * 10, in a single transaction. */
    async reorderItems(userId: string, orderedIds: string[]): Promise<void> {
      if (orderedIds.length === 0) return;
      await db.transaction(async (tx) => {
        for (let i = 0; i < orderedIds.length; i += 1) {
          await tx
            .update(portfolioItems)
            .set({ sortOrder: (i + 1) * 10, updatedAt: new Date() })
            .where(and(eq(portfolioItems.id, orderedIds[i]), eq(portfolioItems.userId, userId)));
        }
      });
    },

    /* ------------------------- public (Content API) ------------------------- */

    /** Public read for the renderer: a PUBLISHED site + only its PUBLISHED items. */
    async getPublishedByHandle(
      handle: string,
    ): Promise<{ site: PortfolioSite; items: PortfolioItem[] } | null> {
      const [site] = await db
        .select()
        .from(portfolioSites)
        .where(and(eq(portfolioSites.handle, handle), eq(portfolioSites.isPublished, true)))
        .limit(1);
      if (!site) return null;

      // THE PUBLISH GATE. Published AND confirmed — a row that arrived automatically
      // and has never been looked at does not reach a stranger, however much the rest
      // of the platform is still moving underneath it.
      const items = await db
        .select()
        .from(portfolioItems)
        .where(
          and(
            eq(portfolioItems.siteId, site.id),
            eq(portfolioItems.isPublished, true),
            isNotNull(portfolioItems.confirmedAt),
          ),
        )
        .orderBy(asc(portfolioItems.section), asc(portfolioItems.sortOrder));

      return { site, items };
    },
  };
}
