import { describe, expect, it } from "vitest";

import {
  evidenceRelevance,
  formatTopEvidence,
  normKind,
  rankEvidenceForTrack,
  type EvidenceView,
} from "./pool";

const item = (over: Partial<EvidenceView>): EvidenceView => ({
  id: Math.random().toString(36).slice(2),
  kind: "experience",
  title: "Untitled",
  organization: null,
  period: null,
  detail: "",
  metrics: null,
  tags: [],
  origin: "manual",
  ...over,
});

const nursing = item({
  title: "Staff Nurse",
  organization: "St. Mary's Hospital",
  detail: "Ran a 30-bed ward, led patient care and triage.",
  tags: ["patient care", "triage", "clinical"],
});
const coding = item({
  title: "Built a scheduling app",
  detail: "Wrote a Python and React app to manage rota shifts.",
  tags: ["python", "react", "software"],
});

describe("normKind", () => {
  it("normalizes to a known kind, defaulting to experience", () => {
    expect(normKind("project")).toBe("project");
    expect(normKind("WEIRD")).toBe("experience");
  });
});

describe("evidenceRelevance — the same item is weighted differently per track", () => {
  it("nursing evidence scores high for a nursing track, ~0 for software", () => {
    const forNurse = evidenceRelevance(nursing, { role: "Registered Nurse", domain: "Healthcare", synonyms: ["staff nurse", "clinical nurse"] });
    const forDev = evidenceRelevance(nursing, { role: "Software Engineer", domain: "Technology", synonyms: ["developer"] });
    expect(forNurse.score).toBeGreaterThan(forDev.score);
    expect(forNurse.matched).toEqual(expect.arrayContaining(["nurse"]));
    expect(forDev.score).toBe(0); // nothing in the nursing item overlaps a software track
  });

  it("the coding project scores high for software, low for nursing", () => {
    const forDev = evidenceRelevance(coding, { role: "Software Engineer", domain: "Technology" });
    const forNurse = evidenceRelevance(coding, { role: "Registered Nurse", domain: "Healthcare" });
    expect(forDev.score).toBeGreaterThan(forNurse.score);
    expect(forDev.matched).toEqual(expect.arrayContaining(["software"]));
  });

  it("scores 0 when the track has no terms", () => {
    expect(evidenceRelevance(nursing, { role: "" }).score).toBe(0);
  });
});

describe("formatTopEvidence — the pool→prompt bridge", () => {
  it("returns an empty string when nothing is relevant (so callers can append unconditionally)", () => {
    const ranked = rankEvidenceForTrack([nursing], { role: "Software Engineer", domain: "Tech" });
    expect(formatTopEvidence(ranked)).toBe("");
  });

  it("formats only the relevant items, leading with a clear instruction and no fabrication", () => {
    const ranked = rankEvidenceForTrack([nursing, coding], { role: "Registered Nurse", domain: "Healthcare", synonyms: ["staff nurse"] });
    const block = formatTopEvidence(ranked);
    expect(block).toMatch(/MOST RELEVANT EVIDENCE/);
    expect(block).toMatch(/never invent/i);
    expect(block).toContain("Staff Nurse");
    expect(block).not.toContain("scheduling app"); // the coding item scored 0 → excluded
  });
});

describe("rankEvidenceForTrack — one pool, framed per track", () => {
  const pool = [nursing, coding];

  it("ranks the nursing item first for a nursing track and the coding item first for software", () => {
    const asNurse = rankEvidenceForTrack(pool, { role: "Registered Nurse", domain: "Healthcare", synonyms: ["staff nurse"] });
    const asDev = rankEvidenceForTrack(pool, { role: "Software Engineer", domain: "Technology" });
    expect(asNurse[0].item.title).toBe("Staff Nurse");
    expect(asDev[0].item.title).toBe("Built a scheduling app");
    // Everything stays in the pool either way — nothing is deleted, just re-ranked.
    expect(asNurse).toHaveLength(2);
    expect(asDev).toHaveLength(2);
  });
});
