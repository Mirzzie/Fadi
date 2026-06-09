/**
 * Pure Notion property mapping — no IO, no server-only, so it's unit-testable.
 * The network sync lives in notion.ts.
 */

/** The fields we sync — kept to what an applications board actually needs. */
export interface NotionApplication {
  company: string;
  title: string;
  url?: string | null;
  status?: string | null;
  appliedAt?: Date | string | null;
}

function isoDate(d?: Date | string | null): string | undefined {
  if (!d) return undefined;
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10); // Notion date property wants YYYY-MM-DD
}

/**
 * Build the `properties` payload for a Notion page from an application. Assumes
 * a database with: Name (title), Company (rich_text), Status (select), URL
 * (url), Applied (date). Pure + deterministic.
 */
export function buildNotionProperties(app: NotionApplication): Record<string, unknown> {
  const props: Record<string, unknown> = {
    Name: { title: [{ text: { content: app.title || "Untitled role" } }] },
    Company: { rich_text: [{ text: { content: app.company || "" } }] },
  };
  if (app.status) props.Status = { select: { name: app.status } };
  if (app.url) props.URL = { url: app.url };
  const applied = isoDate(app.appliedAt);
  if (applied) props.Applied = { date: { start: applied } };
  return props;
}
