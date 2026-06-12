import { describe, expect, it } from "vitest";

import { structureJobDescription } from "./jd-structure";

describe("structureJobDescription", () => {
  it("returns no structure for empty input", () => {
    expect(structureJobDescription("").hasStructure).toBe(false);
    expect(structureJobDescription(null).hasStructure).toBe(false);
  });

  it("parses line-broken text with • bullets and headings", () => {
    const jd = [
      "Join our growing care team in Manchester.",
      "Key Responsibilities:",
      "• Support residents with daily living activities",
      "• Maintain accurate care records",
      "Requirements",
      "• NVQ Level 2 in Health and Social Care",
      "• Right to work in the UK",
      "Benefits",
      "• 28 days holiday",
    ].join("\n");

    const out = structureJobDescription(jd);
    expect(out.hasStructure).toBe(true);
    const titles = out.sections.map((s) => s.title);
    expect(titles).toContain("Key Responsibilities");
    expect(titles).toContain("Requirements");
    expect(titles).toContain("Benefits");
    const reqs = out.sections.find((s) => s.title === "Requirements")!;
    expect(reqs.bullets).toEqual([
      "NVQ Level 2 in Health and Social Care",
      "Right to work in the UK",
    ]);
    // Lead-in lands in the untitled first section.
    expect(out.sections[0].title).toBeNull();
    expect(out.sections[0].paragraphs[0]).toContain("Manchester");
  });

  it("re-expands flattened ' - ' bullet runs from plain-text feeds", () => {
    const jd =
      "We're Looking For Someone With - 2+ years of experience working for a fast-paced corporate level Service Desk - Good knowledge of Windows Operating System (Win10 / 11) - Good knowledge of Microsoft Office Suite (2013, 2016, O365) - Basic understanding of networking - Clean driving license";

    const out = structureJobDescription(jd);
    expect(out.hasStructure).toBe(true);
    const all = out.sections.flatMap((s) => s.bullets);
    expect(all).toContain("Good knowledge of Windows Operating System (Win10 / 11)");
    expect(all).toContain("Clean driving license");
    expect(all.length).toBeGreaterThanOrEqual(4);
  });

  it("treats short colon-lines as headings", () => {
    const out = structureJobDescription("What we offer:\n• Pension\n• Gym membership");
    expect(out.sections[0].title).toBe("What we offer");
    expect(out.sections[0].bullets).toHaveLength(2);
  });

  it("falls back to paragraphs for unstructured prose without inventing sections", () => {
    const out = structureJobDescription(
      "We need a friendly barista for weekend shifts. Espresso experience preferred but we will train the right person.",
    );
    expect(out.hasStructure).toBe(false);
    expect(out.sections).toHaveLength(1);
    expect(out.sections[0].paragraphs).toHaveLength(1);
  });

  it("does not mistake long sentences for headings", () => {
    const out = structureJobDescription(
      "About this role you will find plenty of detail below, including the responsibilities we expect and the requirements you need to meet for success.",
    );
    expect(out.sections.every((s) => s.title === null)).toBe(true);
  });
});
