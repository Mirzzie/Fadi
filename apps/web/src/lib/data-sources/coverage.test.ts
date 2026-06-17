import { describe, expect, it } from "vitest";

import { decideJobCoverage, isLikelyTechDomain, type SourceCoverageInfo } from "./coverage";

const tech: SourceCoverageInfo = { id: "remotive", name: "Remotive", coverage: "tech" };
const tech2: SourceCoverageInfo = { id: "arbeitnow", name: "Arbeitnow", coverage: "tech" };
const general: SourceCoverageInfo = { id: "reed", name: "Reed", coverage: "general" };

describe("isLikelyTechDomain", () => {
  it("treats unknown/blank as tech (back-compat: never strips sources blindly)", () => {
    expect(isLikelyTechDomain(null)).toBe(true);
    expect(isLikelyTechDomain("")).toBe(true);
    expect(isLikelyTechDomain("   ")).toBe(true);
  });

  it("recognises tech fields", () => {
    expect(isLikelyTechDomain("Software Engineering")).toBe(true);
    expect(isLikelyTechDomain("Information Technology")).toBe(true);
    expect(isLikelyTechDomain("Data & AI")).toBe(true);
  });

  it("recognises non-tech fields", () => {
    expect(isLikelyTechDomain("Nursing")).toBe(false);
    expect(isLikelyTechDomain("Finance")).toBe(false);
    expect(isLikelyTechDomain("Skilled Trades")).toBe(false);
    expect(isLikelyTechDomain("Education")).toBe(false);
  });
});

describe("decideJobCoverage", () => {
  it("non-tech field with only tech sources → honest advisory, no false coverage", () => {
    const c = decideJobCoverage("Nursing", [tech, tech2]);
    expect(c.hasCoverage).toBe(false);
    expect(c.needsGeneralSource).toBe(true);
    expect(c.message).toMatch(/Nursing/);
    expect(c.message).toMatch(/Reed|Adzuna|Jooble/);
  });

  it("non-tech field with a general source → covered, no notice", () => {
    const c = decideJobCoverage("Finance", [tech, general]);
    expect(c.hasCoverage).toBe(true);
    expect(c.needsGeneralSource).toBe(false);
    expect(c.message).toBeNull();
    expect(c.generalSources).toContain("Reed");
  });

  it("tech field with tech sources → covered", () => {
    const c = decideJobCoverage("Software Engineering", [tech]);
    expect(c.hasCoverage).toBe(true);
    expect(c.message).toBeNull();
  });

  it("no sources at all → honest 'configure a source' message", () => {
    const c = decideJobCoverage("Finance", []);
    expect(c.hasCoverage).toBe(false);
    expect(c.message).toMatch(/No live job sources/i);
  });

  it("unknown domain is treated as covered when any source exists (back-compat)", () => {
    const c = decideJobCoverage(null, [tech]);
    expect(c.hasCoverage).toBe(true);
    expect(c.message).toBeNull();
  });
});
