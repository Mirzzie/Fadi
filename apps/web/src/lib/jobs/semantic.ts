import { EMBEDDING_MODEL, cosine, fuseScore } from "@/lib/ai/embeddings";

/**
 * Semantic layer for hybrid job search — pure helpers + a null-safe track-vector
 * resolver. The orchestration (embedding candidates, fusing, the rescue tier)
 * lives in data.ts; this module keeps the testable logic isolated.
 */

export { cosine, fuseScore };

/** Cosine at/above which a non-lexical-match job earns a labelled "semantic" slot. */
export const SEMANTIC_RESCUE_COS = 0.42;

export interface TrackLike {
  embedding?: number[] | null;
  embeddingModel?: string | null;
  embeddingBasis?: string | null;
  targetRole?: string | null;
  careerGoal?: string | null;
  domain?: string | null;
  roleSynonyms?: string[] | null;
  roleCluster?: string[] | null;
}

/** The text whose meaning represents this track (what we embed). */
export function trackEmbeddingBasis(p: TrackLike): string {
  return [
    p.targetRole ?? "",
    p.careerGoal ?? "",
    p.domain ?? "",
    ...(p.roleCluster ?? []),
    ...(p.roleSynonyms ?? []),
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" | ")
    .toLowerCase();
}

/** Stable djb2 hash — detects when the track's embedded text actually changed. */
export function basisHash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** The text we embed for a job — title + company + a JD snippet. */
export function jobEmbeddingText(job: {
  title: string;
  company: string;
  description?: string | null;
}): string {
  return [job.title, job.company, (job.description ?? "").slice(0, 1200)]
    .filter(Boolean)
    .join("\n");
}

/** The track's vector ONLY if it's already cached and still fresh — no network.
 *  Lets the hot render path rank with what's available and defer embedding. */
export function freshTrackVector(track: TrackLike | null | undefined): number[] | null {
  if (!track?.embedding || track.embedding.length === 0) return null;
  if (track.embeddingModel !== EMBEDDING_MODEL) return null;
  if (track.embeddingBasis !== basisHash(trackEmbeddingBasis(track))) return null;
  return track.embedding;
}

export interface TrackEmbeddingDeps {
  embed: (text: string) => Promise<number[] | null>;
  persist: (vec: number[], basis: string) => Promise<void>;
}

/**
 * Return this track's vector — the cached one when it's still fresh (same model +
 * same basis text), otherwise embed and persist. Null-safe: a failed/absent embed
 * falls back to any stored vector, then to null (→ caller stays lexical-only).
 */
export async function resolveTrackEmbedding(
  track: TrackLike | null | undefined,
  deps: TrackEmbeddingDeps,
): Promise<number[] | null> {
  if (!track) return null;
  const basisText = trackEmbeddingBasis(track);
  if (!basisText) return null;
  const basis = basisHash(basisText);

  const fresh =
    track.embedding != null &&
    track.embeddingModel === EMBEDDING_MODEL &&
    track.embeddingBasis === basis;
  if (fresh) return track.embedding ?? null;

  const vec = await deps.embed(basisText);
  if (!vec) return track.embedding ?? null;
  try {
    await deps.persist(vec, basis);
  } catch {
    // best-effort — ranking still uses the fresh vector this request
  }
  return vec;
}

/** Whether a non-lexical-match job qualifies for the semantic-rescue tier. Pure. */
export function isSemanticRescue(
  cos: number | null,
  flags: { onRole: boolean; fieldRelated: boolean; overLevel: boolean; differentFunction: boolean },
  threshold = SEMANTIC_RESCUE_COS,
): boolean {
  if (cos == null) return false;
  if (flags.onRole || flags.fieldRelated || flags.overLevel || flags.differentFunction) return false;
  return cos >= threshold;
}
