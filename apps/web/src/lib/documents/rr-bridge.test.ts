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
    certifications: [
      { id: "c1", name: "AWS Solutions Architect", issuer: "Amazon Web Services", date: "2024" },
    ],
    languages: [{ id: "l1", name: "English", level: "Native" }],
    awards: [{ id: "aw1", title: "Employee of the Year", awarder: "Acme", date: "2023" }],
    volunteer: [
      { id: "v1", organization: "Red Cross", role: "IT Volunteer", period: "2022 – 2023", summary: "Ran the help desk" },
    ],
    references: [{ id: "r1", name: "Jane Manager", reference: "Team lead — jane@acme.com" }],
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

  it("carries certifications & licenses through to the rxresume section (any-career)", () => {
    const rr = fadiToReactiveResume(sampleFadiResume());
    const certs = rr.sections.certifications.items;
    expect(certs.length).toBeGreaterThan(0);
    // rxresume's certification item uses `title` for the cert name.
    expect(certs.some((c) => c.title === "AWS Solutions Architect")).toBe(true);
  });

  it("carries languages through to the rxresume section (any-career)", () => {
    const rr = fadiToReactiveResume(sampleFadiResume());
    const langs = rr.sections.languages.items;
    // rxresume's language item uses `language` for the name.
    expect(langs.some((l) => l.language === "English")).toBe(true);
  });

  it("carries awards, volunteer and references through to rxresume (any-career)", () => {
    const rr = fadiToReactiveResume(sampleFadiResume());
    expect(rr.sections.awards.items.length).toBeGreaterThan(0);
    expect(rr.sections.volunteer.items.length).toBeGreaterThan(0);
    expect(rr.sections.references.items.length).toBeGreaterThan(0);
  });

  it("handles an empty résumé without throwing", () => {
    expect(() => fadiToReactiveResume(emptyResume())).not.toThrow();
  });
});
