import "server-only";

import { buildNotionProperties, type NotionApplication } from "./notion-map";

export type { NotionApplication } from "./notion-map";
export { buildNotionProperties } from "./notion-map";

/**
 * Notion sync — push the user's applications into THEIR Notion database. BYO
 * token (a Notion internal-integration secret + the target database id, shared
 * with that integration), consistent with our bring-your-own-key ethos: no
 * Notion OAuth app to run, no third party holding user data.
 */

const NOTION_API = "https://api.notion.com/v1/pages";
const NOTION_VERSION = "2022-06-28";

export interface NotionSyncResult {
  created: number;
  failed: number;
}

/**
 * Create one Notion page per application in the given database. Best-effort:
 * individual failures are counted, never thrown, so one bad row can't sink the
 * whole sync. Returns how many landed.
 */
export async function syncApplicationsToNotion(
  token: string,
  databaseId: string,
  apps: NotionApplication[],
): Promise<NotionSyncResult> {
  let created = 0;
  let failed = 0;

  for (const app of apps) {
    try {
      const res = await fetch(NOTION_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parent: { database_id: databaseId },
          properties: buildNotionProperties(app),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) created += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }

  return { created, failed };
}
