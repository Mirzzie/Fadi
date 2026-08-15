import { describe, expect, it } from "vitest";

import { stableHash } from "./stable-id";

describe("stableHash", () => {
  it("is deterministic across calls for the same job identity", () => {
    const a = stableHash("Field Security Engineer", "Atlan", "Ireland");
    const b = stableHash("Field Security Engineer", "Atlan", "Ireland");
    expect(a).toBe(b);
  });

  it("ignores case and surrounding whitespace so re-crawls collapse", () => {
    expect(stableHash("Field Security Engineer", "Atlan", "Ireland")).toBe(
      stableHash("  field security engineer ", "ATLAN", " ireland  ")
    );
  });

  it("distinguishes genuinely different jobs", () => {
    expect(stableHash("Field Security Engineer", "Atlan", "Ireland")).not.toBe(
      stableHash("Systems Administrator", "Atlan", "Ireland")
    );
  });

  it("is a fixed 128-bit (32 hex char) digest regardless of input length", () => {
    const h = stableHash("A very long title ".repeat(50), "Company", "City");
    expect(h).toMatch(/^[0-9a-f]{32}$/);
  });
});
