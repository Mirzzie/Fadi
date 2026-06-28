import { describe, expect, it } from "vitest";

import { cosine, fuseScore } from "./embeddings";

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
});
