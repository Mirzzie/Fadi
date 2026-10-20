"use server";

import {
  createEvidenceArtifactsRepository,
  createEvidenceRepository,
  createPortfolioRepository,
} from "@careeros/database";
import { revalidatePath } from "next/cache";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getUserDocGenerate } from "@/lib/ai/user-generate";
import { getDatabase } from "@/lib/database/client";
import { portfolioFreshness } from "@/lib/portfolio/freshness";
import { checkPortfolioIntegrityAI, type IntegrityAiResult } from "@/lib/portfolio/integrity";
import type { EvidenceKind } from "@/lib/evidence/pool";
import type { FeedbackNote, PortfolioStats, TimelineEntry } from "@/lib/portfolio/analytics";
import { publish } from "@/lib/events/bus";
import {
  fromExportItem,
  isSameEntry,
  seedItemsFromEvidence,
  toExportItem,
  toItemView,
  toSiteView,
  type PortfolioExport,
  type PortfolioItemView,
  type PortfolioSiteView,
} from "@careeros/portfolio";

const PATH = "/dashboard/portfolio";

/** Portfolio sections → evidence kinds, so one decision engine serves both. */
const SECTION_KIND: Record<string, EvidenceKind> = {
  project: "project",
  achievement: "achievement",
  experience: "experience",
  education: "education",
  // A credential is a credential. Mapping it to "achievement" merged two different things the
  // portfolio has always shown separately.
  certification: "certification",
  skill: "skill",
  custom: "skill",
};

const SECTIONS = [
  "project",
  "achievement",
  "experience",
  "education",
  "certification",
  "skill",
  "hobby",
  "custom",
] as const;

type Result<T> = ({ ok: true } & T) | { ok: false; message: string };

export type EvidenceProjectOption = {
  id: string;
  factId: string;
  kind: "project" | "achievement";
  title: string;
  organization: string | null;
  period: string | null;
  detail: string;
  hasProof: boolean;
  isDismissed: boolean;
  proofUrl: string | null;
  proofCover: string | null;
  proofGallery: string[];
  linkedItemId: string | null;
};

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "portfolio"
  );
}

/** Ensure the signed-in user has a portfolio site, creating a default one once. */
async function ensureSite(userId: string, email?: string) {
  const repo = createPortfolioRepository(getDatabase());
  const sites = await repo.listSitesForUser(userId);
  if (sites[0]) return sites[0];

  const base = slugify(email?.split("@")[0] ?? "portfolio");
  let handle = base;
  if (!(await repo.isHandleAvailable(handle))) {
    handle = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  // The portfolio is DELIBERATELY track-independent: one public, user-level site
  // that aggregates evidence from ALL of the user's career tracks. Switching the
  // active direction in Fadi must never change the CMS or the site. Visitors pick
  // their own lens on the public site (see WelcomeGate), not the owner's track.
  return repo.createSite(userId, {
    handle,
    title: "My portfolio",
    template: "noir-gold",
    theme: {},
    profile: {},
    resumeLinks: {},
    careerProfileId: null,
    isPublished: false,
  });
}

export async function loadPortfolio(): Promise<
  Result<{
    site: PortfolioSiteView;
    handle: string;
    isPublished: boolean;
    items: PortfolioItemView[];
    /** Accepted Evidence records not yet represented on the portfolio. */
    pendingItems: number;
    /** Project records and any optional media already attached to them. */
    evidenceProjects: EvidenceProjectOption[];
    /** The other direction: live items the record has moved PAST — see lib/portfolio/freshness.ts. */
    drift: {
      withdrawn: { id: string; title: string }[];
      reworded: { id: string; title: string }[];
    };
  }>
> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const repo = createPortfolioRepository(getDatabase());
  const site = await ensureSite(user.id, user.email);
  const items = await repo.listItemsForUser(user.id, site.id);

  // Same match logic as syncFromEvidence, but count-only (no writes) — including the
  // dismissal memory, or the CMS would keep offering to re-add work the user removed.
  const have = new Set(items.map((i) => i.evidenceItemId).filter(Boolean) as string[]);
  const evidence = await createEvidenceRepository(getDatabase()).listForUser(user.id);
  const artifacts = await createEvidenceArtifactsRepository(getDatabase()).listForUser(user.id);
  const factsWithProof = new Set(artifacts.map((a) => a.factId));
  const dismissed = new Set(
    ((site.theme as { dismissedFacts?: unknown })?.dismissedFacts as string[] | undefined) ?? []
  );
  const factOfEvidence = new Map(evidence.map((e) => [e.id, e.factId ?? e.id]));
  // Count through the same planner Sync uses. A count-only reimplementation had already drifted
  // once and offered work the write path would only link.
  const { planEvidenceSync } = await import("@/lib/portfolio/sync-plan");
  const pendingPlan = planEvidenceSync(
    seedItemsFromEvidence(evidence),
    items.map((item) => ({
      id: item.id,
      evidenceItemId: item.evidenceItemId,
      section: item.section,
      title: item.title,
      subtitle: item.subtitle,
      dateRange: item.dateRange,
      description: item.description,
      bullets: item.bullets,
    })),
    {
      have,
      dismissed,
      factOf: (id) => factOfEvidence.get(id) ?? id,
      sameEntry: (candidate, entry) => isSameEntry(candidate, entry),
    }
  );
  const pendingItems = pendingPlan.create.length;

  const linkedItemByEvidence = new Map(
    items
      .filter((item) => item.evidenceItemId)
      .map((item) => [item.evidenceItemId as string, item.id])
  );
  const evidenceProjects = evidence
    .filter((e) => e.kind === "project" || e.kind === "achievement")
    .map((e) => {
      const factId = e.factId ?? e.id;
      const proof = artifacts.filter((artifact) => artifact.factId === factId);
      const visual = proof.filter(
        (artifact) => artifact.kind === "image" || artifact.kind === "video"
      );
      return {
        id: e.id,
        factId,
        kind: e.kind as "project" | "achievement",
        title: e.title,
        organization: e.organization,
        period: e.period,
        detail: e.detail,
        hasProof: factsWithProof.has(factId),
        isDismissed: dismissed.has(factId),
        proofUrl:
          proof.find((artifact) => artifact.kind !== "image" && artifact.kind !== "video")?.url ??
          null,
        proofCover: visual[0]?.url ?? null,
        proofGallery: visual.slice(1).map((artifact) => artifact.url),
        linkedItemId: linkedItemByEvidence.get(e.id) ?? null,
      };
    });

  // What is LIVE but no longer matches the record. Read-only: a public page is the owner's, and
  // a projection that has drifted is a decision to put to them, never a silent unpublish.
  const drift = portfolioFreshness(
    items.map((i) => ({
      id: i.id,
      title: i.title,
      evidenceItemId: i.evidenceItemId,
      isPublished: i.isPublished,
      updatedAt: i.updatedAt,
      unbackedSince: i.unbackedSince,
    })),
    evidence.map((e) => ({ id: e.id, title: e.title, updatedAt: e.updatedAt }))
  );

  return {
    ok: true,
    site: toSiteView(site),
    handle: site.handle,
    isPublished: site.isPublished,
    items: items.map(toItemView),
    pendingItems,
    evidenceProjects,
    drift,
  };
}

// One template. Historic ids are still accepted so an existing site keeps loading;
// they all render the same thing now.
const TEMPLATES = ["work", "noir-gold", "aurora", "minimal", "blog", "blog-plain"];

export async function updateSiteSettings(input: {
  handle: string;
  title: string;
  headline?: string;
  /** Owner overrides for the public page's headings. Blank = fall back to default. */
  labels?: Record<string, string>;
  template?: string;
  resumeLinks?: Record<string, string>;
  profile?: Record<string, unknown>;
}): Promise<Result<{ site: PortfolioSiteView }>> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const repo = createPortfolioRepository(getDatabase());
  const site = await ensureSite(user.id, user.email);

  const handle = slugify(input.handle);
  if (!(await repo.isHandleAvailable(handle, site.id))) {
    return { ok: false, message: `The handle "${handle}" is taken. Try another.` };
  }

  const updated = await repo.updateSite(user.id, site.id, {
    handle,
    title: input.title.trim() || "My portfolio",
    headline: input.headline?.trim() || null,
    // Stored in the existing `theme` jsonb, so editable copy needs no migration.
    // Blank values are dropped rather than saved, so a cleared field returns to the
    // default instead of rendering an empty heading.
    // Only touched when the caller actually sent labels — otherwise saving any other
    // setting would silently wipe the owner's wording.
    theme: input.labels
      ? {
          ...(site.theme ?? {}),
          labels: Object.fromEntries(
            Object.entries(input.labels).filter(([, v]) => typeof v === "string" && v.trim())
          ),
        }
      : site.theme,
    template: input.template && TEMPLATES.includes(input.template) ? input.template : site.template,
    resumeLinks: input.resumeLinks ?? site.resumeLinks,
    profile: input.profile ?? site.profile,
  });
  if (!updated) return { ok: false, message: "Could not update the site." };
  revalidatePath(PATH);
  return { ok: true, site: toSiteView(updated) };
}

export async function reorderItems(input: { ids: string[] }): Promise<{ ok: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };
  await createPortfolioRepository(getDatabase()).reorderItems(user.id, input.ids);
  revalidatePath(PATH);
  return { ok: true };
}

export async function setSitePublished(input: {
  published: boolean;
}): Promise<Result<{ isPublished: boolean }>> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const repo = createPortfolioRepository(getDatabase());
  const site = await ensureSite(user.id, user.email);
  const updated = await repo.updateSite(user.id, site.id, { isPublished: input.published });
  if (!updated) return { ok: false, message: "Could not update the site." };
  await publish("portfolio.published", {
    userId: user.id,
    siteId: updated.id,
    handle: updated.handle,
    published: updated.isPublished,
  });
  revalidatePath(PATH);
  return { ok: true, isPublished: updated.isPublished };
}

/** Seed portfolio items from the evidence pool (single-source-of-truth projection). */
export async function seedFromEvidence(): Promise<Result<{ added: number }>> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const repo = createPortfolioRepository(getDatabase());
  const site = await ensureSite(user.id, user.email);
  const existing = await repo.listItemsForUser(user.id, site.id);
  if (existing.length > 0) {
    return { ok: false, message: "This site already has items — seed only runs when empty." };
  }

  const evidenceRepo = createEvidenceRepository(getDatabase());
  let evidence = await evidenceRepo.listForUser(user.id);

  // Chain the step instead of bouncing the user. This used to return "No evidence yet
  // — add it in Evidence first", which turned building a portfolio into a scavenger
  // hunt: Portfolio → Evidence → build → back to Portfolio → seed. The pool is derived
  // from the user's OWN résumé/LinkedIn, so there is nothing to ask permission for —
  // build it here and continue. Falls back to the honest message only if it genuinely
  // can't (no career history on file, or no AI provider configured).
  if (evidence.length === 0) {
    const { extractEvidencePool } = await import("@/lib/evidence/pool");
    const built = await extractEvidencePool(user.id);
    if (!built.ok) return { ok: false, message: built.message };
    evidence = await evidenceRepo.listForUser(user.id);
    if (evidence.length === 0) {
      return {
        ok: false,
        message: "I couldn't find enough in your history to build a portfolio yet.",
      };
    }
  }

  // Same gate as the sync. The seed runs against a portfolio that may already have
  // hand-written items, so "it's the first build" is not a reason to skip the check.
  const { admitPortfolioItems } = await import("@/lib/portfolio/admit-items");
  const alreadyThere = await repo.listItemsForUser(user.id, site.id);
  const { keep } = admitPortfolioItems(seedItemsFromEvidence(evidence), alreadyThere);

  const rows = keep.map((r) => ({
    ...r,
    siteId: site.id,
    roles: [] as string[],
    url: null,
    imageUrl: null,
    gallery: [] as string[],
    isPublished: true,
    // Arrived automatically, so it is not on the public site until a person looks at
    // it. The site the owner actually relies on does not inherit whatever the rest of
    // the platform happens to write.
    confirmedAt: null,
  }));
  const created = await repo.createItems(user.id, rows);
  revalidatePath(PATH);
  return { ok: true, added: created.length };
}

/**
 * AIO sync: pull evidence items that aren't in the portfolio yet (matched by
 * evidence_item_id) WITHOUT touching existing items — so the user's portfolio-only
 * edits (images, blurbs, order, publish state) are preserved. Evidence is the
 * source of truth; this keeps the projection current as career data grows.
 */
/**
 * @param input.evidenceItemId sync only this record — how a finished project offers itself to
 *   the portfolio without sweeping in everything else waiting there. Same dedupe, same
 *   dismissals.
 */
export async function syncFromEvidence(
  input: { evidenceItemId?: string } = {}
): Promise<Result<{ added: number; nearMatches: number }>> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const repo = createPortfolioRepository(getDatabase());
  const site = await ensureSite(user.id, user.email);
  const existing = await repo.listItemsForUser(user.id, site.id);
  const have = new Set(existing.map((i) => i.evidenceItemId).filter(Boolean) as string[]);

  const evidence = await createEvidenceRepository(getDatabase()).listForUser(user.id);
  // Seed every evidence item into a row, then keep only the ones we don't already have.
  // Items from Import / the original migration carry NO evidence_item_id, so we also match
  // on the CONTENT (section + org + years + title) — the same credential worded differently
  // ("MSc" vs "M.Sc.", "BCA, Computer Science" vs "Bachelor of Computer Application (BCA)")
  // no longer sneaks back in as a duplicate.
  const artifactRows = await createEvidenceArtifactsRepository(getDatabase()).listForUser(user.id);
  const artifactsByFact = new Map<string, typeof artifactRows>();
  for (const artifact of artifactRows) {
    const rows = artifactsByFact.get(artifact.factId) ?? [];
    rows.push(artifact);
    artifactsByFact.set(artifact.factId, rows);
  }
  const seeded = seedItemsFromEvidence(
    input.evidenceItemId ? evidence.filter((item) => item.id === input.evidenceItemId) : evidence
  ).map((record) => {
    const factId = evidence.find((item) => item.id === record.evidenceItemId)?.factId;
    const media = artifactsByFact.get(factId ?? record.evidenceItemId) ?? [];
    const visual = media.filter((item) => item.kind === "image" || item.kind === "video");
    const source = media.find((item) => item.kind !== "image" && item.kind !== "video");
    return {
      ...record,
      url: source?.url ?? null,
      imageUrl: visual[0]?.url ?? null,
      gallery: visual.slice(1).map((item) => item.url),
    };
  });

  // WHAT THE USER ALREADY DECIDED AGAINST.
  //
  // Deleting a portfolio item used to be futile: the item's evidence id left `have`,
  // the lexical check could not recognise a re-worded record, and the next Sync
  // cheerfully re-created it — "Added 3 items from your evidence" on a pool the user
  // had just cleaned. A dismissal is a decision, so it is remembered. It is keyed on
  // the FACT, not the row, so the same reality re-worded stays dismissed too.
  const dismissed = new Set(
    ((site.theme as { dismissedFacts?: unknown })?.dismissedFacts as string[] | undefined) ?? []
  );
  const factOfEvidence = new Map(evidence.map((e) => [e.id, e.factId ?? e.id]));

  // Work already on the site is linked to its record. Work that is genuinely new is created
  // whether or not it has media; screenshots and links are optional fields on that projection.
  const { planEvidenceSync } = await import("@/lib/portfolio/sync-plan");

  const plan = planEvidenceSync(
    seeded,
    existing.map((x) => ({
      id: x.id,
      evidenceItemId: x.evidenceItemId,
      section: x.section,
      title: x.title,
      subtitle: x.subtitle,
      dateRange: x.dateRange,
      description: x.description,
      bullets: x.bullets,
    })),
    {
      have,
      dismissed,
      factOf: (id) => factOfEvidence.get(id) ?? id,
      sameEntry: (candidate, entry) => isSameEntry(candidate, entry),
    }
  );

  // Repair the links first: an entry the person built keeps its images and wording and gains the
  // evidence id it lost, which is what stops every future sync proposing it again.
  for (const link of plan.link) {
    const linkedRow = await repo.linkToEvidence(user.id, link.itemId, link.evidenceItemId);
    if (linkedRow) {
      const record = evidence.find((e) => e.id === link.evidenceItemId);
      if (record) {
        await createEvidenceArtifactsRepository(getDatabase()).addForFact(
          user.id,
          record.factId ?? record.id,
          proofFromPortfolio(linkedRow)
        );
      }
    }
  }
  const kept = plan.create;
  const linked = plan.alreadyShown;

  if (kept.length === 0) {
    if (plan.link.length > 0) {
      await publish("portfolio.changed", { userId: user.id, siteId: site.id, reason: "synced" });
      revalidatePath(PATH);
    }
    return { ok: true, added: 0, nearMatches: linked };
  }

  const maxSort = existing.reduce((m, i) => Math.max(m, i.sortOrder), 0);
  const rows = kept.map((r, i) => {
    const media = r as typeof r & {
      url?: string | null;
      imageUrl?: string | null;
      gallery?: string[];
    };
    return {
      ...r,
      siteId: site.id,
      roles: [] as string[],
      url: media.url ?? null,
      imageUrl: media.imageUrl ?? null,
      gallery: media.gallery ?? [],
      isPublished: true,
      sortOrder: maxSort + (i + 1) * 10,
      confirmedAt: null, // automatic — waits for a look before it goes public
    };
  });
  const created = await repo.createItems(user.id, rows);
  await publish("portfolio.changed", { userId: user.id, siteId: site.id, reason: "synced" });
  revalidatePath(PATH);
  return { ok: true, added: created.length, nearMatches: linked };
}

/**
 * Fadi AI integrity pass: audits the whole portfolio for contradictions, timeline errors and
 * anomalies (deterministic duplicate detection runs client-side, for free, on every edit).
 * Detect & propose only — nothing is changed. Degrades gracefully when no AI key is set.
 */
export async function checkIntegrity(): Promise<Result<IntegrityAiResult>> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const repo = createPortfolioRepository(getDatabase());
  const site = await ensureSite(user.id, user.email);
  const items = (await repo.listItemsForUser(user.id, site.id)).map(toItemView);
  const res = await checkPortfolioIntegrityAI(user.id, items);
  return { ok: true, ...res };
}

/**
 * Allow only web/mailto (or relative) link URLs into portfolio items. Blocks `javascript:`,
 * `data:`, `vbscript:` and any other explicit scheme — these are published to a PUBLIC snapshot
 * and rendered into href/src, where a script-scheme link would execute under the Fadi origin.
 * The public SDK guards on render too (defense in depth); this stops it at the source.
 */
function safeLinkUrl(raw?: string | null): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (/^(https?:\/\/|mailto:)/i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null; // any other explicit scheme → reject
  return v; // scheme-less relative path
}

function proofKind(url: string): "image" | "video" | "link" {
  if (/(\.mp4|\.webm|\.mov)(\?|$)|\/video\/upload\//i.test(url)) return "video";
  if (/(\.png|\.jpe?g|\.gif|\.webp|\.svg)(\?|$)|\/image\/upload\//i.test(url)) return "image";
  return "link";
}

function proofFromPortfolio(item: {
  id: string;
  imageUrl: string | null;
  gallery: string[];
  url: string | null;
}) {
  const rows: Array<{
    kind: "image" | "video" | "link";
    url: string;
    label: string;
    sortOrder: number;
    sourcePortfolioItemId: string;
  }> = [];
  if (item.imageUrl) {
    rows.push({
      kind: proofKind(item.imageUrl),
      url: item.imageUrl,
      label: "Cover",
      sortOrder: 0,
      sourcePortfolioItemId: item.id,
    });
  }
  item.gallery.forEach((url, index) => {
    rows.push({
      kind: proofKind(url),
      url,
      label: "Gallery",
      sortOrder: index + 1,
      sourcePortfolioItemId: item.id,
    });
  });
  if (item.url) {
    rows.push({
      kind: "link",
      url: item.url,
      label: "Source",
      sortOrder: 1000,
      sourcePortfolioItemId: item.id,
    });
  }
  return rows;
}

export async function saveItem(input: {
  id?: string;
  evidenceItemId?: string;
  section: string;
  title: string;
  subtitle?: string;
  location?: string;
  dateRange?: string;
  description?: string;
  bullets: string[];
  roles: string[];
  tag?: string;
  url?: string;
  imageUrl?: string;
  gallery: string[];
}): Promise<Result<{ item: PortfolioItemView }>> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!input.title.trim()) return { ok: false, message: "Give it a title." };

  const db = getDatabase();
  const repo = createPortfolioRepository(db);
  const site = await ensureSite(user.id, user.email);
  const section = (SECTIONS as readonly string[]).includes(input.section)
    ? input.section
    : "custom";

  const fields = {
    section,
    title: input.title.trim(),
    subtitle: input.subtitle?.trim() || null,
    location: input.location?.trim() || null,
    dateRange: input.dateRange?.trim() || null,
    description: input.description?.trim() || null,
    bullets: input.bullets.map((b) => b.trim()).filter(Boolean),
    roles: input.roles.filter(Boolean),
    tag: input.tag?.trim() || null,
    url: safeLinkUrl(input.url),
    imageUrl: safeLinkUrl(input.imageUrl),
    gallery: input.gallery.map((g) => safeLinkUrl(g)).filter((g): g is string => Boolean(g)),
  };

  const before = input.id ? await repo.getItemForUser(user.id, input.id) : null;
  if (input.id && !before) return { ok: false, message: "I can't find that item." };
  if (
    before?.evidenceItemId &&
    input.evidenceItemId &&
    before.evidenceItemId !== input.evidenceItemId
  ) {
    return { ok: false, message: "Disconnect this project before choosing a different record." };
  }
  const evidenceItemId = input.evidenceItemId ?? before?.evidenceItemId ?? null;
  const evidence = evidenceItemId
    ? await createEvidenceRepository(db).getForUser(user.id, evidenceItemId)
    : null;
  const expectedSection = evidence?.kind === "achievement" ? "achievement" : "project";
  if (
    evidenceItemId &&
    (!evidence ||
      !evidence.isCanonical ||
      evidence.reviewStatus !== "accepted" ||
      !["project", "achievement"].includes(evidence.kind) ||
      section !== expectedSection)
  ) {
    return { ok: false, message: "Choose a matching accepted record from your Evidence." };
  }

  let row;
  try {
    row = await db.transaction(async (tx) => {
      const txRepo = createPortfolioRepository(tx);
      let saved;
      if (input.id) {
        saved = await txRepo.updateItem(user.id, input.id, fields);
        if (saved && evidenceItemId && !saved.evidenceItemId) {
          saved = await txRepo.linkToEvidence(user.id, saved.id, evidenceItemId);
        }
      } else {
        const siblings = await txRepo.listItemsForUser(user.id, site.id);
        const maxSort = siblings
          .filter((i) => i.section === section)
          .reduce((m, i) => Math.max(m, i.sortOrder), 0);
        saved = await txRepo.createItem(user.id, {
          ...fields,
          evidenceItemId,
          siteId: site.id,
          sortOrder: maxSort + 10,
          isPublished: true,
          confirmedAt: new Date(),
        });
      }
      if (!saved) return null;
      if (evidence) {
        await createEvidenceArtifactsRepository(tx).addForFact(
          user.id,
          evidence.factId ?? evidence.id,
          proofFromPortfolio(saved)
        );
      }
      return saved;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/portfolio_items_site_evidence_unique|duplicate key/i.test(message)) {
      return {
        ok: false,
        message: "That Evidence project is already connected to this portfolio.",
      };
    }
    return { ok: false, message: "Couldn't save that project. Your existing item is unchanged." };
  }
  if (!row) return { ok: false, message: "I can't find that item." };
  revalidatePath(PATH);
  return { ok: true, item: toItemView(row) };
}

/** Promote a real CMS-only project into Evidence, then connect its existing proof-bearing entry. */
export async function savePortfolioProjectToEvidence(input: {
  id: string;
}): Promise<Result<{ evidenceItemId: string }>> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const db = getDatabase();
  const item = await createPortfolioRepository(db).getItemForUser(user.id, input.id);
  if (!item || item.section !== "project") {
    return { ok: false, message: "That portfolio project is unavailable." };
  }
  if (item.evidenceItemId) return { ok: true, evidenceItemId: item.evidenceItemId };
  const { admitEvidence } = await import("@/lib/identity/admit");
  const admitted = await admitEvidence(user.id, {
    kind: "project",
    title: item.title,
    organization: item.subtitle,
    period: item.dateRange,
    detail: [item.description, ...item.bullets].filter(Boolean).join("\n"),
    metrics: null,
    tags: [item.tag, ...item.roles].filter((x): x is string => Boolean(x)),
    origin: "manual",
    attribution: "personal",
  });
  if (admitted.row.reviewStatus !== "accepted") {
    return {
      ok: false,
      message:
        "Fadi found a possible existing project. Resolve that one question in Evidence, then connect it here.",
    };
  }

  const linked = await db.transaction(async (tx) => {
    const row = await createPortfolioRepository(tx).linkToEvidence(
      user.id,
      item.id,
      admitted.row.id
    );
    if (!row) return null;
    await createEvidenceArtifactsRepository(tx).addForFact(
      user.id,
      admitted.row.factId ?? admitted.row.id,
      proofFromPortfolio(row)
    );
    return row;
  });
  if (!linked) {
    return {
      ok: false,
      message: "That project was connected in another tab. Refresh and check it.",
    };
  }
  await publish("evidence.changed", {
    userId: user.id,
    reason: "created",
    evidenceItemId: admitted.row.id,
  });
  revalidatePath(PATH);
  revalidatePath("/dashboard/evidence");
  return { ok: true, evidenceItemId: admitted.row.id };
}

/**
 * Fadi rewrites an item's description in a portfolio voice — grounded ONLY in the
 * item's real facts (title/org/tag/bullets), per the platform's authenticity rule
 * (docs/PLATFORM_IDEOLOGY.md §3): never invent metrics, tools, or outcomes, and
 * never sound generated. Uses the user's own connected AI provider.
 */
export async function enhanceDescription(input: {
  section: string;
  title: string;
  subtitle?: string;
  tag?: string;
  bullets: string[];
  description?: string;
}): Promise<Result<{ description: string }>> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!input.title.trim()) return { ok: false, message: "Add a title first." };

  const gen = await getUserDocGenerate(user.id);
  if (!gen) {
    return {
      ok: false,
      message: "Connect an AI provider in Settings → AI to use Fadi's writing.",
    };
  }

  const facts = [
    `Section: ${input.section}`,
    `Title: ${input.title}`,
    input.subtitle ? `Organization: ${input.subtitle}` : "",
    input.tag ? `Tag/category: ${input.tag}` : "",
    input.bullets.length ? `Key points:\n- ${input.bullets.join("\n- ")}` : "",
    input.description ? `Current draft: ${input.description}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const system =
    "You are Fadi, an honest career mentor writing ONE short portfolio blurb (1–3 sentences). " +
    "Ground every claim ONLY in the facts provided — never invent metrics, tools, employers, " +
    "dates, or outcomes. Write in a specific, confident, genuinely human voice that does NOT " +
    "sound AI-generated: concrete, plain, no clichés, no buzzword soup, no filler. " +
    "Output only the blurb text — no preamble, no quotes, no markdown.";
  const prompt = `Write a portfolio blurb for this item, using only these facts:\n\n${facts}`;

  try {
    const raw = (await gen.text(system, prompt)) as unknown;
    const text = String(raw ?? "")
      .trim()
      .replace(/^["']|["']$/g, "")
      .trim();
    if (!text) return { ok: false, message: "Fadi couldn't draft that — try again." };
    return { ok: true, description: text };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Enhancement failed." };
  }
}

export async function setItemPublished(input: {
  id: string;
  published: boolean;
}): Promise<{ ok: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };
  await createPortfolioRepository(getDatabase()).updateItem(user.id, input.id, {
    isPublished: input.published,
  });
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteItem(input: { id: string }): Promise<Result<{ removed: boolean }>> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const db = getDatabase();
  const repo = createPortfolioRepository(db);

  // Remember the decision BEFORE the row goes, or Sync will simply put it back.
  // Keyed on the fact, so the same reality re-worded stays dismissed as well.
  const item = await repo.getItemForUser(user.id, input.id);
  if (!item) return { ok: false, message: "That portfolio item is unavailable." };
  if (!item.evidenceItemId && (item.imageUrl || item.gallery.length > 0 || item.url)) {
    return {
      ok: false,
      message: "Save this proof-bearing project to Evidence before removing it.",
    };
  }
  if (item.evidenceItemId) {
    const site = await ensureSite(user.id, user.email);
    const evidence = await createEvidenceRepository(db).listAllForUser(user.id);
    const record = evidence.find((e) => e.id === item.evidenceItemId);
    const fact = record?.factId ?? item.evidenceItemId;
    const theme = (site.theme ?? {}) as Record<string, unknown>;
    const prev = Array.isArray(theme.dismissedFacts) ? (theme.dismissedFacts as string[]) : [];
    await db.transaction(async (tx) => {
      await createEvidenceArtifactsRepository(tx).addForFact(
        user.id,
        fact,
        proofFromPortfolio(item)
      );
      if (!prev.includes(fact)) {
        await createPortfolioRepository(tx).updateSite(user.id, site.id, {
          theme: { ...theme, dismissedFacts: [...prev, fact] },
        });
      }
      await createPortfolioRepository(tx).deleteItem(user.id, input.id);
    });
  } else {
    await repo.deleteItem(user.id, input.id);
  }
  revalidatePath(PATH);
  return { ok: true, removed: true };
}

/** Export all items in the portfolio's interchange format (round-trips with the standalone CMS). */
export async function exportPortfolio(): Promise<Result<{ payload: PortfolioExport }>> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const repo = createPortfolioRepository(getDatabase());
  const site = await ensureSite(user.id, user.email);
  const items = await repo.listItemsForUser(user.id, site.id);
  return {
    ok: true,
    payload: { version: 1, exported_at: new Date().toISOString(), items: items.map(toExportItem) },
  };
}

/**
 * Import items from a portfolio export JSON (the standalone CMS's format, or
 * Fadi's own). `merge` adds; `replace` clears this site's items first. This is
 * how your existing portfolio data comes across.
 */
export async function importPortfolio(input: {
  payload: PortfolioExport;
  mode: "merge" | "replace";
}): Promise<Result<{ imported: number; heldBack: number }>> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const payload = input.payload;
  if (!payload || payload.version !== 1 || !Array.isArray(payload.items)) {
    return { ok: false, message: "Unrecognized file — expected a portfolio export JSON." };
  }

  const repo = createPortfolioRepository(getDatabase());
  const site = await ensureSite(user.id, user.email);

  const parsedItems = payload.items.map(fromExportItem).filter((r) => r.title.trim());

  // "Replace" wipes the portfolio first, so there is nothing to duplicate against and
  // the file is the truth. "Merge" adds to what is there — the door through which an
  // export re-imported after some editing quietly doubles everything it touches.
  const { admitPortfolioItems } = await import("@/lib/portfolio/admit-items");
  const merged =
    input.mode === "replace"
      ? { keep: parsedItems, heldBack: [] as { title: string; matches: string }[] }
      : admitPortfolioItems(parsedItems, await repo.listItemsForUser(user.id, site.id));

  const rows = merged.keep.map((r, i) => ({
    ...r,
    siteId: site.id,
    sortOrder: r.sortOrder || (i + 1) * 10,
    // Choosing a file is deliberate; having read every row in it is not. An export from
    // another Fadi, or a hand-edited JSON, is exactly the content most worth a look.
    confirmedAt: null,
  }));

  // Replace is atomic (see repo.replaceItems): the old delete-then-insert could wipe
  // the user's whole portfolio and insert nothing if the insert failed.
  const created =
    input.mode === "replace"
      ? await repo.replaceItems(user.id, site.id, rows)
      : await repo.createItems(user.id, rows);
  revalidatePath(PATH);
  return { ok: true, imported: created.length, heldBack: merged.heldBack.length };
}

export type FocusPlanItem = {
  id: string;
  title: string;
  section: string;
  /** "lead" | "keep" | "hide" — what focusing would do to this item. */
  verdict: "lead" | "keep" | "hide";
  reason: string;
};

export type FocusPlan = {
  direction: string;
  /** Every item, with what focusing would do to it. Nothing is ever deleted. */
  plan: FocusPlanItem[];
  leadCount: number;
  hideCount: number;
  note: string;
};

/**
 * FOCUS THE PORTFOLIO ON ONE DIRECTION.
 *
 * The reviewer's point, applied to the site rather than to a single application:
 * a portfolio that spans IT operations, cloud, DevOps and security asks the reader
 * to work out what you are. Focusing picks ONE direction and puts everything else
 * out of the way.
 *
 * Two rules, both inherited from the lead-evidence decision:
 *   - Hiding is never deleting. Off-spine items are unpublished, so a different
 *     direction (or a change of mind) restores them in one click.
 *   - Qualifications, credentials and skills are structural and are never hidden —
 *     the portfolio still has to say what you're qualified in.
 *
 * Preview first: this returns the plan and writes nothing. `applyPortfolioFocus`
 * commits it. Detect → propose → approve, like the rest of the CMS.
 */
export async function planPortfolioFocus(input: { direction: string }): Promise<Result<FocusPlan>> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const db = getDatabase();
  const repo = createPortfolioRepository(db);
  const site = await ensureSite(user.id, user.email);
  const items = await repo.listItemsForUser(user.id, site.id);
  if (items.length === 0) return { ok: false, message: "Nothing on the portfolio to focus yet." };

  const [{ chooseLeadEvidence }, { createCareerProfilesRepository }] = await Promise.all([
    import("@/lib/evidence/lead"),
    import("@careeros/database"),
  ]);
  const profiles = await createCareerProfilesRepository(db).listForUser(user.id);
  const target = profiles.find((p) => (p.label || p.targetRole) === input.direction);
  if (!target) return { ok: false, message: `No career direction called "${input.direction}".` };

  const seen = new Set<string>();
  const directions = [];
  for (const p of profiles) {
    if (!p.targetRole) continue;
    const name = p.label || p.targetRole;
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    directions.push({ role: name, domain: p.domain, synonyms: p.roleSynonyms ?? [] });
  }

  // Judge each portfolio item on ITS OWN text, not on the evidence it was seeded
  // from: on a real portfolio only a handful of items carry an evidence link
  // (5 of 38 on the first site this ran against), so an evidence-keyed decision
  // would silently shrug at almost everything. A portfolio item's TITLE is its own
  // name for itself, so it is fed in as a tag — that is the signal that makes a
  // card called "DevOps" recognisably DevOps.
  const asEvidence = items.map((item) => ({
    id: item.id,
    kind: SECTION_KIND[item.section] ?? "skill",
    title: item.title,
    organization: item.subtitle,
    period: item.dateRange,
    detail: [item.description, ...(item.bullets ?? [])].filter(Boolean).join(" "),
    metrics: null,
    tags: [item.title, item.tag, ...(item.roles ?? [])].filter(Boolean) as string[],
    marketTags: [],
    origin: "portfolio",
  }));

  const decision = chooseLeadEvidence(
    asEvidence,
    { title: target.targetRole, description: target.domain ?? null },
    directions,
    // On a portfolio each skill is its own card, so skills dilute like projects do.
    { competing: new Set(["experience", "project", "skill"]) }
  );

  const verdictOf = new Map<string, { verdict: FocusPlanItem["verdict"]; reason: string }>();
  for (const p of decision.lead) verdictOf.set(p.item.id, { verdict: "lead", reason: p.reason });
  for (const p of decision.holdBack)
    verdictOf.set(p.item.id, { verdict: "hide", reason: p.reason });
  for (const p of [...decision.support, ...decision.untranslated])
    verdictOf.set(p.item.id, { verdict: "keep", reason: p.reason });

  const plan: FocusPlanItem[] = items.map((item) => {
    const v = verdictOf.get(item.id);
    return {
      id: item.id,
      title: item.title,
      section: item.section,
      verdict: v?.verdict ?? "keep",
      reason: v?.reason ?? "Kept as is.",
    };
  });

  const leadCount = plan.filter((p) => p.verdict === "lead").length;
  const hideCount = plan.filter((p) => p.verdict === "hide").length;

  return {
    ok: true,
    direction: input.direction,
    plan,
    leadCount,
    hideCount,
    note:
      hideCount > 0
        ? `Focusing on ${input.direction} leads with ${leadCount} and hides ${hideCount} off-direction ${hideCount === 1 ? "item" : "items"}. Nothing is deleted — switching direction brings them back.`
        : `Your portfolio already reads as ${input.direction}. Nothing needs hiding.`,
  };
}

/**
 * Commit a focus plan — but only the hides the USER approved.
 *
 * Deliberately not "re-plan and apply": lexical matching cannot tell a genuinely
 * off-direction item from an untranslated one. On the first real portfolio this ran
 * against it proposed hiding `Linux` from a security focus, because the user's
 * IT-Administrator direction lists "linux administrator" as a synonym while their
 * Cybersecurity vocabulary (SOC, threat, incident response) shares no token with it
 * — the exact "untranslated, not irrelevant" case the pool is built around.
 *
 * So the plan is a PROPOSAL and this takes the ids the user actually ticked, which
 * is the CMS's existing rule: detect → propose → approve, never auto-mutate.
 */
export async function applyPortfolioFocus(input: {
  /** Item ids the user approved for hiding. Everything else is (re)published. */
  hideIds: string[];
}): Promise<Result<{ hidden: number; shown: number }>> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const db = getDatabase();
  const repo = createPortfolioRepository(db);
  const site = await ensureSite(user.id, user.email);
  const items = await repo.listItemsForUser(user.id, site.id);

  const hide = new Set(input.hideIds);
  // Only touch what actually changes — and re-publish anything no longer hidden, or
  // switching focus would leave the site permanently emptied by the previous focus.
  for (const item of items) {
    const shouldPublish = !hide.has(item.id);
    if (item.isPublished !== shouldPublish) {
      await repo.updateItem(user.id, item.id, { isPublished: shouldPublish });
    }
  }

  revalidatePath(PATH);
  return { ok: true, hidden: hide.size, shown: items.length - hide.size };
}

/** The user's career directions, for the focus picker. */
export async function listFocusDirections(): Promise<Result<{ directions: string[] }>> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const { createCareerProfilesRepository } = await import("@careeros/database");
  const profiles = await createCareerProfilesRepository(getDatabase()).listForUser(user.id);
  const seen = new Set<string>();
  const directions: string[] = [];
  for (const p of profiles) {
    const name = p.label || p.targetRole;
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    directions.push(name);
  }
  return { ok: true, directions };
}

/**
 * The owner's own visitor numbers for their site.
 *
 * Owner-scoped by construction: the stats query filters on the caller's userId, so
 * one person can never read another's traffic even if they guess a site id.
 */
export async function loadPortfolioStats(input: { days?: number } = {}): Promise<
  Result<{
    stats: PortfolioStats;
    feedback: FeedbackNote[];
    timeline: TimelineEntry[];
    handle: string;
    isPublished: boolean;
  }>
> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const site = await ensureSite(user.id, user.email);
  const { portfolioStats, portfolioFeedback, portfolioTimeline } =
    await import("@/lib/portfolio/analytics");
  const [stats, feedback, timeline] = await Promise.all([
    portfolioStats(user.id, site.id, input.days ?? 30),
    portfolioFeedback(user.id, site.id),
    portfolioTimeline(user.id, site.id, input.days ?? 30),
  ]);
  return {
    ok: true,
    stats,
    feedback,
    timeline,
    handle: site.handle,
    isPublished: site.isPublished,
  };
}

/**
 * Clear the owner's own visits and automated hits from the log.
 *
 * These rows are already excluded from every number, so this changes no statistic. It
 * exists because testing your own portfolio means visiting it, and a log full of your
 * own footprints makes the real ones hard to find. Genuine visitor events are never
 * touched — there is deliberately no way to delete those from here, because a tool that
 * lets you tidy away inconvenient evidence is not evidence.
 */
export async function clearPortfolioTestEvents(): Promise<Result<{ removed: number }>> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const site = await ensureSite(user.id, user.email);
  const { createProductEventsRepository } = await import("@careeros/database");
  const { getDatabase } = await import("@/lib/database/client");
  const removed = await createProductEventsRepository(getDatabase()).purgeExcluded(
    user.id,
    site.id
  );
  return { ok: true, removed };
}

/**
 * Pull visitor events from the public collector into Fadi.
 *
 * Manual rather than automatic: Fadi only runs when you run it, so a background
 * schedule would be a schedule that mostly doesn't happen. Pressing Sync when you
 * open the panel is honest about that.
 */
export async function syncPortfolioAudience(): Promise<
  Result<{ imported: number; skipped: number }>
> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const site = await ensureSite(user.id, user.email);
  const { syncCollectorEvents, syncCollectorFeedback } =
    await import("@/lib/portfolio/collector-sync");
  const args = { userId: user.id, siteId: site.id, handle: site.handle };
  const res = await syncCollectorEvents(args);
  if (!res.ok) return { ok: false, message: res.message };
  // Feedback lives on the same collector; one button should bring home both.
  const fb = await syncCollectorFeedback(args);

  revalidatePath(PATH);
  return {
    ok: true,
    imported: res.imported + (fb.ok ? fb.imported : 0),
    skipped: res.skipped,
  };
}

export type Dismissal = { factId: string; title: string };

/** What the user has told Sync to stop bringing back. */
export async function listDismissed(): Promise<Result<{ dismissed: Dismissal[] }>> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const site = await ensureSite(user.id, user.email);
  const ids = ((site.theme as { dismissedFacts?: unknown })?.dismissedFacts as string[]) ?? [];
  if (ids.length === 0) return { ok: true, dismissed: [] };

  const evidence = await createEvidenceRepository(getDatabase()).listAllForUser(user.id);
  const titleOf = new Map(evidence.map((e) => [e.factId ?? e.id, e.title]));

  // A DISMISSAL FOR A RECORD THAT NO LONGER EXISTS IS NOT A CHOICE, IT IS LITTER.
  //
  // The owner's panel showed six chips, four of them "A removed entry · undo" — dismissals whose
  // facts went with an earlier data reset. Nothing can bring them back, so undo does nothing, and
  // a list of unnamed rows is just something else to read past. They are dropped here, and the
  // cleaned list is written back so the panel does not have to keep filtering them out.
  const live = ids.filter((factId) => titleOf.has(factId));
  if (live.length !== ids.length) {
    await createPortfolioRepository(getDatabase()).updateSite(user.id, site.id, {
      theme: { ...(site.theme as Record<string, unknown>), dismissedFacts: live },
    });
  }

  return {
    ok: true,
    dismissed: live.map((factId) => ({ factId, title: titleOf.get(factId) ?? "A removed entry" })),
  };
}

/**
 * Undo a dismissal, so Sync will offer this work again.
 *
 * A dismissal is a decision, and a decision a user cannot reverse is a trap — the
 * first version of this was only undoable by hand-editing JSON.
 */
export async function undismissFact(input: { factId: string }): Promise<{ ok: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };
  const repo = createPortfolioRepository(getDatabase());
  const site = await ensureSite(user.id, user.email);
  const theme = (site.theme ?? {}) as Record<string, unknown>;
  const prev = Array.isArray(theme.dismissedFacts) ? (theme.dismissedFacts as string[]) : [];
  await repo.updateSite(user.id, site.id, {
    theme: { ...theme, dismissedFacts: prev.filter((f) => f !== input.factId) },
  });
  revalidatePath(PATH);
  return { ok: true };
}

/**
 * Put automatically-collected items on the public site.
 *
 * The gate's only action. Everything Fadi gathers on its own — an extraction, an
 * evidence sync, an imported file — lands unconfirmed and stays off the live site
 * until this runs. That is what lets the rest of the platform stay under construction
 * without the one part strangers read being at risk.
 */
export async function confirmPortfolioItems(input: {
  ids: string[];
}): Promise<Result<{ confirmed: number }>> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const repo = createPortfolioRepository(getDatabase());
  const confirmed = await repo.confirmItems(user.id, input.ids.slice(0, 200));
  const site = await ensureSite(user.id, user.email);
  await publish("portfolio.changed", { userId: user.id, siteId: site.id, reason: "confirmed" });
  revalidatePath(PATH);
  return { ok: true, confirmed };
}
