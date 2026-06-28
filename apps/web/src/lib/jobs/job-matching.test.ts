import type { CareerProfile, Job } from "@careeros/database";
import { describe, expect, it } from "vitest";

import { scoreJobForUser } from "./job-matching";

const job = (title: string) =>
  ({ title, location: "Remote", remoteMode: "remote", seniority: "mid", description: "", rawPayload: {} }) as unknown as Job;

const profile = (targetRole: string, roleSynonyms: string[] | null = null) =>
  ({
    targetRole,
    careerGoal: "grow",
    roleCluster: null,
    roleSynonyms,
    location: "Remote",
    experienceLevel: "mid",
  }) as unknown as CareerProfile;

const run = (p: CareerProfile, title: string) =>
  scoreJobForUser({ careerProfile: p, resume: null, job: job(title) });

describe("scoreJobForUser — domain-agnostic role matching", () => {
  it("matches title variants for a non-tech role via Fadi synonyms", () => {
    const nurse = profile("Registered Nurse", ["registered nurse", "staff nurse", "rn", "charge nurse"]);
    expect(run(nurse, "Staff Nurse").onRole).toBe(true);
    expect(run(nurse, "RN - ICU Night Shift").onRole).toBe(true);
    expect(run(nurse, "Software Engineer").onRole).toBe(false);
  });

  it("falls back to token/phrase matching with no synonyms (still unbiased)", () => {
    const nurse = profile("Registered Nurse", null);
    expect(run(nurse, "Staff Nurse").onRole).toBe(true); // via the "nurse" token
  });

  it("works for finance the same way", () => {
    const fin = profile("Financial Analyst", ["financial analyst", "fp&a analyst", "finance analyst"]);
    expect(run(fin, "FP&A Analyst").onRole).toBe(true);
    expect(run(fin, "Registered Nurse").onRole).toBe(false);
  });

  it("treats IT through the same mechanism — no hardcoded privilege", () => {
    const it = profile("IT Support", ["it support", "service desk", "helpdesk technician"]);
    expect(run(it, "Service Desk Analyst").onRole).toBe(true);
  });

  it("caps off-role matches so location/keyword noise can't promote them", () => {
    const nurse = profile("Registered Nurse", ["registered nurse"]);
    expect(run(nurse, "Software Engineer").matchScore).toBeLessThanOrEqual(28);
  });

  it("does NOT match a short role token inside an unrelated word (soc ⊄ aSSOCiate)", () => {
    // Real bug: "SOC Analyst" was matching "Associate Professor in Cybersecurity"
    // because "associate" contains the substring "soc".
    const soc = profile("SOC Analyst", ["soc analyst", "security operations center analyst", "cybersecurity analyst"]);
    expect(run(soc, "Associate Professor in Cybersecurity").onRole).toBe(false);
    expect(run(soc, "Data Center Technician").onRole).toBe(false);
    // …but a genuine SOC role still matches.
    expect(run(soc, "SOC Analyst - Tier 2").onRole).toBe(true);
    expect(run(soc, "Cybersecurity Analyst").onRole).toBe(true);
  });

  it("does not let the career goal's domain word make any same-domain job on-role", () => {
    // careerGoal mentions the domain; a Professor *of* that domain must stay off-role.
    const p = {
      targetRole: "SOC Analyst",
      careerGoal: "break into cybersecurity and work in a security operations center",
      roleCluster: null,
      roleSynonyms: ["soc analyst"],
      location: "Remote",
      experienceLevel: "mid",
    } as unknown as CareerProfile;
    expect(run(p, "Associate Professor in Cybersecurity").onRole).toBe(false);
  });
});
