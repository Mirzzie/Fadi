import "server-only";

import { createGithubConnectionsRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { decryptSecret } from "@/lib/security/crypto";
import { GitHubClient } from "@/lib/portfolio/github";
import { logger } from "@/lib/observability/logger";
import type { Candidate } from "@/lib/identity/admit";

/**
 * CAPTURE — evidence Fadi did not have to be told about.
 *
 * The published portfolio currently shows 16 skills and 8 projects with no artefact
 * attached. Those are claims, and claims are exactly what stopped carrying signal once
 * most applicants started writing theirs with a model. What is scarce now is proof that
 * the work happened.
 *
 * A repository is proof. It is dated, attributable, linkable, and it was not written to
 * impress anyone — which is precisely what gives it warranting value. The connection
 * needed to read it has been sitting in `github_connections` since portfolio publishing
 * shipped, doing nothing but pushing.
 *
 * This is the cheapest possible test of the whole lab thesis (ADR 0011): if the repos
 * the user ALREADY has do not produce evidence worth showing, then provisioning labs to
 * generate more would not have either. Capture before provision, and let the cheap
 * source answer the expensive question.
 *
 * Everything here goes through `admitEvidence`, so a captured repo that already exists
 * as a hand-written project resolves onto it instead of becoming a duplicate. Records
 * are `origin: "github"` — machine-authored — so under the two-way rule they can never
 * displace wording the user wrote themselves.
 */

/**
 * Tutorial and course repositories. Real work, no doubt — but finishing an exercise is
 * not the same claim as building something, and a portfolio that presents the two
 * alike invites a reader to discount both.
 *
 * Measured against the user's real account: this pattern alone removes seven of the
 * twenty-four repos an earlier, looser filter would have captured.
 */
const TUTORIAL = /^(skills-|learn-|tutorial|demo-|test-|hello-|sample-|practice|odin-|freecodecamp|hacktoberfest|.*-exercise)/i;
const TUTORIAL_BLURB = /\b(exercise|my clone|my first|the odin project|getting started|tutorial|course|bootcamp)\b/i;

/**
 * A repo has to look like WORK before it counts as evidence of work.
 *
 * The first version of this asked only "does it have a description, a language, or
 * topics?" — and 24 of 47 repos passed, including a 2020 "my first repository in
 * github" and three GitHub Skills clones. That is not a tuning miss; a language tag is
 * a property of any file, not evidence that anything was built.
 *
 * The bar now: it must SAY what it is, or be recent enough that a stranger reading the
 * portfolio would find it current. Everything else is proposed to the owner, never
 * admitted silently, because only they know which of their repos is real.
 */
export function worthCapturing(
  r: {
    name: string;
    fork: boolean;
    archived: boolean;
    description: string | null;
    language: string | null;
    topics: string[];
    pushedAt: string | null;
  },
  now = Date.now(),
): boolean {
  // A fork is someone else's work until proven otherwise, and proving it needs commit
  // history this pass does not fetch. Better to miss one than to claim another
  // person's project — the whole point of capture is that it cannot be inflated.
  if (r.fork || r.archived) return false;
  if (TUTORIAL.test(r.name)) return false;
  if (r.description && TUTORIAL_BLURB.test(r.description)) return false;

  const described = Boolean(r.description?.trim()) || r.topics.length > 0;
  const pushed = r.pushedAt ? Date.parse(r.pushedAt) : 0;
  const recent = pushed > 0 && now - pushed < THREE_YEARS_MS;

  // Described work counts whenever it happened. Undescribed work counts only while it
  // is recent enough to still represent what this person does — a 2020 toy with no
  // description says nothing a reader in 2026 should weigh.
  return described || recent;
}

const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000;

const year = (iso: string | null): string | null => (iso ? iso.slice(0, 4) : null);

/** One repository, in the shape the admission gate speaks. */
export function repoToCandidate(r: {
  name: string;
  description: string | null;
  language: string | null;
  topics: string[];
  url: string | null;
  createdAt: string | null;
  pushedAt: string | null;
}): Candidate & { origin: string } {
  const from = year(r.createdAt);
  const to = year(r.pushedAt);
  return {
    kind: "project",
    // The repo name as the user wrote it — never a prettified guess.
    title: r.name,
    organization: null,
    period: from && to && from !== to ? `${from} – ${to}` : (to ?? from),
    detail: r.description?.trim() || null,
    // The link IS the evidence. Without it this is just another claim.
    url: r.url,
    tags: [r.language, ...r.topics].filter((t): t is string => Boolean(t)).map((t) => t.toLowerCase()),
    origin: "github",
  };
}

export type CaptureResult = {
  scanned: number;
  candidates: (Candidate & { origin: string })[];
  /** Why the rest were skipped, so a thin result is explainable rather than mysterious. */
  skipped: { forks: number; archived: number; empty: number };
};

/**
 * Read the user's repositories and return what is worth admitting.
 *
 * Deliberately does NOT write. The caller decides — the background pass admits them and
 * reports, a future preview surface could show them first. Keeping the read pure is
 * what makes it testable without a database.
 */
export async function captureGithubRepos(userId: string): Promise<CaptureResult | null> {
  const conn = await createGithubConnectionsRepository(getDatabase()).getByUserId(userId);
  if (!conn?.tokenCiphertext) return null;

  const token = decryptSecret(conn.tokenCiphertext);
  if (!token) return null;

  try {
    const repos = await new GitHubClient(token, fetch).listRepos();
    const skipped = { forks: 0, archived: 0, empty: 0 };
    const candidates: (Candidate & { origin: string })[] = [];

    for (const r of repos) {
      if (r.fork) { skipped.forks += 1; continue; }
      if (r.archived) { skipped.archived += 1; continue; }
      if (!worthCapturing(r)) { skipped.empty += 1; continue; }
      candidates.push(repoToCandidate(r));
    }

    return { scanned: repos.length, candidates, skipped };
  } catch (err) {
    // A capture failure is never worth interrupting anything for.
    logger.warn("capture.github_failed", {
      userId,
      error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
    });
    return null;
  }
}
