import { describe, expect, it } from "vitest";

import { parseResumeData } from "@reactive-resume/schema/resume/data";

import { fadiToReactiveResume } from "./rr-bridge";
import { emptyResume, type ResumeData } from "./resume";

// Runtime proof of the doctrine-safe bridge (ADR 0010, Phase 3): a real Fadi résumé maps,
// via the JSON-Resume chain, to a VALID (renderable) Reactive Resume ResumeData — content
// preserved, nothing invented.

function sampleFadiResume(): ResumeData {
  return {
    ...emptyResume(),
    personal: {
      name: "Mirzad Ismail",
      headline: "IT System Administrator",
      email: "mirzad@example.com",
      phone: "+353 1 234 5678",
      location: "Dublin, Ireland",
      links: "LinkedIn · GitHub",
    },
    summary: "IT professional with experience in IT operations and cloud platforms.",
    skills: "Cloud: AWS, Azure\nOps: Linux, Windows Server",
  };
}

describe("fadiToReactiveResume", () => {
  it("produces a schema-valid Reactive Resume ResumeData", () => {
    const rr = fadiToReactiveResume(sampleFadiResume());
    expect(() => parseResumeData(rr)).not.toThrow();
  });

  it("preserves the person's real details (never invents)", () => {
    const rr = fadiToReactiveResume(sampleFadiResume());
    expect(rr.basics.name).toBe("Mirzad Ismail");
    expect(rr.basics.headline).toBe("IT System Administrator");
    expect(rr.basics.email).toBe("mirzad@example.com");
    expect(rr.summary.content).toContain("IT operations");
  });

  it("handles an empty résumé without throwing", () => {
    expect(() => fadiToReactiveResume(emptyResume())).not.toThrow();
  });
});
