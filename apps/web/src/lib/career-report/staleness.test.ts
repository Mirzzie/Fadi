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

describe("D08 — removal is a change, and a timestamp cannot say so", () => {
  const GENERATED = "2026-09-01T00:00:00Z";

  it("THE BUG: deleting every piece of evidence made the report read fresh", () => {
    // latestUpdatedAt returns null with no rows, and `changedAfter(null)` is false — so
    // the report described a pool that no longer existed and called itself current.
    const s = reportStaleness({
      reportGeneratedAt: GENERATED,
      latestEvidenceAt: null,
      evidenceCount: 0,
      evidenceCountAtGeneration: 12,
    });

    expect(s.stale).toBe(true);
    expect(s.reason).toMatch(/none remain/);
  });

  it("catches partial deletion, where the newest survivor is OLDER than the report", () => {
    // The subtle half: deleting some evidence moves the maximum timestamp backwards, so
    // a newest-timestamp comparison sees nothing at all.
    const s = reportStaleness({
      reportGeneratedAt: GENERATED,
      latestEvidenceAt: "2026-08-01T00:00:00Z",
      evidenceCount: 5,
      evidenceCountAtGeneration: 12,
    });

    expect(s.stale).toBe(true);
    expect(s.reason).toMatch(/only 5 remain/);
  });

  it("catches additions even when their timestamps are somehow not newer", () => {
    const s = reportStaleness({
      reportGeneratedAt: GENERATED,
      latestEvidenceAt: "2026-08-01T00:00:00Z",
      evidenceCount: 14,
      evidenceCountAtGeneration: 12,
    });

    expect(s.stale).toBe(true);
    expect(s.reason).toMatch(/12 → 14/);
  });

  it("does not mark every OLD report stale just because no count was recorded", () => {
    // Reports written before the column existed have null. Treating null as a mismatch
    // would flag every historical report and train the user to ignore the banner.
    const s = reportStaleness({
      reportGeneratedAt: GENERATED,
      latestEvidenceAt: "2026-08-01T00:00:00Z",
      evidenceCount: 5,
      evidenceCountAtGeneration: null,
    });

    expect(s.stale).toBe(false);
  });

  it("stays fresh when the count is unchanged and nothing is newer", () => {
    const s = reportStaleness({
      reportGeneratedAt: GENERATED,
      latestEvidenceAt: "2026-08-01T00:00:00Z",
      evidenceCount: 12,
      evidenceCountAtGeneration: 12,
    });

    expect(s.stale).toBe(false);
  });
});
