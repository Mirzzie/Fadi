// The resolver itself lives in @careeros/portfolio (the integrity checks need it and a
// package cannot import from the app). Its tests stay HERE, because apps/web is the only
// workspace with a vitest runner — moving them into the package silently stopped 12 tests
// from running at all, which a green "667 passed" happily concealed.
import { describe, expect, it } from "vitest";

import { compareIdentity, findSameThings, rareTokens, rarityIndex } from "@careeros/portfolio";
import type { IdentityInput } from "@careeros/portfolio";

const item = (over: Partial<IdentityInput> & { id: string; title: string }): IdentityInput => ({
  organization: null,
  period: null,
  detail: null,
  url: null,
  imageUrl: null,
  gallery: [],
  tags: [],
  ...over,
});

/** The user's real pool — the case lexical matching could not solve. */
const pool = [
  item({
    id: "shield",
    title: "Shield-Right DevSecOps",
    organization: "MSc Dissertation",
    period: "2026",
    detail:
      "Embedding security at the right of the SDLC — runtime protection, drift detection and continuous compliance. IAST vs RASP evaluated on OWASP Juice Shop.",
    tags: ["devsecops", "iast", "rasp"],
  }),
  item({
    id: "automated",
    title: "Automated DevSecOps Pipeline Deployment & Runtime Protection",
    detail:
      "Automated deployment pipeline on AWS EC2 with Terraform and Ansible IaC, with runtime protection and drift detection for the Juice Shop target.",
    tags: ["terraform", "ansible", "devsecops"],
  }),
  item({
    id: "soc",
    title: "OpenClaw · Home SOC",
    organization: "Proxmox Homelab",
    detail: "A self-hosted security-operations lab — Wazuh and Suricata on Proxmox VE.",
    tags: ["wazuh", "suricata"],
  }),
  item({
    id: "nextcloud",
    title: "Self-Hosted Nextcloud",
    organization: "Raspberry Pi",
    detail: "A private cloud drive on a Raspberry Pi — encrypted file sync for the household.",
    tags: ["nextcloud"],
  }),
];

describe("rarity is measured against the user's own corpus", () => {
  it("finds distinctive words without any hardcoded vocabulary", () => {
    const idf = rarityIndex(pool);
    const soc = rareTokens(pool[2], idf);

    expect(soc).toEqual(expect.arrayContaining(["wazuh", "suricata"]));
  });

  it("is career-agnostic — a nurse's terms surface the same way", () => {
    const nursing = [
      item({ id: "1", title: "Paediatric ICU", detail: "Cannulation and triage on the ward." }),
      item({ id: "2", title: "Theatre rotation", detail: "Scrub practice and instrument counts." }),
      item({ id: "3", title: "Community placement", detail: "Home visits and wound dressing." }),
    ];
    const idf = rarityIndex(nursing);

    // "cannulation" is distinctive; nothing in the module knows what nursing is.
    expect(rareTokens(nursing[0], idf)).toContain("cannulation");
  });

  it("ignores words common across the corpus — they identify nothing", () => {
    const repetitive = Array.from({ length: 6 }, (_, i) =>
      item({ id: String(i), title: `Project ${i}`, detail: "Security work on a server." }),
    );
    const idf = rarityIndex(repetitive);

    expect(rareTokens(repetitive[0], idf)).not.toContain("security");
  });
});

describe("the rewritten-project case lexical matching missed", () => {
  /**
   * THE TRADE-OFF, MADE DELIBERATELY AND MEASURED (22 Sep 2026).
   *
   * These two records ARE the same dissertation written twice, and shared vocabulary was the only
   * thing that could see it. But the same rule, run on the owner's real 13-record CV, raised five
   * questions and every one was wrong: two different jobs ("share hardware, problems, documented,
   * software"), another two different jobs ("technologies, cloud, system, aws"), and three
   * different AWS projects against each other. People in one field describe their work with the
   * same words; that is what a career IS.
   *
   * So shared words no longer raise a question on their own. The cost is this pair: it is now
   * admitted as two records, which the person can see and delete. The alternative was asking them
   * five unanswerable questions per import, which is what they told us to stop doing.
   */
  it("no longer asks about two records that share only their vocabulary", () => {
    const idf = rarityIndex(pool);
    const m = compareIdentity(pool[0], pool[1], idf);

    expect(m.verdict).toBe("different");
    expect(m.reasons).toContain("nothing anchors these to the same work");
  });

  it("agreeing embeddings do not create a question either", () => {
    const idf = rarityIndex(pool);
    const m = compareIdentity(pool[0], pool[1], idf, 0.93);

    // Meaning can strengthen a candidate that something else anchored. It cannot be the anchor:
    // two cloud projects read as similar to any embedding model, because they are similar.
    expect(m.verdict).toBe("different");
  });

  it("keeps genuinely different work apart", () => {
    const idf = rarityIndex(pool);
    const m = compareIdentity(pool[2], pool[3], idf, 0.42);

    expect(m.verdict).toBe("different");
  });
});

describe("artefacts are the strongest signal", () => {
  it("asks about two records pointing at one file", () => {
    const a = item({ id: "a", title: "Home lab write-up", imageUrl: "https://cdn.x/abc.jpg" });
    const b = item({ id: "b", title: "Detection lab", imageUrl: "https://cdn.x/abc.jpg" });
    const m = compareIdentity(a, b, rarityIndex([a, b]));

    expect(m.verdict).toBe("maybe");
    expect(m.reasons[0]).toContain("same file or link");
  });

  it("normalises the same URL written differently", () => {
    const a = item({ id: "a", title: "Repo", url: "https://www.github.com/me/lab/" });
    const b = item({ id: "b", title: "The lab", url: "http://github.com/me/lab" });

    expect(compareIdentity(a, b, rarityIndex([a, b])).verdict).toBe("maybe");
  });
});

describe("guards against over-merging", () => {
  it("does not merge two different projects at one employer just because dates align", () => {
    const a = item({ id: "a", title: "Payroll migration", organization: "Acme", period: "2024", detail: "Moved payroll to a new provider." });
    const b = item({ id: "b", title: "Warehouse dashboard", organization: "Acme", period: "2024", detail: "Built a stock visibility dashboard." });
    // Meaning actively disagrees — that must count against, not be ignored.
    const m = compareIdentity(a, b, rarityIndex([a, b]), 0.35);

    expect(m.verdict).toBe("different");
  });

  it("never returns a verdict without a reason a person could read", () => {
    for (const m of findSameThings(pool)) {
      expect(m.reasons.length).toBeGreaterThan(0);
      expect(m.reasons.join("")).not.toMatch(/undefined|NaN/);
    }
  });
});

describe("works with no embeddings provider configured", () => {
  it("raises nothing at all on a pool of genuinely separate work", () => {
    // Previously this pool produced the shield/automated pair on shared words alone. The same
    // rule produced five false pairs on the owner's real CV, so an anchor is now required.
    expect(findSameThings(pool)).toEqual([]);
  });

  it("returns nothing on an empty or single-item pool", () => {
    expect(findSameThings([])).toEqual([]);
    expect(findSameThings([pool[0]])).toEqual([]);
  });
});

/**
 * THE QUESTION THAT SHOULD NEVER HAVE BEEN ASKED.
 *
 * Measured on the owner's real CV, 22 Sep 2026. Eleven records extracted cleanly, and then Fadi
 * held two of their projects for review against a third. All three are different work; they share
 * only the vocabulary every cloud project shares. Personal projects carry no employer and no
 * dates, so with nothing anchoring identity the decision fell to words like "aws" and "pipeline".
 */
describe("a review question needs something that names the same work", () => {
  const projects = [
    item({
      id: "devsecops",
      title: "DevSecOps Pipeline & Security Monitoring",
      detail:
        "Built a DevSecOps pipeline on AWS with GitHub Actions, Trivy scanning and Wazuh monitoring for a containerised app.",
      tags: ["aws", "devsecops"],
    }),
    item({
      id: "wordpress",
      title: "Automated WordPress Deployment on AWS",
      detail:
        "Automated a WordPress deployment on AWS EC2 with Terraform and GitHub Actions, including backups and monitoring.",
      tags: ["aws", "terraform"],
    }),
    item({
      id: "nodejs",
      title: "CI/CD Pipeline for Node.js Application on AWS",
      detail:
        "Built a CI/CD pipeline on AWS for a Node.js application using GitHub Actions, Docker and automated tests.",
      tags: ["aws", "ci/cd"],
    }),
  ];

  it("asks nothing about three different projects in the same technology", () => {
    expect(findSameThings(projects)).toEqual([]);
  });

  it("still asks when the two titles name the same project reworded", () => {
    const reworded = item({
      id: "nodejs-rewrite",
      title: "Node.js CI/CD pipeline on AWS",
      detail: "Pipeline for a Node.js app: GitHub Actions, Docker image build, automated tests.",
      tags: ["aws"],
    });
    const pairs = findSameThings([...projects, reworded]);
    expect(pairs.map((p) => [p.a, p.b].sort().join("+"))).toEqual(["nodejs+nodejs-rewrite"]);
  });

  it("a single shared word in a title is not a name", () => {
    const pairs = findSameThings([
      item({ id: "a", title: "Security Monitoring", detail: "Wazuh rules and alerting." }),
      item({ id: "b", title: "Deployment Monitoring", detail: "Grafana dashboards for releases." }),
    ]);
    expect(pairs).toEqual([]);
  });

  it("still asks about the same course written two ways — the place and dates anchor it", () => {
    const pairs = findSameThings([
      item({
        id: "msc-a",
        title: "MSc Cybersecurity",
        organization: "National College of Ireland",
        period: "Jan 2025 — Jan 2026",
        attribution: "education",
        detail: "Masters in cyber security, dissertation on DevSecOps.",
      }),
      item({
        id: "msc-b",
        title: "Master of Science in Cyber Security",
        organization: "National College of Ireland",
        period: "Jan 2025 — Jan 2026",
        attribution: "education",
        detail: "MSc programme covering security operations and a DevSecOps dissertation.",
      }),
    ]);
    expect(pairs).toHaveLength(1);
  });
});
