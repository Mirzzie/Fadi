import "server-only";

import {
  createCareerProfilesRepository,
  createPortfolioRepository,
  createResumesRepository,
  type CreateFindingInput,
} from "@careeros/database";
import { findAllDuplicates } from "@careeros/portfolio";

import { getDatabase } from "@/lib/database/client";
import { getUserDocGenerate } from "@/lib/ai/user-generate";
import { logger } from "@/lib/observability/logger";

/**
 * COHERENCE — does Fadi's own data still agree with itself?
 *
 * This runs on the background pass, not behind a button, and that distinction is the
 * whole point. A check the user has to remember to press is a check that runs once,
 * on the day it ships. Worse, every such button is another thing on a screen that is
 * already busy — the user's words: "introducing new options isn't the solution... it
 * adds many clickable options making people messy and complex."
 *
 * So the shape is the one Fadi's agency already uses everywhere else: the pass finds
 * things, writes them to `agent_findings`, and the user meets them in the activity
 * centre alongside new roles and market signals. Detect in the background, alert once,
 * and let the person decide — never act on their history without them.
 *
 * Two questions, both about the same drift:
 *   - the base résumé holds something the portfolio doesn't (a real gap);
 *   - the portfolio holds one thing twice (the same reality, re-worded for a different
 *     application, which is the root bug this platform exists to solve).
 *
 * COST DISCIPLINE. The résumé comparison needs a structured parse, i.e. a model call.
 * The agent runs every few hours forever, so it must not pay for that when nothing has
 * changed — the caller passes the last run time and this returns early unless the
 * résumé or the portfolio has actually moved since.
 */
export async function coherenceFindings(
  userId: string,
  since: Date | null,
): Promise<CreateFindingInput[]> {
  const db = getDatabase();
  const findings: CreateFindingInput[] = [];

  try {
    const portfolioRepo = createPortfolioRepository(db);
    const sites = await portfolioRepo.listSitesForUser(userId).catch(() => []);
    const site = sites[0];
    if (!site) return findings;

    const items = await portfolioRepo.listItemsForUser(userId, site.id);
    if (items.length === 0) return findings;

    // ---- 1. One thing recorded twice on the site. Free, no model call. -------
    for (const dup of findAllDuplicates(items).slice(0, 3)) {
      findings.push({
        kind: "portfolio_duplicate",
        title: dup.title,
        detail: dup.detail ?? null,
        href: "/dashboard/portfolio",
        data: { itemIds: dup.itemIds ?? [], severity: dup.severity },
      });
    }

    // ---- 2. Links Fadi made on a "maybe". ----------------------------------
    //
    // THE PRICE OF PREVENTION. The ingest gate now absorbs an uncertain match rather
    // than creating a second record, which is right — but an automatic decision made
    // on a maybe must not sit there being quietly wrong. Every one is flagged at the
    // moment it is made and surfaced here, so the owner confirms or splits it without
    // ever having to go looking.
    const { createEvidenceRepository } = await import("@careeros/database");
    const { UNCONFIRMED_LINK, NEEDS_DECISION } = await import("@/lib/identity/admit");
    const all = await createEvidenceRepository(db).listAllForUser(userId);
    const canonicalById = new Map(all.filter((e) => e.isCanonical).map((e) => [e.factId ?? e.id, e]));
    const unconfirmed = all.filter((e) => !e.isCanonical && e.renderingFor === UNCONFIRMED_LINK);

    // Two versions of one fact, both written by the user, that disagree — a document
    // edited elsewhere against something typed here. Fadi deliberately does not pick a
    // winner; it keeps both and asks, because either choice discards a real decision.
    for (const r of all.filter((e) => e.renderingFor === NEEDS_DECISION).slice(0, 3)) {
      const into = r.factId ? canonicalById.get(r.factId) : null;
      findings.push({
        kind: "evidence_needs_decision",
        title: `Two versions of “${into?.title ?? r.title}” — which should lead?`,
        detail:
          `One you wrote here, one that came back from a document you edited elsewhere. ` +
          `Both are kept; whichever leads is what your résumé and portfolio will show.`,
        href: "/dashboard/evidence",
        data: { renderingId: r.id, factId: r.factId ?? null },
      });
    }
    for (const r of unconfirmed.slice(0, 3)) {
      const into = r.factId ? canonicalById.get(r.factId) : null;
      findings.push({
        kind: "evidence_link_unconfirmed",
        title: `Is “${r.title}” the same as “${into?.title ?? "something you already had"}”?`,
        detail:
          `Fadi filed it as another way of describing the same work rather than adding a second copy. ` +
          `Nothing was lost — if they're actually different, split it back out and both stand on their own.`,
        href: "/dashboard/evidence",
        data: { renderingId: r.id, factId: r.factId ?? null },
      });
    }

    // ---- 3. On the résumé, missing from the site. Needs a parse. -------------
    const resumesRepo = createResumesRepository(db);
    const track = await createCareerProfilesRepository(db).getActiveForUser(userId);
    const resumeRow =
      (await resumesRepo.getLatestForTrack(userId, track?.id ?? null)) ??
      (await resumesRepo.getLatestForTrack(userId, null));
    const raw = (resumeRow?.parsedText ?? resumeRow?.rawText)?.trim();
    if (!raw) return findings;

    // Has anything actually moved? A model call to re-derive an identical answer is
    // pure cost, and this pass repeats forever.
    const touched = [
      resumeRow?.updatedAt ? new Date(resumeRow.updatedAt).getTime() : 0,
      ...items.map((i) => (i.updatedAt ? new Date(i.updatedAt).getTime() : 0)),
    ].reduce((a, b) => Math.max(a, b), 0);
    if (since && touched <= since.getTime()) return findings;

    const generate = await getUserDocGenerate(userId);
    if (!generate) return findings;

    const { structureResumeText } = await import("@/lib/documents/import-resume");
    const { reconcile } = await import("@/lib/portfolio/reconcile");
    const { resumeToIdentity, portfolioToIdentity } = await import(
      "@/lib/portfolio/reconcile-sources"
    );

    let resume;
    try {
      resume = await structureResumeText(raw, generate);
    } catch (err) {
      // Say why. Swallowing this is what made the first version report "couldn't read
      // your résumé" with no way to find out whether the model, the key or the schema
      // was at fault.
      logger.warn("agent.coherence.resume_parse_failed", {
        userId,
        error: err instanceof Error ? err.message.slice(0, 300) : "unknown",
      });
      return findings;
    }

    const resumeRecords = resumeToIdentity(resume);
    if (resumeRecords.length === 0) {
      logger.warn("agent.coherence.resume_empty", { userId, chars: raw.length });
      return findings;
    }

    const report = reconcile(resumeRecords, portfolioToIdentity(items));
    for (const gap of report.missingFromPortfolio.slice(0, 3)) {
      findings.push({
        kind: "portfolio_gap",
        title: `${gap.title} isn't on your portfolio`,
        detail:
          `Your résumé has this${gap.organization ? ` at ${gap.organization}` : ""}` +
          `${gap.period ? ` (${gap.period})` : ""}, but nothing on your site matches it. ` +
          `Anyone who reads the site sees a smaller version of your history than the CV claims.`,
        href: "/dashboard/portfolio",
        data: { kind: gap.kind, title: gap.title, organization: gap.organization ?? null },
      });
    }
  } catch (err) {
    // Coherence is one section of a wider pass. It must never take the run down with it.
    logger.warn("agent.coherence_failed", {
      userId,
      error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
    });
  }

  return findings;
}
