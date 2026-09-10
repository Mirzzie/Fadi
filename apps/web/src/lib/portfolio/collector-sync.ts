import { z } from "zod";

import { ENTITY_TYPE, EVENT_PREFIX, isPortfolioEvent } from "./analytics";

/**
 * PULL VISITOR EVENTS FROM THE PUBLIC COLLECTOR.
 *
 * Fadi runs locally, so it cannot be the thing a stranger's browser reports to. The
 * collector (infrastructure/portfolio-collector) is a tiny always-on Worker that
 * receives events instead; this drains it into `product_events`, after which every
 * existing stat, the self-visit exclusion and the "Who's looking" panel work exactly
 * as they do for the Fadi-served route.
 *
 * PULL, NOT PUSH, on purpose:
 *   - your machine is often off, and a push would simply lose those events;
 *   - the collector needs no credential for your database — it can only be read;
 *   - if the Worker disappears you stop gathering NEW events and lose no history.
 *
 * Resumable and idempotent: each imported row carries the collector's own row id
 * (`cid`), and the next pull starts after the highest one already stored. Re-running
 * it imports nothing twice.
 */

/** Edge context arrives as a JSON string; never let a bad blob fail an import. */
function parseContext(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 120);
    }
    return out;
  } catch {
    return {};
  }
}

const CollectorEvent = z.object({
  id: z.number(),
  handle: z.string(),
  type: z.string(),
  visitor: z.string(),
  automated: z.union([z.number(), z.boolean()]).optional(),
  self: z.union([z.number(), z.boolean()]).optional(),
  item_id: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  interest: z.string().nullable().optional(),
  created_at: z.string(),
  /** JSON blob of edge context. Optional: an older Worker sends nothing here. */
  context: z.string().nullable().optional(),
});

// `scanned` is the highest id the collector holds, so the caller can advance past
// rows it filtered out. Optional: an older Worker won't send it.
const CollectorResponse = z.object({
  events: z.array(CollectorEvent),
  scanned: z.number().optional(),
});

export type SyncResult =
  | { ok: true; imported: number; skipped: number; lastId: number }
  | { ok: false; message: string };

const truthy = (v: unknown) => v === true || v === 1;

export async function syncCollectorEvents(input: {
  userId: string;
  siteId: string;
  handle: string;
}): Promise<SyncResult> {
  const base = process.env.PORTFOLIO_COLLECTOR_URL?.trim();
  const token = process.env.PORTFOLIO_COLLECTOR_TOKEN?.trim();
  if (!base || !token) {
    return {
      ok: false,
      message:
        "No collector configured. Set PORTFOLIO_COLLECTOR_URL and PORTFOLIO_COLLECTOR_TOKEN — see infrastructure/portfolio-collector/README.md.",
    };
  }

  const [{ createProductEventsRepository }, { getDatabase }] = await Promise.all([
    import("@careeros/database"),
    import("@/lib/database/client"),
  ]);
  const repo = createProductEventsRepository(getDatabase());

  // DURABLE SCAN CURSOR, separate from "highest imported".
  //
  // Deriving the cursor from imported rows alone is a starvation bug: a page full of
  // another portfolio's events imports nothing, leaves the cursor at 0, and every
  // later sync re-requests the same window forever. The cursor now records what has
  // been SCANNED; `maxCollectorId` remains the floor so an existing install resumes
  // correctly on first run.
  const scanCursor = await readCursor(input.userId, input.siteId, "collectorCursor");
  const importedMax = await repo.maxCollectorId(input.userId, input.siteId);
  const lastId = Math.max(scanCursor, importedMax);

  let payload: unknown;
  try {
    const res = await fetch(
      `${base.replace(/\/$/, "")}/export?after=${lastId}&limit=1000&handle=${encodeURIComponent(input.handle)}`,
      {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );
    if (!res.ok) {
      return {
        ok: false,
        message:
          res.status === 401
            ? "The collector rejected the token — check PORTFOLIO_COLLECTOR_TOKEN matches the EXPORT_TOKEN you set on the Worker."
            : `The collector answered ${res.status}.`,
      };
    }
    payload = await res.json();
  } catch {
    return { ok: false, message: "Couldn't reach the collector. Is the URL right and deployed?" };
  }

  const parsed = CollectorResponse.safeParse(payload);
  if (!parsed.success) return { ok: false, message: "The collector returned an unexpected shape." };

  let imported = 0;
  let skipped = 0;
  let highest = lastId;

  for (const e of parsed.data.events) {
    highest = Math.max(highest, e.id);

    // Only this site's traffic, and only event names this Fadi understands. A
    // collector may legitimately serve several portfolios.
    if (e.handle.toLowerCase() !== input.handle.toLowerCase() || !isPortfolioEvent(e.type)) {
      skipped += 1;
      continue;
    }

    const detail: Record<string, string> = {};
    if (e.item_id) detail.itemId = e.item_id;
    if (e.title) detail.title = e.title;
    if (e.role) detail.role = e.role;
    if (e.interest) detail.interest = e.interest;

    await repo.record({
      userId: input.userId,
      eventType: `${EVENT_PREFIX}${e.type}`,
      entityType: ENTITY_TYPE,
      entityId: input.siteId,
      // The collector's timestamp is kept, not the import time — otherwise a month of
      // traffic would collapse into the moment you happened to press Sync.
      createdAt: new Date(e.created_at),
      payload: {
        visitor: e.visitor,
        automated: truthy(e.automated),
        ...(truthy(e.self) ? { self: true } : {}),
        // The resume cursor. Also marks the row's origin.
        cid: e.id,
        src: "collector",
        // Country, city, network, device, referring host, contact kind. Parsed here
        // rather than stored as a string so the timeline can read it like any other
        // payload field; a malformed blob is simply dropped.
        ...parseContext(e.context),
        ...detail,
      },
    });
    imported += 1;
  }

  // Advance past everything scanned, not just what was imported.
  highest = Math.max(highest, parsed.data.scanned ?? 0);
  await writeCursor(input.userId, input.siteId, "collectorCursor", highest);

  highest = Math.max(highest, parsed.data.scanned ?? 0);
  await writeCursor(input.userId, input.siteId, "feedbackCursor", highest);

  return { ok: true, imported, skipped, lastId: highest };
}

/**
 * The sync cursors live in `portfolio_sites.theme` — an existing jsonb column, so
 * tracking progress needs no migration.
 */
async function readCursor(userId: string, siteId: string, key: string): Promise<number> {
  const [{ createPortfolioRepository }, { getDatabase }] = await Promise.all([
    import("@careeros/database"),
    import("@/lib/database/client"),
  ]);
  const site = await createPortfolioRepository(getDatabase()).getSiteForUser(userId, siteId);
  const raw = (site?.theme as Record<string, unknown> | undefined)?.[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

async function writeCursor(userId: string, siteId: string, key: string, value: number) {
  const [{ createPortfolioRepository }, { getDatabase }] = await Promise.all([
    import("@careeros/database"),
    import("@/lib/database/client"),
  ]);
  const repo = createPortfolioRepository(getDatabase());
  const site = await repo.getSiteForUser(userId, siteId);
  if (!site) return;
  const theme = (site.theme ?? {}) as Record<string, unknown>;
  if (theme[key] === value) return;
  await repo.updateSite(userId, siteId, { theme: { ...theme, [key]: value } });
}

const FeedbackRow = z.object({
  id: z.number(),
  handle: z.string(),
  kind: z.string(),
  message: z.string(),
  from_name: z.string().nullable().optional(),
  contact: z.string().nullable().optional(),
  created_at: z.string(),
});

export type PortfolioFeedback = {
  id: number;
  kind: string;
  message: string;
  from: string | null;
  contact: string | null;
  at: string;
};

/**
 * Pull what visitors WROTE, as opposed to what they did.
 *
 * Kept separate from the event sync because feedback is read, not counted: it is
 * free text a person took the trouble to write, and collapsing it into a statistic
 * would throw away the only part that matters. Same resume-cursor trick as events
 * (`fbcid`), so re-running imports nothing twice.
 */
export async function syncCollectorFeedback(input: {
  userId: string;
  siteId: string;
  handle: string;
}): Promise<SyncResult> {
  const base = process.env.PORTFOLIO_COLLECTOR_URL?.trim();
  const token = process.env.PORTFOLIO_COLLECTOR_TOKEN?.trim();
  if (!base || !token) return { ok: false, message: "No collector configured." };

  const [{ createProductEventsRepository }, { getDatabase }] = await Promise.all([
    import("@careeros/database"),
    import("@/lib/database/client"),
  ]);
  const repo = createProductEventsRepository(getDatabase());
  const scanCursor = await readCursor(input.userId, input.siteId, "feedbackCursor");
  const lastId = Math.max(
    scanCursor,
    await repo.maxPayloadNumber(input.userId, input.siteId, "fbcid"),
  );

  let payload: unknown;
  try {
    const res = await fetch(
      `${base.replace(/\/$/, "")}/export-feedback?after=${lastId}&handle=${encodeURIComponent(input.handle)}`,
      {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );
    if (!res.ok) return { ok: false, message: `The collector answered ${res.status}.` };
    payload = await res.json();
  } catch {
    return { ok: false, message: "Couldn't reach the collector." };
  }

  const parsed = z
    .object({ feedback: z.array(FeedbackRow), scanned: z.number().optional() })
    .safeParse(payload);
  if (!parsed.success) return { ok: false, message: "Unexpected shape from the collector." };

  let imported = 0;
  let skipped = 0;
  let highest = lastId;

  for (const f of parsed.data.feedback) {
    highest = Math.max(highest, f.id);
    if (f.handle.toLowerCase() !== input.handle.toLowerCase()) {
      skipped += 1;
      continue;
    }
    await repo.record({
      userId: input.userId,
      eventType: `${EVENT_PREFIX}feedback`,
      entityType: ENTITY_TYPE,
      entityId: input.siteId,
      createdAt: new Date(f.created_at),
      payload: {
        // `self` is never set here: a message someone wrote is never "your own visit",
        // and it must never be filtered out of the owner's inbox by the analytics rules.
        fbcid: f.id,
        src: "collector",
        kind: f.kind,
        message: f.message,
        from: f.from_name ?? "",
        contact: f.contact ?? "",
      },
    });
    imported += 1;
  }

  highest = Math.max(highest, parsed.data.scanned ?? 0);
  await writeCursor(input.userId, input.siteId, "feedbackCursor", highest);

  return { ok: true, imported, skipped, lastId: highest };
}
