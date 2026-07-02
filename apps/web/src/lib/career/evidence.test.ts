import { describe, expect, it } from "vitest";

import { composeCareerEvidence, isResumeJustLinkedInCopy, isSubstantialLinkedIn } from "./evidence";

const FULL_LINKEDIN =
  "Experienced security analyst. ".repeat(20) +
  "Led SOC operations, incident response, and threat detection across three companies.";
const RESUME = "Tailored cybersecurity resume — SOC analyst focus. " + "Detail. ".repeat(30);

describe("career evidence composer", () => {
  it("treats a substantial LinkedIn profile as the source of truth and demotes the resume", () => {
    const { block, historySource } = composeCareerEvidence({
      resumeText: RESUME,
      linkedInText: FULL_LINKEDIN,
    });
    expect(historySource).toBe("linkedin");
    expect(block).toContain("SOURCE OF TRUTH");
    expect(block).toContain("SUPPORTING RESUME");
    // The authoritative block leads with LinkedIn, then the tailored-resume caveat.
    expect(block.indexOf("SOURCE OF TRUTH")).toBeLessThan(block.indexOf("SUPPORTING RESUME"));
    expect(block).toContain("may deliberately omit");
  });

  it("ignores a bare LinkedIn URL/handle and falls back to the resume", () => {
    expect(isSubstantialLinkedIn("https://www.linkedin.com/in/mirzzie")).toBe(false);
    expect(isSubstantialLinkedIn("linkedin.com/in/mirzzie")).toBe(false);
    const { historySource, block } = composeCareerEvidence({
      resumeText: RESUME,
      linkedInText: "https://www.linkedin.com/in/mirzzie",
    });
    expect(historySource).toBe("resume");
    expect(block).toContain("from the candidate's resume");
    expect(block).toContain("may omit experience");
  });

  it("flags the resume as possibly tailored when it's the only record", () => {
    const { historySource, block } = composeCareerEvidence({ resumeText: RESUME, linkedInText: null });
    expect(historySource).toBe("resume");
    expect(block).toContain("not exhaustive");
  });

  it("returns an honest empty marker when nothing is on file", () => {
    const { historySource, block } = composeCareerEvidence({ resumeText: "", linkedInText: "" });
    expect(historySource).toBe("none");
    expect(block).toContain("none on file");
    expect(block).toContain("never invent");
  });

  it("keeps a bare LinkedIn URL visible even with no real history", () => {
    const { historySource, block } = composeCareerEvidence({
      resumeText: null,
      linkedInText: "linkedin.com/in/mirzzie",
    });
    expect(historySource).toBe("none");
    expect(block).toContain("linkedin.com/in/mirzzie");
  });

  it("truncates an oversized LinkedIn profile", () => {
    const huge = "x".repeat(20000);
    const { block } = composeCareerEvidence({ resumeText: null, linkedInText: huge });
    expect(block).toContain("[truncated]");
  });

  it("drops a 'resume' that is just a copy of the LinkedIn text (the slop root cause)", () => {
    // The real-world failure: the resume field holds the LinkedIn paste — whitespace
    // aside, the same text. The copy must be detected and omitted, not double-fed.
    expect(isResumeJustLinkedInCopy(FULL_LINKEDIN, `  ${FULL_LINKEDIN}\n`)).toBe(true);
    expect(isResumeJustLinkedInCopy(RESUME, FULL_LINKEDIN)).toBe(false);
    expect(isResumeJustLinkedInCopy("", FULL_LINKEDIN)).toBe(false);

    const { block, historySource } = composeCareerEvidence({
      resumeText: FULL_LINKEDIN, // a copy, not a real resume
      linkedInText: FULL_LINKEDIN,
    });
    expect(historySource).toBe("linkedin");
    expect(block).not.toContain("SUPPORTING RESUME");
  });
});
