import "server-only";

import { createEvidenceRepository, type EvidenceItem } from "@careeros/database";
import { findSameThings, type IdentityInput } from "@careeros/portfolio";

import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";

/**
 * THE ONE GATE EVERY NEW RECORD PASSES THROUGH.
 *
 * Fadi had seven places that create career records — AI extraction from a CV or
 * LinkedIn, the browser extension, a finished learning commitment, the manual form,
 * the portfolio seed, the portfolio sync, the JSON import. Identity resolution was
 * wired into two of them. The other five wrote whatever they were given, so which
 * duplicates Fadi caught depended entirely on which door the data walked through:
 * paste a CV and it resolved, capture the same project with the extension and it
 * didn't. That is not a rule, it's a coincidence.
 *
 * Bolting the check onto five more call sites would recreate the same problem the
 * moment an eighth door is added. So this is a gate, not a helper: `admit` is the
 * only sanctioned way in, and it answers one question — is this new, or is it
 * something you already have wearing different words?
 *
 * IT NEVER DISCARDS. "Absorb" attaches the candidate's exact wording to the fact it
 * restates (fact_id + is_canonical=false), where it stays visible, reusable and one
 * click from being split back out. That asymmetry is the whole argument for being
 * strict: absorbing wrongly costs a click, while creating wrongly puts two copies of
 * one project into the résumé, the portfolio and every document generated from them,
 * discoverable only by a check someone has to remember to run.
 */

/** Marks a link made on a "maybe" rather than a certainty, so the agent can ask. */
export const UNCONFIRMED_LINK = "unconfirmed-auto-link";

/** Two versions of one fact, both written by the user, that disagree. Fadi asks. */
export const NEEDS_DECISION = "needs-your-decision";

export type Candidate = {
  kind: string;
  title: string;
  organization?: string | null;
  period?: string | null;
  detail?: string | null;
  tags?: string[] | null;
  url?: string | null;
  imageUrl?: string | null;
};

/**
 * WHO WROTE THIS VERSION.
 *
 * The deciding input for the two-way route. A description you edited in Word and brought
 * back is your claim, in your words, and should lead. A description Fadi's extractor
 * produced is a convenience, and must never displace words you wrote yourself.
 */
export type Authorship = "human" | "machine";

/** Doors where a person composed the words, vs. where a model did. */
export function authorshipOf(origin: string | null | undefined): Authorship {
  return origin === "ai" || origin === "learning" ? "machine" : "human";
}

export type Admission =
  | { decision: "create" }
  | {
      /**
       * Same fact, and this version should now LEAD.
       *
       * The gate was one-way: anything resolving to an existing fact became a
       * non-canonical rendering, so a CV you sharpened in M365 and re-uploaded was
       * stored and then never shown — the older, worse wording kept leading
       * everywhere. Correct for a duplicate, wrong for an update, and the two are
       * indistinguishable without asking who wrote each version.
       *
       * The previous wording is demoted, not deleted: it stays on the fact and one
       * click puts it back.
       */
      decision: "update";
      intoId: string;
      factId: string;
      sure: boolean;
      reasons: string[];
    }
  | {
      decision: "absorb";
      /** The existing row this restates. */
      intoId: string;
      /** The fact both now belong to. */
      factId: string;
      /** True for a confident match, false for a "maybe" (which gets flagged). */
      sure: boolean;
      reasons: string[];
      /**
       * Both versions were written by a person and they disagree. Fadi must not pick;
       * it keeps what is leading, stores the newcomer, and asks.
       */
      conflict?: boolean;
    };

/** Rows out of the database, back into the one shape the gate speaks. */
function asCandidate(e: {
  kind: string;
  title: string;
  organization: string | null;
  period: string | null;
  detail: string | null;
  tags?: string[] | null;
  marketTags?: string[] | null;
}): Candidate {
  return {
    kind: e.kind,
    title: e.title,
    organization: e.organization,
    period: e.period,
    detail: e.detail,
    tags: [...(e.tags ?? []), ...(e.marketTags ?? [])],
  };
}

/** One place that trims, lowercases and caps — so every door stores the same shape. */
function normalize(c: Candidate & { metrics?: string | null; marketTags?: string[] | null; origin?: string }) {
  return {
    kind: c.kind,
    title: c.title.trim(),
    organization: c.organization?.trim() || null,
    period: c.period?.trim() || null,
    detail: (c.detail ?? "").trim(),
    metrics: c.metrics?.trim() || null,
    tags: (c.tags ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean).slice(0, 8),
    marketTags: (c.marketTags ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean).slice(0, 8),
    origin: c.origin ?? "manual",
  };
}

export function toIdentity(c: Candidate, id: string): IdentityInput {
  return {
    id,
    kind: c.kind,
    title: c.title,
    organization: c.organization ?? null,
    period: c.period ?? null,
    detail: c.detail ?? null,
    url: c.url ?? null,
    imageUrl: c.imageUrl ?? null,
    tags: c.tags ?? [],
  };
}

/**
 * Decide what to do with one candidate against a pool that is already loaded.
 * Pure apart from the pool it is handed — batch callers resolve many against one read.
 */
export function admitAgainst(
  candidate: Candidate & { origin?: string },
  pool: IdentityInput[],
  meta: (id: string) => { factId: string; origin?: string | null; detail?: string | null },
): Admission {
  const me = toIdentity(candidate, "__candidate__");
  const mine = findSameThings([me, ...pool]).filter((m) => m.a === me.id || m.b === me.id);
  const match = mine.find((m) => m.verdict === "same") ?? mine.find((m) => m.verdict === "maybe");
  if (!match) return { decision: "create" };

  const intoId = match.a === me.id ? match.b : match.a;
  const held = meta(intoId);
  const base = {
    intoId,
    factId: held.factId,
    sure: match.verdict === "same",
    reasons: match.reasons,
  };

  const incoming = authorshipOf(candidate.origin);
  const standing = authorshipOf(held.origin);

  // A model-written version never displaces what is leading. Extraction runs on its own
  // schedule and would otherwise quietly rewrite the user's history behind them.
  if (incoming === "machine") return { decision: "absorb", ...base };

  // A person wrote this, and the version it would replace was written by a model —
  // so this is an edit arriving through whichever tool they happened to use.
  if (standing === "machine") return { decision: "update", ...base };

  // Both human. Identical text is not a change worth acting on; different text is a
  // real disagreement between two things the user wrote, and only they can settle it.
  const same = (held.detail ?? "").trim() === (candidate.detail ?? "").trim();
  return { decision: "absorb", ...base, ...(same ? {} : { conflict: true }) };
}

/**
 * Admit a BATCH into the evidence pool — one pool read, one decision per candidate,
 * and each admitted candidate joins the pool the next one is judged against.
 *
 * That last part is not an optimisation. Extraction routinely emits the same reality
 * twice inside a single response (a project described once under Experience and again
 * under Projects); judging every candidate against only the pre-existing pool lets a
 * batch duplicate itself in one pass, which no amount of later checking can undo.
 */
export async function admitEvidenceBatch(
  userId: string,
  candidates: (Candidate & { metrics?: string | null; marketTags?: string[] | null; origin?: string })[],
): Promise<{ created: EvidenceItem[]; absorbed: number; uncertain: number }> {
  const repo = createEvidenceRepository(getDatabase());
  const existing = await repo.listForUser(userId);
  const pool = existing.map((e) => toIdentity(asCandidate(e), e.id));
  const metaOf = new Map<string, { factId: string; origin?: string | null; detail?: string | null }>(
    existing.map((e) => [e.id, { factId: e.factId ?? e.id, origin: e.origin, detail: e.detail }]),
  );

  const fresh: (Candidate & { metrics?: string | null; marketTags?: string[] | null; origin?: string })[] = [];
  const rewordings: {
    candidate: (typeof candidates)[number];
    factId: string;
    sure: boolean;
    /** Set when this version should take the lead from the row with this id. */
    lead: string | null;
  }[] = [];

  for (const cand of candidates) {
    const admission = admitAgainst(cand, pool, (id) => metaOf.get(id) ?? { factId: id });
    if (admission.decision === "create") {
      // Judged against, and joined by, everything admitted before it.
      const id = `batch-${fresh.length}`;
      pool.push(toIdentity(cand, id));
      metaOf.set(id, { factId: id, origin: cand.origin, detail: cand.detail ?? null });
      fresh.push(cand);
    } else {
      rewordings.push({
        candidate: cand,
        factId: admission.factId,
        sure: admission.sure,
        lead: admission.decision === "update" ? admission.intoId : null,
      });
    }
  }

  const created = fresh.length > 0 ? await repo.createMany(userId, fresh.map(normalize)) : [];
  for (const { candidate, factId, sure, lead } of rewordings) {
    // A rewording of something admitted in THIS batch has a placeholder fact id; the
    // real row exists now, so map it across before writing.
    const realFact = factId.startsWith("batch-")
      ? (created[Number(factId.slice(6))]?.id ?? null)
      : factId;
    if (!realFact) continue;
    await repo.create(userId, {
      ...normalize(candidate),
      factId: realFact,
      // An update leads immediately; a rewording is stored without displacing anything.
      isCanonical: lead !== null,
      renderingFor: sure ? null : UNCONFIRMED_LINK,
    });
    // Demote, never delete — the previous wording stays on the fact and one click in
    // the renderings panel puts it back.
    if (lead) await repo.update(userId, lead, { isCanonical: false });
  }

  if (rewordings.length > 0) {
    logger.info("identity.batch_absorbed", {
      userId,
      absorbed: rewordings.length,
      uncertain: rewordings.filter((r) => !r.sure).length,
    });
  }

  return {
    created,
    absorbed: rewordings.length,
    uncertain: rewordings.filter((r) => !r.sure).length,
  };
}

/**
 * Admit one candidate into the evidence pool and persist the outcome.
 *
 * Returns the row that now carries this reality — the existing fact when the candidate
 * was a rewording, the new row when it genuinely was new. Callers that need to link
 * something to it (a learning commitment, a portfolio item) get a usable id either way,
 * which is what stops "we resolved it" turning into "we lost the reference".
 */
export async function admitEvidence(
  userId: string,
  candidate: Candidate & { metrics?: string | null; marketTags?: string[] | null; origin?: string },
): Promise<{ row: EvidenceItem | null; admission: Admission }> {
  const repo = createEvidenceRepository(getDatabase());
  // The canonical pool only: a rewording is not something new work can duplicate.
  const existing = await repo.listForUser(userId);
  const pool = existing.map((e) =>
    toIdentity(
      {
        kind: e.kind,
        title: e.title,
        organization: e.organization,
        period: e.period,
        detail: e.detail,
        tags: [...(e.tags ?? []), ...(e.marketTags ?? [])],
      },
      e.id,
    ),
  );
  const metaOf = new Map<string, { factId: string; origin?: string | null; detail?: string | null }>(
    existing.map((e) => [e.id, { factId: e.factId ?? e.id, origin: e.origin, detail: e.detail }]),
  );
  const admission = admitAgainst(candidate, pool, (id) => metaOf.get(id) ?? { factId: id });

  const fields = normalize(candidate);

  if (admission.decision === "create") {
    return { row: await repo.create(userId, fields), admission };
  }

  // Keep the wording, attached to the fact it restates. Nothing is thrown away.
  const takesLead = admission.decision === "update";
  await repo.create(userId, {
    ...fields,
    factId: admission.factId,
    isCanonical: takesLead,
    renderingFor: admission.decision === "absorb" && admission.conflict
      ? NEEDS_DECISION
      : admission.sure
        ? null
        : UNCONFIRMED_LINK,
  });
  if (takesLead) await repo.update(userId, admission.intoId, { isCanonical: false });
  logger.info("identity.absorbed", {
    userId,
    decision: admission.decision,
    sure: admission.sure,
    kind: candidate.kind,
  });
  return { row: existing.find((e) => e.id === admission.intoId) ?? null, admission };
}
