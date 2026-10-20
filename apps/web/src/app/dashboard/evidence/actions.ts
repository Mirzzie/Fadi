"use server";

import {
  createCareerProfilesRepository,
  createEvidenceArtifactsRepository,
  createEvidenceRepository,
  createResumesRepository,
} from "@careeros/database";
import { revalidatePath } from "next/cache";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { preserveThenReplace } from "@/lib/career/sources";
import { logger } from "@/lib/observability/logger";
import { publish } from "@/lib/events/bus";
import { extractEvidencePool, normKind, toEvidenceView, type EvidenceView } from "@/lib/evidence/pool";

const PATH = "/dashboard/evidence";

/**
 * Save career history pasted/uploaded directly on the Evidence screen.
 *
 * Exists so a user with nothing on file can capture their history WHERE THEY ARE
 * instead of being sent to Profile and told to come back. Building the pool needs a
 * résumé or LinkedIn record; that was the one genuine navigation deflection in the
 * capture flow, and this removes it. Deliberately narrow: it writes only the résumé,
 * using the same repository call the profile form already uses — it is not a second
 * way to edit the profile.
 */
export async function saveResumeTextAction(
  text: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const resumeText = text.trim();
  if (resumeText.length < 20) {
    return { ok: false, message: "That's too short to work from — paste your CV or a summary of your experience." };
  }

  const db = getDatabase();
  const activeTrack = await createCareerProfilesRepository(db).getActiveForUser(user.id);
  // KEEP WHAT ARRIVED. The résumé row is overwritten per direction, so the previous text used to
  // vanish — and with it any chance of telling a later import's new work from its rewording.
  // Identical text reuses its version, so re-saving does not manufacture history.
  try {
    await preserveThenReplace(
      user.id,
      { sourceKind: "resume", sourceKey: activeTrack?.id ?? "no-direction", content: resumeText },
      (tx) =>
        createResumesRepository(tx).upsertLatestForTrack(user.id, activeTrack?.id ?? null, resumeText)
    );
  } catch (error) {
    logger.error("evidence.resume_save_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return {
      ok: false,
      message: "Couldn't save that — your previous CV text is untouched. Try again.",
    };
  }
  revalidatePath(PATH);
  return { ok: true };
}

export async function buildEvidencePool(): Promise<
  { ok: true; items: EvidenceView[]; pendingReview: number } | { ok: false; message: string }
> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const res = await extractEvidencePool(user.id);
  if (!res.ok) return { ok: false, message: res.message };
  await publish("evidence.changed", { userId: user.id, reason: "extracted" });
  revalidatePath(PATH);
  return { ok: true, items: res.items, pendingReview: res.pendingReview };
}

export async function saveEvidence(input: {
  id?: string;
  kind: string;
  title: string;
  organization?: string;
  period?: string;
  detail?: string;
  metrics?: string;
  tags: string[];
  artifactUrls?: string[];
}): Promise<{ ok: true; item: EvidenceView } | { ok: false; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!input.title.trim()) return { ok: false, message: "Give it a title." };

  const repo = createEvidenceRepository(getDatabase());
  const fields = {
    kind: normKind(input.kind),
    title: input.title.trim(),
    organization: input.organization?.trim() || null,
    period: input.period?.trim() || null,
    detail: (input.detail ?? "").trim(),
    metrics: input.metrics?.trim() || null,
    tags: input.tags.map((t) => t.toLowerCase().trim()).filter(Boolean).slice(0, 8),
  };
  // Editing an existing row is not an admission — it is that row. Only a NEW record
  // has to answer "do you already have this?", and typing it by hand is no exemption:
  // the commonest way to create a duplicate is not remembering you already added it.
  const { admitEvidence } = await import("@/lib/identity/admit");
  const row = input.id
    ? await repo.update(user.id, input.id, fields)
    : (await admitEvidence(user.id, { ...fields, origin: "manual" })).row;
  if (!row) return { ok: false, message: "I can't find that item." };

  const artifactUrls = [...new Set((input.artifactUrls ?? [])
    .map((url) => url.trim())
    .filter((url) => /^https?:\/\//i.test(url))
  )].slice(0, 20);
  if (artifactUrls.length > 0 && row.isCanonical && row.reviewStatus === "accepted") {
    await createEvidenceArtifactsRepository(getDatabase()).addForFact(
      user.id,
      row.factId ?? row.id,
      artifactUrls.map((url, index) => ({
        kind: /(\.mp4|\.webm|\.mov)(\?|$)|\/video\/upload\//i.test(url)
          ? "video"
          : /(\.png|\.jpe?g|\.gif|\.webp|\.svg)(\?|$)|\/image\/upload\//i.test(url)
            ? "image"
            : "link",
        url,
        label: "Media",
        sortOrder: index,
        sourcePortfolioItemId: null,
      }))
    );
  }
  await publish("evidence.changed", {
    userId: user.id,
    reason: input.id ? "updated" : "created",
    evidenceItemId: row.id,
  });
  revalidatePath(PATH);
  return { ok: true, item: toEvidenceView(row) };
}

export async function removeEvidenceArtifact(input: {
  id: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const removed = await createEvidenceArtifactsRepository(getDatabase()).remove(user.id, input.id);
  if (!removed) return { ok: false, message: "That media item is unavailable." };
  await publish("evidence.changed", { userId: user.id, reason: "updated" });
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteEvidence(input: { id: string }): Promise<{ ok: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };
  await createEvidenceRepository(getDatabase()).delete(user.id, input.id);
  await publish("evidence.changed", {
    userId: user.id,
    reason: "deleted",
    evidenceItemId: input.id,
  });
  revalidatePath(PATH);
  return { ok: true };
}

export type SameThingPair = {
  keepId: string;
  keepTitle: string;
  mergeId: string;
  mergeTitle: string;
  confident: boolean;
  reasons: string[];
  keepContext?: string;
  mergeContext?: string;
  keepDetail?: string;
  mergeDetail?: string;
  pendingReview?: boolean;
  canMerge?: boolean;
};

/**
 * Records in the pool that look like the SAME REAL THING written differently.
 *
 * The pool is the source every other surface projects from, so a duplicate here
 * becomes a duplicate in the résumé, the portfolio and the AI's prompt at once. This
 * is where it has to be caught.
 */
export async function findSameEvidence(): Promise<{ ok: boolean; pairs: SameThingPair[] }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, pairs: [] };

  const repo = createEvidenceRepository(getDatabase());
  const all = await repo.listAllForUser(user.id);
  const items = all.filter(i => i.isCanonical && i.reviewStatus === "accepted");
  const { findSameThings } = await import("@/lib/identity/resolve");

  const byId = new Map(items.map((i) => [i.id, i]));
  const inputs = items.map((i) => ({
    id: i.id,
    kind: i.kind,
    title: i.title,
    organization: i.organization,
    attribution: i.attribution,
    metrics: i.metrics,
    period: i.period,
    detail: i.detail,
    tags: i.tags ?? [],
  }));

  // MEANING, for the case the anchors cannot see: two records that share no proper
  // noun, no organisation and no date, and are still the same work described in
  // different vocabulary. Best-effort — `embedTexts` returns nulls when no provider is
  // configured, and the lexical anchors carry the result on their own in that case.
  let similarity: ((a: string, b: string) => number | undefined) | undefined;
  try {
    const { embedTexts, cosine } = await import("@/lib/ai/embeddings");
    const vectors = await embedTexts(
      inputs.map((i) => [i.title, i.organization, i.detail, ...(i.tags ?? [])].filter(Boolean).join(" ")),
    );
    const byIdVec = new Map<string, number[]>();
    vectors.forEach((v, idx) => {
      if (v) byIdVec.set(inputs[idx].id, v);
    });
    if (byIdVec.size > 1) {
      similarity = (a, b) => {
        const va = byIdVec.get(a);
        const vb = byIdVec.get(b);
        return va && vb ? cosine(va, vb) : undefined;
      };
    }
  } catch {
    // No embeddings provider — the deterministic signals still stand on their own.
  }

  const matches = findSameThings(inputs, similarity).filter(m => {
    const a = byId.get(m.a)!;
    const b = byId.get(m.b)!;
    return !(a.distinctFrom ?? []).includes(b.factId ?? b.id) &&
      !(b.distinctFrom ?? []).includes(a.factId ?? a.id);
  });

  const pairs = matches.map((m) => {
    const a = byId.get(m.a);
    const b = byId.get(m.b);
    // Keep the fuller record: it is the one a reader gets more from, and the other
    // survives as its alternative wording anyway.
    const weight = (x?: typeof a) =>
      (x?.detail?.length ?? 0) + (x?.metrics ? 50 : 0) + (x?.marketTags?.length ?? 0) * 10;
    const [keep, merge] = weight(a) >= weight(b) ? [a, b] : [b, a];
    return {
      keepId: keep!.id,
      keepTitle: keep!.title,
      mergeId: merge!.id,
      mergeTitle: merge!.title,
      confident: m.verdict === "same",
      reasons: m.reasons,
      keepContext: [keep!.kind, keep!.organization, keep!.period].filter(Boolean).join(" · "),
      mergeContext: [merge!.kind, merge!.organization, merge!.period].filter(Boolean).join(" · "),
      keepDetail: keep!.detail,
      mergeDetail: merge!.detail,
    };
  });

  const reviews: SameThingPair[] = all.filter(i => i.reviewStatus === "pending").map(candidate => {
    const previous = all.find(i => i.id === candidate.reviewTargetId);
    const target = items.find(i => (i.factId ?? i.id) === (previous?.factId ?? previous?.id));
    return {
      keepId: target?.id ?? candidate.id, keepTitle: target?.title ?? "Previous record unavailable",
      mergeId: candidate.id, mergeTitle: candidate.title, confident: false,
      reasons: candidate.reviewReasons ?? [], pendingReview: true, canMerge: Boolean(target),
      keepContext: target ? [target.kind, target.organization, target.period].filter(Boolean).join(" · ") : "",
      mergeContext: [candidate.kind, candidate.organization, candidate.period].filter(Boolean).join(" · "),
      keepDetail: target?.detail ?? "", mergeDetail: candidate.detail,
    };
  });
  return { ok: true, pairs: [...reviews, ...pairs] };
}

/**
 * Fold one record into another as the same fact.
 *
 * NOT a delete: the absorbed record keeps its wording and becomes an alternative
 * phrasing of the surviving fact. Nothing the user wrote is ever thrown away — the
 * tailored version is the useful part, it just stops counting as a separate reality.
 */
export async function mergeEvidence(input: {
  keepId: string;
  mergeId: string;
}): Promise<{ ok: boolean; message?: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };
  try {
    const selections = await createEvidenceRepository(getDatabase()).mergeInto(
      user.id,
      input.keepId,
      input.mergeId
    );
    await publish("evidence.changed", { userId: user.id, reason: "updated", evidenceItemId: input.keepId });
    revalidatePath("/dashboard/evidence");
    // SAY IT IF A DECISION WAS UNDONE. The two records had different Include/Exclude choices, so
    // neither is a decision about the one record that now exists — it is back to Auto, and the
    // person needs to know rather than discovering it in a document later.
    return {
      ok: true,
      message:
        selections.cleared.length > 0
          ? "Joined. They had different include/exclude choices, so that record is back to Auto — choose again when you need to."
          : undefined,
    };
  } catch {
    return { ok: false };
  }
}

/** Persist an explicit distinct-work decision, accepting a pending candidate separately. */
export async function keepEvidenceSeparate(input: { id: string; otherId: string }): Promise<{ ok: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };
  try {
    await createEvidenceRepository(getDatabase()).keepSeparate(user.id, input.id, input.otherId);
    await publish("evidence.changed", { userId: user.id, reason: "updated", evidenceItemId: input.id });
    revalidatePath(PATH);
    return { ok: true };
  } catch { return { ok: false }; }
}

/** A pending import is removable without exposing accepted records to a stale action. */
export async function discardPendingEvidence(input: { id: string }): Promise<{ ok: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };
  const ok = await createEvidenceRepository(getDatabase()).discardPending(user.id, input.id);
  revalidatePath(PATH);
  return { ok };
}

/** Undo: the record becomes its own fact again. */
export async function unmergeEvidence(input: { id: string }): Promise<{ ok: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };
  await createEvidenceRepository(getDatabase()).splitOut(user.id, input.id);
  revalidatePath("/dashboard/evidence");
  return { ok: true };
}

export type FactRendering = {
  id: string;
  title: string;
  detail: string;
  renderingFor: string | null;
  isCanonical: boolean;
};

/**
 * Every wording of one fact — the canonical record plus the variants written for
 * particular audiences.
 *
 * This is the payoff of separating fact from rendering. A phrase written for a SOC
 * application is not noise to be de-duplicated away; it is the right words for that
 * audience, and it should be offered back the next time a similar application comes
 * round. Merging stopped the duplication; this makes the duplicates useful.
 */
export async function listFactRenderings(input: {
  id: string;
}): Promise<{ ok: boolean; renderings: FactRendering[] }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, renderings: [] };

  const repo = createEvidenceRepository(getDatabase());
  const item = await repo.getForUser(user.id, input.id);
  if (!item) return { ok: false, renderings: [] };

  const fact = item.factId ?? item.id;
  const all = await repo.listAllForUser(user.id);
  return {
    ok: true,
    renderings: all
      .filter((r) => (r.factId ?? r.id) === fact)
      .map((r) => ({
        id: r.id,
        title: r.title,
        detail: r.detail,
        renderingFor: r.renderingFor,
        isCanonical: r.isCanonical,
      }))
      .sort((a, b) => Number(b.isCanonical) - Number(a.isCanonical)),
  };
}

/**
 * Label a wording with the audience it was written for ("SOC analyst roles").
 *
 * Without this a rendering is just archived text; with it, Fadi can offer the right
 * phrasing back when a similar application comes round — which is what the user
 * actually wanted when they tailored it in the first place.
 */
export async function labelRendering(input: {
  id: string;
  renderingFor: string | null;
}): Promise<{ ok: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };
  await createEvidenceRepository(getDatabase()).update(user.id, input.id, {
    renderingFor: input.renderingFor?.trim() || null,
  });
  revalidatePath("/dashboard/evidence");
  return { ok: true };
}

/**
 * Promote a rendering to be the canonical wording of its fact.
 *
 * The truth did not change — only which phrasing leads. Reversible, and the previous
 * canonical stays as a rendering, so switching back costs nothing.
 */
export async function promoteRendering(input: { id: string }): Promise<{ ok: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };

  const repo = createEvidenceRepository(getDatabase());
  const item = await repo.getForUser(user.id, input.id);
  if (!item || item.reviewStatus !== "accepted") return { ok: false };
  const leader = await repo.getCanonicalForFact(user.id, item.factId ?? item.id);
  if (!leader) return { ok: false };
  // A wording switch cannot silently switch employer, dates or claimed results.
  const norm = (v: string | null) => (v ?? "").trim().toLowerCase();
  if (["organization", "period", "metrics", "attribution"].some(key =>
    norm(item[key as "organization"]) !== norm(leader[key as "organization"])
  )) return { ok: false };
  await repo.mergeInto(user.id, item.id, leader.id);
  revalidatePath("/dashboard/evidence");
  return { ok: true };
}
