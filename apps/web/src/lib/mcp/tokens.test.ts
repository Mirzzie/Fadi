import { describe, expect, it } from "vitest";

import { envTokenMatches, generateRawToken, hashToken, tokenPrefix } from "./tokens";

describe("generateRawToken", () => {
  it("is prefixed, long, and unique per call", () => {
    const a = generateRawToken();
    const b = generateRawToken();
    expect(a.startsWith("fos_")).toBe(true);
    expect(a.length).toBeGreaterThan(20);
    expect(a).not.toBe(b);
  });
});

describe("hashToken", () => {
  it("is deterministic, 64 hex chars, and differs per input", () => {
    const h = hashToken("fos_abc");
    expect(h).toBe(hashToken("fos_abc"));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toBe(hashToken("fos_abd"));
  });

  it("never stores or returns the raw token", () => {
    expect(hashToken("fos_secret")).not.toContain("secret");
  });
});

describe("tokenPrefix", () => {
  it("exposes only a short, safe prefix", () => {
    const raw = generateRawToken();
    expect(tokenPrefix(raw)).toBe(raw.slice(0, 12));
    expect(tokenPrefix(raw).length).toBe(12);
  });
});

describe("envTokenMatches", () => {
  it("matches an exact token and rejects everything else", () => {
    expect(envTokenMatches("secret-token", "secret-token")).toBe(true);
    expect(envTokenMatches("secret-token", "secret-toketX")).toBe(false);
    expect(envTokenMatches("short", "longer-secret")).toBe(false); // length mismatch
    expect(envTokenMatches("anything", undefined)).toBe(false); // not configured
    expect(envTokenMatches("", "secret")).toBe(false);
  });
});
