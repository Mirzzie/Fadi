import { describe, expect, it } from "vitest";

import { reconcile } from "./reconcile";
import type { IdentityInput } from "@/lib/identity/resolve";

const item = (o: Partial<IdentityInput> & { id: string; title: string }): IdentityInput => ({
  organization: null,
  period: null,
  detail: null,
  url: null,
  imageUrl: null,
  gallery: [],
  tags: [],
  ...o,
});

/** The user's real portfolio, abbreviated. */
const portfolio = [
  item({
    id: "p-shield",
    title: "Shield-Right DevSecOps",
    kind: "project",
    organization: "MSc Dissertation",
    detail: "Runtime protection, drift detection and continuous compliance. IAST vs RASP on OWASP Juice Shop.",
  }),
  item({
    id: "p-soc",
    title: "OpenClaw · Home SOC",
    kind: "project",
    organization: "Proxmox Homelab",
    detail: "A self-hosted security-operations lab — Wazuh and Suricata on Proxmox VE.",
  }),
  item({
    id: "p-intern",
    title: "AWS Cloud Intern",
    kind: "experience",
    organization: "AWS",
    period: "2025",
    detail: "Cloud infrastructure internship.",
  }),
  item({ id: "p-linux", title: "Linux", kind: "skill" }),
];

describe("comparing the base résumé against the portfolio", () => {
  it("finds the job that is on the résumé and nowhere on the site", () => {
    // The actual gap in the user's data: the résumé carries a Spark Technomedia
    // support role; the portfolio's only experience entries are AWS and DevOps.
    const resume = [
      item({
        id: "r-spark",
        title: "IT Support Consultant",
        kind: "experience",
        organization: "Spark Technomedia",
        period: "Jan 2026 – Aug 2026",
        detail: "Handled user support tickets for hardware, software and access issues.",
      }),
    ];
    const report = reconcile(resume, portfolio);

    expect(report.missingFromPortfolio.map((g) => g.title)).toEqual(["IT Support Consultant"]);
    expect(report.matched).toHaveLength(0);
  });

  it("does NOT report a gap when the same work is worded differently on each side", () => {
    // This is the whole reason it resolves identity instead of matching strings.
    const resume = [
      item({
        id: "r-diss",
        title: "Automated DevSecOps Pipeline Deployment & Runtime Protection",
        kind: "project",
        detail: "Runtime protection and drift detection for the OWASP Juice Shop target, with IAST and RASP compared.",
      }),
    ];
    const report = reconcile(resume, portfolio);

    // It must never be reported as missing. Whether it lands as a confident match or
    // as a question depends on how much the wording shares — both are honest answers;
    // "go and add this, you don't have it" is not.
    expect(report.missingFromPortfolio).toHaveLength(0);
    expect([...report.matched, ...report.uncertain][0]?.portfolioId).toBe("p-shield");
  });

  it("asks about an uncertain match instead of guessing either way", () => {
    // Hiding a real gap behind a guess defeats the purpose. A "maybe" is reported —
    // with the near-match named, so the reader can settle it in one glance.
    const resume = [
      item({
        id: "r-lab",
        title: "Security operations homelab",
        kind: "project",
        organization: "Proxmox Homelab",
        detail: "Built out a detection lab at home.",
      }),
    ];
    const report = reconcile(resume, portfolio);

    // Either way it is not "missing" — the owner is asked, or it is matched.
    expect(report.missingFromPortfolio).toHaveLength(0);
    expect([...report.uncertain, ...report.matched][0]?.portfolioId).toBe("p-soc");
  });

  it("reports portfolio-only work separately — it is not an error", () => {
    const resume = [
      item({ id: "r-intern", title: "AWS Cloud Intern", kind: "experience", organization: "AWS", period: "2025" }),
    ];
    const report = reconcile(resume, portfolio);

    const only = report.portfolioOnly.map((g) => g.title);
    expect(only).toContain("Shield-Right DevSecOps");
    expect(only).toContain("OpenClaw · Home SOC");
    // Skills are a vocabulary, not events — listing every one as "missing from your
    // CV" is noise, and a portfolio always has more of them than a page has room for.
    expect(only).not.toContain("Linux");
  });

  it("THE REAL-DATA BUG: an identical title on both sides is not a gap", () => {
    // Found by running this against the user's own résumé and portfolio. A degree
    // written identically in both places came back as MISSING FROM THE PORTFOLIO and
    // as PORTFOLIO-ONLY at the same time — the same record in two contradictory
    // buckets, telling them to add something they already had. compareIdentity's
    // thin-record guard is right inside one pool and wrong across two: these are one
    // person's two descriptions of one life.
    const resume = [item({ id: "r-msc", title: "MSc Cybersecurity", kind: "education" })];
    const withDegree = [...portfolio, item({ id: "p-msc", title: "MSc Cybersecurity", kind: "education" })];
    const report = reconcile(resume, withDegree);

    expect(report.missingFromPortfolio).toHaveLength(0);
    expect(report.matched[0]?.portfolioId).toBe("p-msc");
    expect(report.portfolioOnly.map((g) => g.title)).not.toContain("MSc Cybersecurity");
  });

  it("matches on the name regardless of case, spacing and punctuation", () => {
    const resume = [item({ id: "r", title: "AWS Certified Cloud Practitioner", kind: "certification" })];
    const site = [item({ id: "p", title: "aws certified — cloud practitioner", kind: "certification" })];

    expect(reconcile(resume, site).matched).toHaveLength(1);
  });

  it("does not match the same name across different kinds", () => {
    // A skill called "Linux" is not the project that happens to run on it.
    const resume = [item({ id: "r", title: "Linux", kind: "project" })];
    const site = [item({ id: "p", title: "Linux", kind: "skill" })];
    const report = reconcile(resume, site);

    expect(report.matched).toHaveLength(0);
  });

  it("says nothing when there is nothing to compare against", () => {
    // With an empty portfolio, every résumé line is technically missing. That is true
    // and useless, so it must not cry wolf on a first run.
    const report = reconcile([item({ id: "r", title: "Anything", kind: "project" })], []);

    expect(report.missingFromPortfolio).toEqual([]);
    expect(report.counts).toEqual({ resume: 1, portfolio: 0 });
  });

  it("never returns a finding without a reason a person could read", () => {
    const resume = [
      item({ id: "r1", title: "IT Support Consultant", kind: "experience", organization: "Spark Technomedia" }),
      item({ id: "r2", title: "Shield-Right DevSecOps", kind: "project", organization: "MSc Dissertation" }),
    ];
    const report = reconcile(resume, portfolio);

    for (const m of [...report.matched, ...report.uncertain]) {
      expect(m.reasons.length).toBeGreaterThan(0);
      expect(m.reasons.join("")).not.toMatch(/undefined|NaN/);
    }
  });
});
