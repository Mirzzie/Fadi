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

  it("does NOT let a lone generic word like 'system' make an unrelated role on-role", () => {
    // Real dashboard bug: this physical fire-safety role led the briefing for an IT
    // System Administrator, because "system" appears in both titles.
    const sysadmin = profile("IT System Administrator", [
      "it system administrator",
      "systems administrator",
      "system admin",
    ]);
    expect(run(sysadmin, "Fire, Life and Safety System Commissioning Engineer").onRole).toBe(false);
    expect(run(sysadmin, "Fire, Life and Safety System Commissioning Engineer").matchScore).toBeLessThanOrEqual(28);
    // …but a genuine sysadmin role still matches, on the phrase/synonyms.
    expect(run(sysadmin, "Systems Administrator").onRole).toBe(true);
    expect(run(sysadmin, "IT System Administrator - Windows").onRole).toBe(true);
  });

  it("flags same-field roles as fieldRelated (fallback), excluding other functions in the field", () => {
    // Real data: a SOC Analyst seeker whose store has security ENGINEERS but no
    // literal SOC/Security ANALYST postings. We'd rather show the adjacent security
    // roles (labelled) than a blank board — but never sales/academia in the field.
    const soc = {
      targetRole: "SOC Analyst",
      careerGoal: "grow",
      domain: "Cybersecurity",
      roleCluster: ["SOC Analyst"],
      roleSynonyms: [
        "security operations center analyst",
        "information security analyst",
        "cyber security analyst",
        "incident response analyst",
        "threat analyst",
        "network security analyst",
        "soc analyst",
      ],
      location: "Remote",
      experienceLevel: "mid",
    } as unknown as CareerProfile;

    // Same field, different role → shown as related (not on-role).
    for (const title of ["Staff Security Engineer, SOAR", "Security Automation Engineer", "Network Security Engineer"]) {
      const r = run(soc, title);
      expect(r.onRole, title).toBe(false);
      expect(r.fieldRelated, title).toBe(true);
    }

    // In the field but a different FUNCTION, or not the field at all → NOT shown.
    for (const title of [
      "Solution Sales Principal - Cyber Security", // sales
      "Associate Professor in Cybersecurity", // academia
      "Social Media Manager",
      "Senior Software Engineer (TypeScript, NestJS/Node.js)",
    ]) {
      const r = run(soc, title);
      expect(r.onRole, title).toBe(false);
      expect(r.fieldRelated, title).toBe(false);
    }

    // Exact role still on-role (and not merely "related").
    const exact = run(soc, "SOC Analyst - Tier 2");
    expect(exact.onRole).toBe(true);
    expect(exact.fieldRelated).toBe(false);

    // A "Staff" (senior) field role is flagged over-level for a mid profile — the
    // data layer drops it from the related tier so we don't suggest an unreachable role.
    expect(run(soc, "Staff Security Engineer, SOAR").overLevel).toBe(true);
    expect(run(soc, "Security Automation Engineer").overLevel).toBe(false);
  });

  it("does not leak field-related across domains (a nurse never sees security roles)", () => {
    const nurse = {
      targetRole: "Registered Nurse",
      careerGoal: "grow",
      domain: "Healthcare",
      roleCluster: null,
      roleSynonyms: ["staff nurse", "rn", "charge nurse"],
      location: "Remote",
      experienceLevel: "mid",
    } as unknown as CareerProfile;
    const r = run(nurse, "Staff Security Engineer, SOAR");
    expect(r.onRole).toBe(false);
    expect(r.fieldRelated).toBe(false);
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
