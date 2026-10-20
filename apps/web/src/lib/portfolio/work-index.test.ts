import { describe, expect, it } from "vitest";

import { caseSkillSlugs, evidenceScore, hasArtifact, isMeasurement, latestYear, pickLead, rankCases, skillIndex, splitBullets, unbackedSkills } from "@careeros/portfolio";
import type { PortfolioItemView } from "@careeros/portfolio";

const item = (over: Partial<PortfolioItemView>): PortfolioItemView => ({
  id: Math.random().toString(36).slice(2),
  section: "project",
  title: "Untitled",
  subtitle: null,
  location: null,
  dateRange: null,
  description: null,
  bullets: [],
  roles: [],
  tag: null,
  url: null,
  imageUrl: null,
  gallery: [],
  isPublished: true,
  ...over,
});

describe("evidence ranking", () => {
  it("weights what a reader can CHECK above what they must take on trust", () => {
    const provable = item({ title: "Shown", imageUrl: "a.jpg", url: "https://x" });
    const asserted = item({ title: "Claimed", description: "A long and confident paragraph." });

    expect(evidenceScore(provable)).toBeGreaterThan(evidenceScore(asserted));
  });

  it("counts measurements, not activity, as evidence", () => {
    const measured = item({ bullets: ["100% block rate", "<3ms overhead"] });
    const duties = item({ bullets: ["Administered Linux servers", "Supported deployments"] });

    expect(evidenceScore(measured)).toBeGreaterThan(evidenceScore(duties));
  });

  it("separates figures from notes so the template can lift the numbers out", () => {
    const { figures, notes } = splitBullets([
      "One-command deploy under 6 minutes",
      "SSL, backups and alerts baked in",
    ]);

    expect(figures).toEqual(["One-command deploy under 6 minutes"]);
    expect(notes).toEqual(["SSL, backups and alerts baked in"]);
  });

  it("recognises a measurement in any field's vocabulary", () => {
    // Career-agnostic: a nurse's minutes count exactly like an engineer's milliseconds.
    expect(isMeasurement("cut handover time by 12 minutes")).toBe(true);
    expect(isMeasurement("served 40 covers a night")).toBe(true);
    expect(isMeasurement("Improved the process")).toBe(false);
  });

  it("orders cases by evidence, then recency — not by the owner's manual order", () => {
    const weak = item({ title: "Weak", dateRange: "2026" });
    const strong = item({ title: "Strong", imageUrl: "a.jpg", url: "https://x", dateRange: "2020" });
    const middling = item({ title: "Middling", url: "https://y", dateRange: "2025" });

    expect(rankCases([weak, middling, strong]).map((c) => c.title)).toEqual([
      "Strong",
      "Middling",
      "Weak",
    ]);
  });
});

describe("the lead case", () => {
  it("is chosen, never hardcoded — new work can take the top spot", () => {
    const old = item({ title: "Old", imageUrl: "a.jpg", dateRange: "2024" });
    const fresh = item({ title: "Fresh", imageUrl: "b.jpg", url: "https://x", dateRange: "2026" });

    expect(pickLead([old, fresh])?.title).toBe("Fresh");
  });

  it("can lead with a useful text-only project because media is optional", () => {
    const bare = item({ title: "Bare", description: "Words only." });

    expect(pickLead([bare])).toBe(bare);
    expect(hasArtifact(bare)).toBe(false);
  });

  it("ignores non-work sections — a degree never leads a portfolio", () => {
    const degree = item({ section: "education", title: "MSc", imageUrl: "a.jpg" });
    const project = item({ section: "project", title: "Lab", url: "https://x" });

    expect(pickLead([degree, project])?.title).toBe("Lab");
  });
});

describe("skills as an index into the evidence", () => {
  const pool = [
    item({ title: "WordPress on AWS", tag: "Ansible", roles: ["aws", "linux"] }),
    item({ title: "CI/CD Automation", roles: ["linux", "ci-cd"] }),
    item({ section: "skill", title: "Ansible" }),
    item({ section: "skill", title: "Kubernetes" }),
  ];

  it("counts how many pieces of work demonstrate each skill", () => {
    const index = skillIndex(pool);
    const linux = index.find((s) => s.slug === "linux");

    expect(linux?.count).toBe(2);
    expect(index[0]?.slug).toBe("linux"); // most-backed first
  });

  it("NEVER lists a skill no work backs — that is the claim this page avoids making", () => {
    expect(skillIndex(pool).map((s) => s.slug)).not.toContain("kubernetes");
    // …but the owner is told about it, so they can add proof or drop it.
    expect(unbackedSkills(pool)).toContain("Kubernetes");
  });

  it("uses the owner's own casing when they named the skill themselves", () => {
    expect(skillIndex(pool).find((s) => s.slug === "ansible")?.label).toBe("Ansible");
  });

  it("treats differently-punctuated spellings as one skill", () => {
    const index = skillIndex([
      item({ roles: ["CI/CD"] }),
      item({ roles: ["ci cd"] }),
      item({ roles: ["ci-cd"] }),
    ]);

    expect(index.find((s) => s.slug === "ci-cd")?.count).toBe(3);
  });
});

describe("growth", () => {
  it("handles an empty portfolio without throwing", () => {
    expect(rankCases([])).toEqual([]);
    expect(skillIndex([])).toEqual([]);
    expect(pickLead([])).toBeNull();
  });

  it("scales: 200 new items need no code change", () => {
    const many = Array.from({ length: 200 }, (_, i) =>
      item({ title: `Case ${i}`, roles: [`skill-${i % 7}`], dateRange: `20${10 + (i % 15)}` })
    );

    expect(rankCases(many)).toHaveLength(200);
    expect(skillIndex(many)).toHaveLength(7);
  });

  it("reads years out of whatever date format the owner typed", () => {
    expect(latestYear("Jan 2026 — Present")).toBe(2026);
    expect(latestYear("2020 — 2023")).toBe(2023);
    expect(latestYear("Summer")).toBe(0);
  });
});

/**
 * A SKILL THE WORK NAMES IS BACKED BY THAT WORK — and the filter has to agree.
 *
 * Measured on the owner's real site: sixteen listed skills, zero backed, because backing came
 * only from a case's single `tag` ("IaC", "Homelab", "Blue Team") while the skills read
 * "Ansible", "AWS Cloud", "Terraform". Seven projects could never back sixteen skills, so the
 * page's instruction — "tag the work that proves each one" — was impossible to follow. They
 * asked what it meant, which was the fair question.
 */
describe("skills backed by what the work says", () => {
  const project = (over: Partial<PortfolioItemView> = {}): PortfolioItemView =>
    item({
      section: "project",
      title: "WordPress on AWS + Ansible",
      description: "A hardened WordPress stack on AWS EC2, provisioned with Ansible playbooks.",
      tag: "IaC",
      ...over,
    });
  const skill = (title: string): PortfolioItemView => item({ section: "skill", title });

  it("backs a skill the case names in its own words", () => {
    const backed = skillIndex([project(), skill("Ansible")]).map((s) => s.label);
    expect(backed).toContain("Ansible");
    expect(unbackedSkills([project(), skill("Ansible")])).toEqual([]);
  });

  it("still hides a skill nothing on the page shows", () => {
    expect(unbackedSkills([project(), skill("Terraform")])).toEqual(["Terraform"]);
  });

  it("the filter answers to the same skill the index counted", () => {
    const labels = ["Ansible", "Terraform"];
    const slugs = caseSkillSlugs(project(), labels);
    expect(slugs).toContain("ansible"); // named in the description
    expect(slugs).toContain("iac"); // its own tag
    expect(slugs).not.toContain("terraform");
  });

  it("matches whole words, so SOC does not match society", () => {
    const social = project({ title: "Community site", description: "A society newsletter." });
    expect(unbackedSkills([social, skill("SOC")])).toEqual(["SOC"]);
  });

  it("needs the whole phrase for a multi-word skill", () => {
    const partial = project({
      title: "Server work",
      description: "Server rebuilds, plus administration of the ticket queue.",
    });
    expect(unbackedSkills([partial, skill("Server Administration")])).toEqual([
      "Server Administration",
    ]);
  });
});
