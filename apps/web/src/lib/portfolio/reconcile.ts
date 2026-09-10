import {
  compareIdentity,
  rarityIndex,
  tokens,
  type IdentityInput,
  type Verdict,
} from "@/lib/identity/resolve";

/**
 * IS MY PORTFOLIO ACTUALLY WHAT MY RÉSUMÉ SAYS?
 *
 * Fadi could already find one thing recorded twice inside a single store — duplicates
 * among portfolio items, duplicates in the evidence pool. What it could not do is look
 * across two stores at once, which is where the real drift lives: the base résumé is
 * where a new job gets typed first, and the portfolio is what strangers actually read.
 * They diverge silently, in one direction, and nothing ever said so.
 *
 * This does the comparison the same way as everything else here — through identity
 * resolution, not string matching. A résumé calling something "IT Support Consultant,
 * Spark Technomedia" and a portfolio calling it "Helpdesk & endpoint support" is ONE
 * job described twice; only rarity-weighted overlap, shared organisation and aligned
 * dates can see that, and getting it wrong in either direction is expensive: a false
 * "missing" sends you adding a duplicate, a false "matched" hides a real gap.
 *
 * DELIBERATELY DIRECTIONAL. Something in the résumé and not the portfolio is a gap
 * worth reporting. The reverse is usually correct and normal — a portfolio holds
 * hobby projects, labs and write-ups that have no business on a one-page CV — so it is
 * reported separately and softly, never as an error.
 *
 * THREE BUCKETS, NOT TWO, and that is the important design choice. Lexical signals
 * alone put a genuinely reworded project in the "maybe" band. Calling a maybe MATCHED
 * hides a real gap behind a guess; calling it MISSING tells you to add something you
 * already have. Neither is acceptable, so an uncertain pair gets its own bucket and a
 * question — the same shape as the duplicate panel, which is the honest way to spend a
 * human's attention on the only cases that need it.
 *
 * Pure and synchronous: the LLM parse happens before this is called, so the comparison
 * itself is testable without a provider and behaves identically every run.
 */

export type ReconcileSide = "resume" | "portfolio";

export type ReconcileMatch = {
  resumeId: string;
  portfolioId: string;
  verdict: Verdict;
  reasons: string[];
};

export type ReconcileGap = {
  id: string;
  title: string;
  kind: string;
  organization?: string | null;
  period?: string | null;
  /** The closest thing on the other side, when there was one worth mentioning. */
  nearest?: { id: string; title: string; reasons: string[] } | null;
};

export type ReconcileReport = {
  /** In the résumé, with nothing on the site resembling it. The actionable list. */
  missingFromPortfolio: ReconcileGap[];
  /** In the portfolio, absent from the résumé. Usually fine — shown, not flagged. */
  portfolioOnly: ReconcileGap[];
  /** Confidently the same thing on both sides. */
  matched: ReconcileMatch[];
  /**
   * Probably the same thing, not certainly. Never silently counted as either present
   * or missing — it is asked about, because only the owner can settle it.
   */
  uncertain: (ReconcileMatch & { resumeTitle: string; portfolioTitle: string })[];
  counts: { resume: number; portfolio: number };
};

/**
 * THE SAME NAME, ACROSS TWO STORES, IS THE SAME THING.
 *
 * `compareIdentity` deliberately refuses to merge on a title alone: inside one pool,
 * two records both called "AWS" are usually two different things, and a thin record
 * with nothing else to go on must not be merged on a coincidence. That guard is right
 * there and wrong here — these are ONE PERSON'S two descriptions of one life, and a
 * résumé line reading "MSc Cybersecurity" against a portfolio entry reading "MSc
 * Cybersecurity" is not a coincidence.
 *
 * Found on real data: without this, the degree that exists on BOTH sides was reported
 * as missing from the portfolio AND as portfolio-only — the same record, in two
 * contradictory buckets, telling the owner to add something they already had.
 *
 * Compared on tokens rather than raw strings so case, punctuation and spacing don't
 * matter; the kinds must still agree, because a skill named "Linux" is not a project.
 */
function sameName(a: IdentityInput, b: IdentityInput): boolean {
  if ((a.kind ?? "") !== (b.kind ?? "")) return false;
  const ta = tokens(a.title);
  const tb = tokens(b.title);
  if (ta.length === 0 || ta.length !== tb.length) return false;
  return ta.join(" ") === tb.join(" ");
}

const gapOf = (item: IdentityInput, nearest: ReconcileGap["nearest"]): ReconcileGap => ({
  id: item.id,
  title: item.title,
  kind: item.kind ?? "custom",
  organization: item.organization ?? null,
  period: item.period ?? null,
  nearest: nearest ?? null,
});

export function reconcile(
  resumeItems: IdentityInput[],
  portfolioItems: IdentityInput[],
): ReconcileReport {
  const counts = { resume: resumeItems.length, portfolio: portfolioItems.length };
  if (resumeItems.length === 0 || portfolioItems.length === 0) {
    return {
      // With nothing to compare against, EVERYTHING would read as missing. That is
      // technically true and completely useless, so say nothing instead of crying wolf.
      missingFromPortfolio: [],
      portfolioOnly: [],
      matched: [],
      uncertain: [],
      counts,
    };
  }

  // Rarity is measured across BOTH sides together. Measured per-store, a term that is
  // ordinary in one and unique in the other would score as distinctive by accident.
  const idf = rarityIndex([...resumeItems, ...portfolioItems]);

  const matched: ReconcileMatch[] = [];
  const uncertain: ReconcileReport["uncertain"] = [];
  const missingFromPortfolio: ReconcileGap[] = [];
  const pairedPortfolio = new Set<string>();

  for (const r of resumeItems) {
    let best: { p: IdentityInput; verdict: Verdict; reasons: string[]; rank: number } | null = null;
    for (const p of portfolioItems) {
      if (sameName(r, p)) {
        best = { p, verdict: "same", reasons: ["same title, same kind"], rank: 3 };
        break;
      }
      const m = compareIdentity(r, p, idf);
      const rank = m.verdict === "same" ? 2 : m.verdict === "maybe" ? 1 : 0;
      if (rank === 0) continue;
      if (!best || rank > best.rank) best = { p, verdict: m.verdict, reasons: m.reasons, rank };
    }

    if (best?.verdict === "same") {
      matched.push({ resumeId: r.id, portfolioId: best.p.id, verdict: "same", reasons: best.reasons });
      pairedPortfolio.add(best.p.id);
      continue;
    }
    if (best?.verdict === "maybe") {
      uncertain.push({
        resumeId: r.id,
        portfolioId: best.p.id,
        verdict: "maybe",
        reasons: best.reasons,
        resumeTitle: r.title,
        portfolioTitle: best.p.title,
      });
      // Claimed by the near-match, so it is NOT also listed as portfolio-only. An
      // unanswered question must not become two separate complaints about one thing.
      pairedPortfolio.add(best.p.id);
      continue;
    }
    missingFromPortfolio.push(gapOf(r, null));
  }

  const portfolioOnly = portfolioItems
    .filter((p) => !pairedPortfolio.has(p.id))
    // Skills are a vocabulary, not events. A portfolio lists far more of them than any
    // résumé has room for, and listing every one as "not in your résumé" is noise.
    .filter((p) => (p.kind ?? "") !== "skill")
    .map((p) => gapOf(p, null));

  return { missingFromPortfolio, portfolioOnly, matched, uncertain, counts };
}
