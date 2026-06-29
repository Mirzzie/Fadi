import { describe, expect, it } from "vitest";

import { cosine, fuseScore, meanVector } from "./embeddings";

describe("meanVector", () => {
  it("averages component-wise and ignores empty vectors", () => {
    expect(meanVector([[1, 2], [3, 4]])).toEqual([2, 3]);
    expect(meanVector([[2, 2], []])).toEqual([2, 2]);
  });
  it("is null with nothing to average", () => {
    expect(meanVector([])).toBeNull();
    expect(meanVector([[]])).toBeNull();
  });
});

describe("cosine", () => {
  it("is 1 for identical, 0 for orthogonal, -1 for opposite", () => {
    expect(cosine([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([1, 2], [-1, -2])).toBeCloseTo(-1);
  });
  it("is 0 for empty or zero vectors", () => {
    expect(cosine([], [])).toBe(0);
    expect(cosine([0, 0], [1, 1])).toBe(0);
  });
});

describe("fuseScore", () => {
  it("passes the lexical score through unchanged when there is no vector", () => {
    expect(fuseScore(72, null)).toBe(72);
    expect(fuseScore(72.4, null)).toBe(72);
  });
  it("blends lexical and semantic into 0–100", () => {
    // lex 100, cos 1 → both maxed → 100
    expect(fuseScore(100, 1)).toBe(100);
    // lex 0, cos -1 → both min → 0
    expect(fuseScore(0, -1)).toBe(0);
    // a strong semantic match lifts a weak lexical score
    expect(fuseScore(20, 0.8)).toBeGreaterThan(20);
  });

  it("adds a preference (taste) signal as a third input", () => {
    // all three maxed → 100; all min → 0
    expect(fuseScore(100, 1, 1)).toBe(100);
    expect(fuseScore(0, -1, -1)).toBe(0);
    // a strong taste match nudges a job up vs. the same job with a poor taste match
    expect(fuseScore(50, 0.2, 0.9)).toBeGreaterThan(fuseScore(50, 0.2, -0.9));
    // taste-only (no role vector) still blends
    expect(fuseScore(40, null, 0.9)).toBeGreaterThan(40);
    // backward compatible: two-arg call unchanged
    expect(fuseScore(72, null)).toBe(72);
  });
});
