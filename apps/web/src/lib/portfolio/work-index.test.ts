import { describe, expect, it } from "vitest";

import {
  evidenceScore,
  hasArtifact,
  isMeasurement,
  latestYear,
  pickLead,
  rankCases,
  skillIndex,
  splitBullets,
  unbackedSkills,
} from "@careeros/portfolio";
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

  it("is null when nothing has an artefact, rather than promoting an empty frame", () => {
    const bare = item({ title: "Bare", description: "Words only." });

    expect(pickLead([bare])).toBeNull();
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
