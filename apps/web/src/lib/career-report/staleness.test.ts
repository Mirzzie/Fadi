import { describe, expect, it } from "vitest";

import { reportStaleness } from "./staleness";

const T0 = "2026-07-01T00:00:00.000Z";
const LATER = "2026-07-10T00:00:00.000Z";
const EARLIER = "2026-06-20T00:00:00.000Z";

describe("reportStaleness", () => {
  it("no report yet is never stale (empty state, not drift)", () => {
    expect(reportStaleness({ reportGeneratedAt: null, latestEvidenceAt: LATER })).toEqual({
      stale: false,
      reason: null,
    });
  });

  it("is stale when evidence changed AFTER the report", () => {
    const r = reportStaleness({ reportGeneratedAt: T0, latestEvidenceAt: LATER });
    expect(r.stale).toBe(true);
    expect(r.reason).toMatch(/evidence/i);
  });

  it("is fresh when evidence changed BEFORE the report", () => {
    expect(reportStaleness({ reportGeneratedAt: T0, latestEvidenceAt: EARLIER })).toEqual({
      stale: false,
      reason: null,
    });
  });

  it("also detects a newer résumé or LinkedIn record", () => {
    expect(reportStaleness({ reportGeneratedAt: T0, latestResumeAt: LATER }).reason).toMatch(/résumé/i);
    expect(reportStaleness({ reportGeneratedAt: T0, latestLinkedInAt: LATER }).reason).toMatch(/linkedin/i);
  });

  it("evidence drift takes precedence in the message", () => {
    const r = reportStaleness({ reportGeneratedAt: T0, latestEvidenceAt: LATER, latestResumeAt: LATER });
    expect(r.reason).toMatch(/evidence/i);
  });

  it("ignores missing / malformed timestamps rather than crying stale", () => {
    expect(reportStaleness({ reportGeneratedAt: T0 }).stale).toBe(false);
    expect(reportStaleness({ reportGeneratedAt: T0, latestEvidenceAt: "not-a-date" }).stale).toBe(false);
  });

  it("a change exactly at generation time is not stale (strictly after)", () => {
    expect(reportStaleness({ reportGeneratedAt: T0, latestEvidenceAt: T0 }).stale).toBe(false);
  });
});
