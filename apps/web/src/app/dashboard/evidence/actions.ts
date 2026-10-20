"use server";

import {
  createCareerProfilesRepository,
  createEvidenceRepository,
  createResumesRepository,
} from "@careeros/database";
import { revalidatePath } from "next/cache";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
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
  await createResumesRepository(db).upsertLatestForTrack(user.id, activeTrack?.id ?? null, resumeText);
  revalidatePath(PATH);
  return { ok: true };
}

export async function buildEvidencePool(): Promise<
  { ok: true; items: EvidenceView[] } | { ok: false; message: string }
> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const res = await extractEvidencePool(user.id);
  if (!res.ok) return { ok: false, message: res.message };
  await publish("evidence.changed", { userId: user.id, reason: "extracted" });
  revalidatePath(PATH);
  return { ok: true, items: res.items };
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
  await publish("evidence.changed", {
    userId: user.id,
    reason: input.id ? "updated" : "created",
    evidenceItemId: row.id,
  });
  revalidatePath(PATH);
  return { ok: true, item: toEvidenceView(row) };
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
  const items = await repo.listForUser(user.id);
  const { findSameThings } = await import("@/lib/identity/resolve");

  const byId = new Map(items.map((i) => [i.id, i]));
  const inputs = items.map((i) => ({
    id: i.id,
    kind: i.kind,
    title: i.title,
    organization: i.organization,
    period: i.period,
    detail: i.detail,
    tags: [...(i.tags ?? []), ...(i.marketTags ?? [])],
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

  const matches = findSameThings(inputs, similarity);

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
    };
  });

  return { ok: true, pairs };
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
}): Promise<{ ok: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };
  await createEvidenceRepository(getDatabase()).mergeInto(user.id, input.keepId, input.mergeId);
  revalidatePath("/dashboard/evidence");
  return { ok: true };
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
  if (!item) return { ok: false };

  const fact = item.factId ?? item.id;
  const all = await repo.listAllForUser(user.id);
  for (const row of all.filter((r) => (r.factId ?? r.id) === fact)) {
    const shouldBeCanonical = row.id === input.id;
    if (row.isCanonical !== shouldBeCanonical) {
      await repo.update(user.id, row.id, { isCanonical: shouldBeCanonical, factId: fact });
    }
  }
  revalidatePath("/dashboard/evidence");
  return { ok: true };
}
