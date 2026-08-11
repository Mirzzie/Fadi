"use server";

import { createEvidenceRepository, createPortfolioRepository } from "@careeros/database";
import { revalidatePath } from "next/cache";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getUserDocGenerate } from "@/lib/ai/user-generate";
import { getDatabase } from "@/lib/database/client";
import { checkPortfolioIntegrityAI, type IntegrityAiResult } from "@/lib/portfolio/integrity";
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

const SECTIONS = [
  "project",
  "experience",
  "education",
  "certification",
  "skill",
  "hobby",
  "custom",
] as const;

type Result<T> = ({ ok: true } & T) | { ok: false; message: string };

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
  Result<{ site: PortfolioSiteView; handle: string; isPublished: boolean; items: PortfolioItemView[] }>
> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const repo = createPortfolioRepository(getDatabase());
  const site = await ensureSite(user.id, user.email);
  const items = await repo.listItemsForUser(user.id, site.id);
  return {
    ok: true,
    site: toSiteView(site),
    handle: site.handle,
    isPublished: site.isPublished,
    items: items.map(toItemView),
  };
}

const TEMPLATES = ["noir-gold", "aurora", "minimal"];

export async function updateSiteSettings(input: {
  handle: string;
  title: string;
  headline?: string;
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
      return { ok: false, message: "I couldn't find enough in your history to build a portfolio yet." };
    }
  }

  const rows = seedItemsFromEvidence(evidence).map((r) => ({
    ...r,
    siteId: site.id,
    roles: [] as string[],
    url: null,
    imageUrl: null,
    gallery: [] as string[],
    isPublished: true,
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
export async function syncFromEvidence(): Promise<Result<{ added: number }>> {
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
  const seeded = seedItemsFromEvidence(evidence);
  const kept = seeded.filter(
    (r) => !have.has(r.evidenceItemId) && !existing.some((x) => isSameEntry(r, x)),
  );
  if (kept.length === 0) return { ok: true, added: 0 };

  const maxSort = existing.reduce((m, i) => Math.max(m, i.sortOrder), 0);
  const rows = kept.map((r, i) => ({
    ...r,
    siteId: site.id,
    roles: [] as string[],
    url: null,
    imageUrl: null,
    gallery: [] as string[],
    isPublished: true,
    sortOrder: maxSort + (i + 1) * 10,
  }));
  const created = await repo.createItems(user.id, rows);
  await publish("portfolio.changed", { userId: user.id, siteId: site.id, reason: "synced" });
  revalidatePath(PATH);
  return { ok: true, added: created.length };
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

export async function saveItem(input: {
  id?: string;
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

  const repo = createPortfolioRepository(getDatabase());
  const site = await ensureSite(user.id, user.email);
  const section = (SECTIONS as readonly string[]).includes(input.section) ? input.section : "custom";

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
    url: input.url?.trim() || null,
    imageUrl: input.imageUrl?.trim() || null,
    gallery: input.gallery.filter(Boolean),
  };

  let row;
  if (input.id) {
    row = await repo.updateItem(user.id, input.id, fields);
  } else {
    // Append to the end of its section. (Creating everything at sort_order 0 made
    // new items tie, so their order was arbitrary and drag-reorder looked broken.)
    const siblings = await repo.listItemsForUser(user.id, site.id);
    const maxSort = siblings
      .filter((i) => i.section === section)
      .reduce((m, i) => Math.max(m, i.sortOrder), 0);
    row = await repo.createItem(user.id, {
      ...fields,
      siteId: site.id,
      sortOrder: maxSort + 10,
      isPublished: true,
    });
  }
  if (!row) return { ok: false, message: "I can't find that item." };
  revalidatePath(PATH);
  return { ok: true, item: toItemView(row) };
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
    const text = String(raw ?? "").trim().replace(/^["']|["']$/g, "").trim();
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

export async function deleteItem(input: { id: string }): Promise<{ ok: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };
  await createPortfolioRepository(getDatabase()).deleteItem(user.id, input.id);
  revalidatePath(PATH);
  return { ok: true };
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
}): Promise<Result<{ imported: number }>> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const payload = input.payload;
  if (!payload || payload.version !== 1 || !Array.isArray(payload.items)) {
    return { ok: false, message: "Unrecognized file — expected a portfolio export JSON." };
  }

  const repo = createPortfolioRepository(getDatabase());
  const site = await ensureSite(user.id, user.email);

  const rows = payload.items
    .map(fromExportItem)
    .filter((r) => r.title.trim())
    .map((r, i) => ({ ...r, siteId: site.id, sortOrder: r.sortOrder || (i + 1) * 10 }));

  // Replace is atomic (see repo.replaceItems): the old delete-then-insert could wipe
  // the user's whole portfolio and insert nothing if the insert failed.
  const created =
    input.mode === "replace"
      ? await repo.replaceItems(user.id, site.id, rows)
      : await repo.createItems(user.id, rows);
  revalidatePath(PATH);
  return { ok: true, imported: created.length };
}
