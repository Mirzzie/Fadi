import { createHash } from "node:crypto";

/**
 * PORTFOLIO VISITOR ANALYTICS — first-party, anonymous, and useful to Fadi.
 *
 * WHY NOT GOOGLE ANALYTICS. Two reasons, neither of them ideological:
 *   1. GA4 needs consent before it sets cookies in the EU, which means a consent
 *      banner in front of a recruiter who is two seconds into looking at your work.
 *   2. GA data lives in Google. Fadi cannot read it, so it can never become a
 *      signal — and "someone opened your case study three days after you applied
 *      there" is the only kind of number that changes what you do next.
 *
 * THE PRIVACY MODEL, stated plainly because it is the whole design:
 *   - No cookies. Nothing is written to the visitor's browser.
 *   - No IP address or user-agent is ever stored. They are used once, in memory,
 *     to derive a salted daily hash, and then discarded.
 *   - The hash is deliberately unstable across days: the same person visiting
 *     tomorrow is a different `visitor` value. That is enough to stop counting one
 *     reader as five, and not enough to follow anyone over time.
 *   - No third party receives anything.
 *
 * CAREER-AGNOSTIC. The vocabulary here is about *reading a page* — viewed, opened,
 * downloaded, contacted — not about any industry. The only content-specific values
 * (which focus a visitor picked, which piece of work they opened) come from the
 * owner's own words, so a midwife's portfolio reports midwifery and a joiner's
 * reports joinery without this file knowing either exists.
 */

/** What a visitor can do on a public portfolio. Closed set: the API rejects the rest. */
export const PORTFOLIO_EVENTS = [
  "view",
  "item_opened",
  "persona_declared",
  "resume_downloaded",
  "contact_clicked",
] as const;

export type PortfolioEventType = (typeof PORTFOLIO_EVENTS)[number];

export function isPortfolioEvent(value: unknown): value is PortfolioEventType {
  return typeof value === "string" && (PORTFOLIO_EVENTS as readonly string[]).includes(value);
}

/** Stored under this prefix in product_events.event_type. */
export const EVENT_PREFIX = "portfolio.";
export const ENTITY_TYPE = "portfolio_site";

/**
 * Obvious automated traffic. Not a security control — a bot that wants to look
 * human will — just enough that "12 views" doesn't mean "12 crawlers". Recorded
 * as a flag rather than dropped, so the owner can see the difference.
 */
const BOT_UA =
  /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|preview|monitor|curl|wget|python-requests|headless|lighthouse|pingdom|uptime/i;

export function looksAutomated(userAgent: string | null | undefined): boolean {
  return BOT_UA.test(userAgent ?? "");
}

/**
 * A per-day, per-site pseudonym for one reader.
 *
 * Salted with a server secret so the hash cannot be reversed by anyone who obtains
 * the database, and with the date so it expires on its own. `siteId` is mixed in
 * so the same reader visiting two different portfolios is not linkable across them.
 */
export function visitorHash(input: {
  ip?: string | null;
  userAgent?: string | null;
  siteId: string;
  secret: string;
  now?: Date;
}): string {
  const day = (input.now ?? new Date()).toISOString().slice(0, 10);
  return createHash("sha256")
    .update(`${input.secret}|${day}|${input.siteId}|${input.ip ?? ""}|${input.userAgent ?? ""}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * The client's address, as far as it can be trusted behind a proxy. Used only to
 * derive the hash above — never stored, never logged.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return headers.get("x-real-ip");
}

export type RecordEventInput = {
  ownerUserId: string;
  siteId: string;
  type: PortfolioEventType;
  headers: Headers;
  /** Content-specific extras: the item opened, the focus declared. Owner's vocabulary. */
  detail?: Record<string, string | undefined>;
  /**
   * The owner looking at their own site.
   *
   * This matters more here than in ordinary analytics. These numbers are meant to
   * become a SIGNAL ("someone came for your safeguarding work the week you applied"),
   * and the owner previewing their own page all afternoon would manufacture that
   * interest out of nothing — evidence of an audience that does not exist. Fadi's
   * whole doctrine is never to invent, so a self-visit must never read as a visitor.
   *
   * Recorded and flagged rather than dropped: dropping it silently makes a working
   * page look broken ("I opened it five times and it says zero"), and the owner is
   * entitled to see that the counter is alive.
   */
  self?: boolean;
};

/**
 * Write one visitor event. Never throws: analytics must not be able to break the
 * page a recruiter is reading. A failure here is logged and swallowed.
 */
export async function recordPortfolioEvent(input: RecordEventInput): Promise<void> {
  try {
    const [{ createProductEventsRepository }, { getDatabase }, { logger }] = await Promise.all([
      import("@careeros/database"),
      import("@/lib/database/client"),
      import("@/lib/observability/logger"),
    ]);

    const userAgent = input.headers.get("user-agent");
    const secret = process.env.BETTER_AUTH_SECRET || process.env.ANALYTICS_SALT || "fadi-local";
    const visitor = visitorHash({
      ip: clientIp(input.headers),
      userAgent,
      siteId: input.siteId,
      secret,
    });

    const detail: Record<string, string> = {};
    for (const [k, v] of Object.entries(input.detail ?? {})) {
      if (typeof v === "string" && v.trim()) detail[k] = v.trim().slice(0, 200);
    }

    try {
      await createProductEventsRepository(getDatabase()).record({
        userId: input.ownerUserId,
        eventType: `${EVENT_PREFIX}${input.type}`,
        entityType: ENTITY_TYPE,
        entityId: input.siteId,
        payload: {
          visitor,
          automated: looksAutomated(userAgent),
          ...(input.self ? { self: true } : {}),
          ...detail,
        },
      });
    } catch (error) {
      logger.warn("portfolio.analytics_write_failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  } catch {
    // Even the dynamic imports failing must not surface to the visitor.
  }
}

export type PortfolioStats = {
  since: string;
  views: number;
  visitors: number;
  itemsOpened: number;
  resumeDownloads: number;
  contactClicks: number;
  /** Which focus visitors declared — the answer the welcome gate was throwing away. */
  focuses: { value: string; total: number }[];
  /** Which work got opened, by title. */
  items: { value: string; total: number }[];
  /** Who they said they were (recruiter / client / peer / just looking). */
  roles: { value: string; total: number }[];
  /** Your own visits, counted separately and excluded from everything above. */
  selfVisits: number;
  /** Crawlers and scripted requests, excluded from every number above. */
  botVisits: number;
};

/** Read the owner's own numbers for one site. */
export async function portfolioStats(
  ownerUserId: string,
  siteId: string,
  days = 30
): Promise<PortfolioStats> {
  const [{ createProductEventsRepository }, { getDatabase }] = await Promise.all([
    import("@careeros/database"),
    import("@/lib/database/client"),
  ]);
  const repo = createProductEventsRepository(getDatabase());
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [counts, focuses, items, roles, selfVisits, botVisits] = await Promise.all([
    repo.countsByType(ownerUserId, siteId, since),
    repo.topPayloadValues(ownerUserId, siteId, `${EVENT_PREFIX}persona_declared`, "interest", since),
    repo.topPayloadValues(ownerUserId, siteId, `${EVENT_PREFIX}item_opened`, "title", since),
    repo.topPayloadValues(ownerUserId, siteId, `${EVENT_PREFIX}persona_declared`, "role", since),
    repo.countSelf(ownerUserId, siteId, since),
    repo.countAutomated(ownerUserId, siteId, since),
  ]);

  const of = (type: PortfolioEventType) =>
    counts.find((c) => c.eventType === `${EVENT_PREFIX}${type}`);

  return {
    since: since.toISOString().slice(0, 10),
    views: of("view")?.total ?? 0,
    visitors: of("view")?.visitors ?? 0,
    itemsOpened: of("item_opened")?.total ?? 0,
    resumeDownloads: of("resume_downloaded")?.total ?? 0,
    contactClicks: of("contact_clicked")?.total ?? 0,
    focuses,
    items,
    roles,
    selfVisits,
    botVisits,
  };
}

export type TimelineEntry = {
  id: string;
  /** "view" | "item_opened" | … — the prefix stripped. */
  type: string;
  at: string;
  /** Why this row is or isn't counted. The reader decides, not the query. */
  counted: boolean;
  reason: "you" | "automated" | null;
  title?: string;
  role?: string;
  interest?: string;
  kind?: string;
  ref?: string;
  where?: string;
  org?: string;
  device?: string;
};

/**
 * THE HISTORY, flags and all.
 *
 * The counters deliberately hide the owner's own visits and automated hits. That is
 * right for a number and wrong for a log: "is that 31 real?" can only be answered by
 * looking. So every row is returned, each labelled with whether it counted and why —
 * which also means the owner can test their own site, see exactly what their testing
 * produced, and clear it.
 */
export async function portfolioTimeline(
  ownerUserId: string,
  siteId: string,
  days = 30,
  limit = 100
): Promise<TimelineEntry[]> {
  const [{ createProductEventsRepository }, { getDatabase }] = await Promise.all([
    import("@careeros/database"),
    import("@/lib/database/client"),
  ]);
  const repo = createProductEventsRepository(getDatabase());
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await repo.recentEvents(ownerUserId, siteId, since, limit);

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

  return rows.map((r) => {
    const p = r.payload ?? {};
    const self = p.self === true || p.self === "true";
    const bot = p.automated === true || p.automated === "true";
    return {
      id: r.id,
      type: r.eventType.replace(EVENT_PREFIX, ""),
      at: new Date(r.createdAt).toISOString(),
      counted: !self && !bot,
      reason: self ? "you" : bot ? "automated" : null,
      title: str(p.title),
      role: str(p.role),
      interest: str(p.interest),
      kind: str(p.kind),
      ref: str(p.ref),
      where: [str(p.city), str(p.country)].filter(Boolean).join(", ") || undefined,
      org: str(p.org),
      device: str(p.device),
    };
  });
}

export type FeedbackNote = {
  kind: string;
  message: string;
  from: string;
  contact: string;
  at: string;
};

/**
 * What visitors wrote, newest first. Deliberately NOT part of `portfolioStats`:
 * feedback is read, not counted, and it must never be filtered by the self-visit
 * or bot rules that (correctly) shape the numbers.
 */
export async function portfolioFeedback(
  ownerUserId: string,
  siteId: string,
  limit = 50
): Promise<FeedbackNote[]> {
  const [{ createProductEventsRepository }, { getDatabase }] = await Promise.all([
    import("@careeros/database"),
    import("@/lib/database/client"),
  ]);
  const rows = await createProductEventsRepository(getDatabase()).listForEntity(
    ownerUserId,
    siteId,
    { limit: 500 }
  );
  return rows
    .filter((r) => r.eventType === `${EVENT_PREFIX}feedback`)
    .slice(0, limit)
    .map((r) => {
      const p = r.payload as Record<string, unknown>;
      return {
        kind: typeof p.kind === "string" ? p.kind : "other",
        message: typeof p.message === "string" ? p.message : "",
        from: typeof p.from === "string" ? p.from : "",
        contact: typeof p.contact === "string" ? p.contact : "",
        at: r.createdAt.toISOString().slice(0, 10),
      };
    })
    .filter((f) => f.message);
}
