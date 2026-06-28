import { describe, expect, it, vi } from "vitest";

import { EMBEDDING_MODEL } from "@/lib/ai/embeddings";
import {
  basisHash,
  isSemanticRescue,
  resolveTrackEmbedding,
  trackEmbeddingBasis,
  type TrackLike,
} from "./semantic";

const track: TrackLike = {
  targetRole: "SOC Analyst",
  careerGoal: "grow",
  domain: "Cybersecurity",
  roleSynonyms: ["security analyst", "cyber security analyst"],
  roleCluster: null,
};

describe("basis", () => {
  it("builds a stable text and hash that changes when the track changes", () => {
    const a = basisHash(trackEmbeddingBasis(track));
    const b = basisHash(trackEmbeddingBasis({ ...track, targetRole: "Network Engineer" }));
    expect(a).toBe(basisHash(trackEmbeddingBasis(track))); // stable
    expect(a).not.toBe(b); // sensitive to change
  });
});

describe("resolveTrackEmbedding", () => {
  it("returns the cached vector without embedding when fresh", async () => {
    const basis = basisHash(trackEmbeddingBasis(track));
    const cached = { ...track, embedding: [0.1, 0.2], embeddingModel: EMBEDDING_MODEL, embeddingBasis: basis };
    const embed = vi.fn(async () => [9, 9]);
    const persist = vi.fn(async () => {});
    const vec = await resolveTrackEmbedding(cached, { embed, persist });
    expect(vec).toEqual([0.1, 0.2]);
    expect(embed).not.toHaveBeenCalled();
  });

  it("re-embeds and persists when the basis changed", async () => {
    const stale = { ...track, embedding: [0.1], embeddingModel: EMBEDDING_MODEL, embeddingBasis: "OLD" };
    const embed = vi.fn(async () => [0.5, 0.5]);
    const persist = vi.fn(async () => {});
    const vec = await resolveTrackEmbedding(stale, { embed, persist });
    expect(vec).toEqual([0.5, 0.5]);
    expect(persist).toHaveBeenCalledOnce();
  });

  it("falls back to the stored vector when embedding fails, and null for no track", async () => {
    const stale = { ...track, embedding: [0.9], embeddingModel: "old-model", embeddingBasis: "x" };
    const embed = vi.fn(async () => null);
    const vec = await resolveTrackEmbedding(stale, { embed, persist: vi.fn(async () => {}) });
    expect(vec).toEqual([0.9]);
    expect(await resolveTrackEmbedding(null, { embed, persist: vi.fn(async () => {}) })).toBeNull();
  });
});

describe("isSemanticRescue", () => {
  const ok = { onRole: false, fieldRelated: false, overLevel: false, differentFunction: false };
  it("rescues a close-by-meaning, in-level, right-function job", () => {
    expect(isSemanticRescue(0.6, ok)).toBe(true);
  });
  it("never rescues below threshold, or when a gate says no", () => {
    expect(isSemanticRescue(0.2, ok)).toBe(false);
    expect(isSemanticRescue(null, ok)).toBe(false);
    expect(isSemanticRescue(0.9, { ...ok, overLevel: true })).toBe(false);
    expect(isSemanticRescue(0.9, { ...ok, differentFunction: true })).toBe(false);
    expect(isSemanticRescue(0.9, { ...ok, onRole: true })).toBe(false);
  });
});
