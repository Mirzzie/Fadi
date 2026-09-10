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
  it("recognises the same MSc work under two completely different titles", () => {
    const idf = rarityIndex(pool);
    const m = compareIdentity(pool[0], pool[1], idf);

    // No shared title, no shared organisation, no shared date string — but they
    // share the proper nouns a rewrite keeps.
    expect(m.verdict).not.toBe("different");
    expect(m.reasons.join(" ")).toMatch(/distinctive terms/);
  });

  it("promotes it to a confident match once meaning agrees", () => {
    const idf = rarityIndex(pool);
    const m = compareIdentity(pool[0], pool[1], idf, 0.93);

    expect(m.verdict).toBe("same");
    expect(m.reasons).toContain("describe the same thing in different words");
  });

  it("keeps genuinely different work apart", () => {
    const idf = rarityIndex(pool);
    const m = compareIdentity(pool[2], pool[3], idf, 0.42);

    expect(m.verdict).toBe("different");
  });
});

describe("artefacts are the strongest signal", () => {
  it("treats two records pointing at one file as the same thing", () => {
    const a = item({ id: "a", title: "Home lab write-up", imageUrl: "https://cdn.x/abc.jpg" });
    const b = item({ id: "b", title: "Detection lab", imageUrl: "https://cdn.x/abc.jpg" });
    const m = compareIdentity(a, b, rarityIndex([a, b]));

    expect(m.verdict).toBe("same");
    expect(m.reasons[0]).toContain("same file or link");
  });

  it("normalises the same URL written differently", () => {
    const a = item({ id: "a", title: "Repo", url: "https://www.github.com/me/lab/" });
    const b = item({ id: "b", title: "The lab", url: "http://github.com/me/lab" });

    expect(compareIdentity(a, b, rarityIndex([a, b])).verdict).toBe("same");
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
  it("still finds the rewritten pair using lexical anchors alone", () => {
    const found = findSameThings(pool); // no similarity function supplied
    const pair = found.find((m) => [m.a, m.b].sort().join("+") === "automated+shield");

    expect(pair).toBeDefined();
  });

  it("returns nothing on an empty or single-item pool", () => {
    expect(findSameThings([])).toEqual([]);
    expect(findSameThings([pool[0]])).toEqual([]);
  });
});
