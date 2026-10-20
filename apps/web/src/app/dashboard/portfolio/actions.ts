"use server";

import { createEvidenceRepository, createPortfolioRepository } from "@careeros/database";
import { revalidatePath } from "next/cache";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getUserDocGenerate } from "@/lib/ai/user-generate";
import { getDatabase } from "@/lib/database/client";
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
  experience: "experience",
  education: "education",
  certification: "achievement",
  skill: "skill",
  custom: "skill",
};

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
  Result<{
    site: PortfolioSiteView;
    handle: string;
    isPublished: boolean;
    items: PortfolioItemView[];
    /** Proof from Evidence not on the portfolio yet — so the CMS can proactively ask
     *  the user to pull it in (detect → propose → approve; never auto-mutate). */
    pendingProof: number;
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
  const dismissed = new Set(
    ((site.theme as { dismissedFacts?: unknown })?.dismissedFacts as string[] | undefined) ?? [],
  );
  const factOfEvidence = new Map(evidence.map((e) => [e.id, e.factId ?? e.id]));
  const pendingProof = seedItemsFromEvidence(evidence).filter(
    (r) =>
      !have.has(r.evidenceItemId) &&
      !dismissed.has(factOfEvidence.get(r.evidenceItemId) ?? r.evidenceItemId) &&
      !items.some((x) => isSameEntry(r, x)),
  ).length;

  return {
    ok: true,
    site: toSiteView(site),
    handle: site.handle,
    isPublished: site.isPublished,
    items: items.map(toItemView),
    pendingProof,
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
            Object.entries(input.labels).filter(([, v]) => typeof v === "string" && v.trim()),
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
export async function syncFromEvidence(): Promise<Result<{ added: number; nearMatches: number }>> {
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

  // WHAT THE USER ALREADY DECIDED AGAINST.
  //
  // Deleting a portfolio item used to be futile: the item's evidence id left `have`,
  // the lexical check could not recognise a re-worded record, and the next Sync
  // cheerfully re-created it — "Added 3 items from your evidence" on a pool the user
  // had just cleaned. A dismissal is a decision, so it is remembered. It is keyed on
  // the FACT, not the row, so the same reality re-worded stays dismissed too.
  const dismissed = new Set(
    ((site.theme as { dismissedFacts?: unknown })?.dismissedFacts as string[] | undefined) ?? [],
  );
  const factOfEvidence = new Map(evidence.map((e) => [e.id, e.factId ?? e.id]));

  // IDENTITY, NOT WORDING. `isSameEntry` is lexical and section-scoped, so a project
  // rewritten for a different application read as a brand-new one. This asks whether
  // it is the same real thing (see lib/identity/resolve).
  const { findSameThings } = await import("@/lib/identity/resolve");
  const asInput = (x: {
    id?: string;
    section: string;
    title: string;
    subtitle: string | null;
    dateRange: string | null;
    description: string | null;
    bullets?: string[] | null;
  }, id: string) => ({
    id,
    kind: x.section,
    title: x.title,
    organization: x.subtitle,
    period: x.dateRange,
    detail: [x.description, ...(x.bullets ?? [])].filter(Boolean).join(" "),
  });
  const existingInputs = existing.map((x) => asInput(x, x.id));

  // A "MAYBE" DOES NOT BECOME A SECOND ITEM.
  //
  // This is where the user's six duplicates actually landed: the resolver ran, scored
  // every one of them "maybe" rather than "same", and the old rule added on a maybe.
  // Detection after the fact was never the answer — by then two copies of one project
  // are already on a public site and in every document generated from it.
  //
  // Not creating an item here loses nothing: the evidence row still exists, still holds
  // its wording, and the background pass reports the near-match so the owner can add it
  // deliberately if the two really are different work. Skipping is a click to undo;
  // publishing a duplicate is not.
  let nearMatches = 0;

  const kept = seeded.filter((r, idx) => {
    if (have.has(r.evidenceItemId)) return false;
    if (dismissed.has(factOfEvidence.get(r.evidenceItemId) ?? r.evidenceItemId)) return false;
    if (existing.some((x) => isSameEntry(r, x))) return false;
    // Only a CONFIDENT match suppresses a new item — a "maybe" is still added, because
    // silently withholding real work is worse than a duplicate the user can merge.
    const me = asInput(r, `seed-${idx}`);
    const mine = findSameThings([me, ...existingInputs]).filter(
      (m) => m.a === me.id || m.b === me.id,
    );
    if (mine.some((m) => m.verdict === "same")) return false;
    if (mine.some((m) => m.verdict === "maybe")) {
      nearMatches += 1;
      return false;
    }
    return true;
  });
  if (kept.length === 0) return { ok: true, added: 0, nearMatches };

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
    confirmedAt: null, // automatic — waits for a look before it goes public
  }));
  const created = await repo.createItems(user.id, rows);
  await publish("portfolio.changed", { userId: user.id, siteId: site.id, reason: "synced" });
  revalidatePath(PATH);
  return { ok: true, added: created.length, nearMatches };
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
      // The owner typed this. Confirmation is what "a person has looked at it" means,
      // and they were looking at it while they wrote it.
      confirmedAt: new Date(),
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

export async function deleteItem(input: { id: string }): Promise<{ ok: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };

  const db = getDatabase();
  const repo = createPortfolioRepository(db);

  // Remember the decision BEFORE the row goes, or Sync will simply put it back.
  // Keyed on the fact, so the same reality re-worded stays dismissed as well.
  const item = await repo.getItemForUser(user.id, input.id);
  if (item?.evidenceItemId) {
    const site = await ensureSite(user.id, user.email);
    const evidence = await createEvidenceRepository(db).listAllForUser(user.id);
    const fact =
      evidence.find((e) => e.id === item.evidenceItemId)?.factId ?? item.evidenceItemId;
    const theme = (site.theme ?? {}) as Record<string, unknown>;
    const prev = Array.isArray(theme.dismissedFacts) ? (theme.dismissedFacts as string[]) : [];
    if (!prev.includes(fact)) {
      await repo.updateSite(user.id, site.id, {
        theme: { ...theme, dismissedFacts: [...prev, fact] },
      });
    }
  }

  await repo.deleteItem(user.id, input.id);
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
export async function planPortfolioFocus(input: {
  direction: string;
}): Promise<Result<FocusPlan>> {
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
  for (const p of decision.holdBack) verdictOf.set(p.item.id, { verdict: "hide", reason: p.reason });
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
  const { portfolioStats, portfolioFeedback, portfolioTimeline } = await import(
    "@/lib/portfolio/analytics"
  );
  const [stats, feedback, timeline] = await Promise.all([
    portfolioStats(user.id, site.id, input.days ?? 30),
    portfolioFeedback(user.id, site.id),
    portfolioTimeline(user.id, site.id, input.days ?? 30),
  ]);
  return { ok: true, stats, feedback, timeline, handle: site.handle, isPublished: site.isPublished };
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
  const removed = await createProductEventsRepository(getDatabase()).purgeExcluded(user.id, site.id);
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
  const { syncCollectorEvents, syncCollectorFeedback } = await import(
    "@/lib/portfolio/collector-sync"
  );
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
  const dismissed = ids.map((factId) => ({
    factId,
    title: evidence.find((e) => (e.factId ?? e.id) === factId)?.title ?? "A removed entry",
  }));
  return { ok: true, dismissed };
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
export async function confirmPortfolioItems(input: { ids: string[] }): Promise<
  Result<{ confirmed: number }>
> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const repo = createPortfolioRepository(getDatabase());
  const confirmed = await repo.confirmItems(user.id, input.ids.slice(0, 200));
  const site = await ensureSite(user.id, user.email);
  await publish("portfolio.changed", { userId: user.id, siteId: site.id, reason: "confirmed" });
  revalidatePath(PATH);
  return { ok: true, confirmed };
}
