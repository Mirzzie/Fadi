import { describe, expect, it } from "vitest";

import { findAllDuplicates, findCrossSectionDuplicates } from "@careeros/portfolio";

const item = (
  id: string,
  section: string,
  title: string,
  subtitle?: string,
  dateRange?: string,
) => ({ id, section, title, subtitle: subtitle ?? null, dateRange: dateRange ?? null });

describe("cross-section duplicates — the blind spot", () => {
  // These are the real pairs the section-scoped checker reported as "no duplicates".
  const real = [
    item("1", "experience", "AWS Cloud Intern", "F13 Technologies", "Jun — Aug 2023"),
    item("2", "project", "AWS Cloud Environments", "F13 Technologies · Internship · 2023"),
    item("3", "experience", "Freelance IT Consultant", "SPARK TECHNOMEDIA", "Jan 2026 — Present"),
    item("4", "project", "IT Support & Server Operations", "SPARK TECHNOMEDIA · 2026"),
    item("5", "experience", "Junior DevOps Engineer Trainee", "Crozaint Technologies", "Jan — Jun 2024"),
    item("6", "project", "CI/CD & Linux Automation", "Crozaint Technologies · 2024"),
    item("7", "certification", "AWS Certified Cloud Practitioner", "Issued Oct 2025"),
    item("8", "project", "AWS Certified Cloud Practitioner"),
  ];

  it("catches a job that was also written up as a project", () => {
    const pairs = findCrossSectionDuplicates(real).map((f) => f.itemIds.sort().join("+"));

    expect(pairs).toContain("1+2"); // F13 internship
    expect(pairs).toContain("3+4"); // SPARK consultancy
    expect(pairs).toContain("5+6"); // Crozaint traineeship
  });

  it("catches a certification also entered as a project", () => {
    const finding = findCrossSectionDuplicates(real).find(
      (f) => f.itemIds.sort().join("+") === "7+8",
    );

    expect(finding).toBeDefined();
    expect(finding?.title).toBe("Same entry in two sections");
  });

  it("does NOT flag two genuinely different projects at one employer", () => {
    // Same org, same year, different work — the common false positive to avoid.
    const distinct = [
      item("a", "project", "Payroll migration", "Acme Ltd · 2024"),
      item("b", "project", "Warehouse dashboard", "Acme Ltd · 2024"),
    ];

    expect(findCrossSectionDuplicates(distinct)).toHaveLength(0);
  });

  it("does NOT flag the same employer in different years", () => {
    const apart = [
      item("a", "experience", "Junior technician", "Acme Ltd", "2019"),
      item("b", "project", "Network rebuild", "Acme Ltd · 2024"),
    ];

    expect(findCrossSectionDuplicates(apart)).toHaveLength(0);
  });

  it("is career-agnostic — a placement written up twice reads the same way", () => {
    const nurse = [
      item("a", "experience", "Staff Nurse", "St James's Hospital", "2024 — 2025"),
      item("b", "project", "Paediatric ICU rotation", "St James's Hospital · 2024"),
    ];

    expect(findCrossSectionDuplicates(nurse)).toHaveLength(1);
  });

  it("reports nothing on an empty or single-item portfolio", () => {
    expect(findAllDuplicates([])).toEqual([]);
    expect(findAllDuplicates([item("a", "project", "Only one")])).toEqual([]);
  });

  it("never reports the same pair twice", () => {
    const found = findAllDuplicates(real);
    const keys = found.map((f) => f.itemIds.sort().join("+"));

    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("which copy Fadi recommends keeping", () => {
  const withProof = {
    id: "keep",
    section: "project",
    title: "Home SOC",
    subtitle: "Acme · 2024",
    dateRange: "2024",
    imageUrl: "shot.png",
    gallery: ["a.png"],
    bullets: ["200+ attacks triaged"],
    description: "A lab.",
  };
  const bare = {
    id: "drop",
    section: "experience",
    title: "Home SOC",
    subtitle: "Acme · 2024",
    dateRange: "2024",
  };

  it("keeps the copy a reader gets something from, even against a canonical section", () => {
    const [f] = findCrossSectionDuplicates([withProof, bare]);

    expect(f.keepId).toBe("keep");
    expect(f.dropId).toBe("drop");
    expect(f.keepReason).toContain("artefact");
  });

  it("breaks a tie toward the canonical record — the project copy is the restatement", () => {
    const job = { id: "job", section: "experience", title: "AWS Cloud Intern", subtitle: "F13 · 2023" };
    const restated = { id: "proj", section: "project", title: "AWS Cloud Environments", subtitle: "F13 · 2023" };
    const [f] = findCrossSectionDuplicates([restated, job]);

    expect(f.keepId).toBe("job");
    expect(f.keepReason).toContain("canonical");
  });

  it("always names both sides, so the owner can overrule it", () => {
    const [f] = findCrossSectionDuplicates([withProof, bare]);

    expect(f.itemIds).toHaveLength(2);
    expect(f.keepId && f.dropId && f.keepId !== f.dropId).toBe(true);
  });
});

describe("the same work, re-worded", () => {
  /**
   * MEASURED ON REAL DATA. An evidence sync added 9 items to the user's portfolio.
   * Six were work already there under different names, and the integrity panel said
   * "No duplicates found" — both lexical passes need a shared title, or a shared
   * organisation AND year, and a rewrite keeps none of those.
   *
   * NOTE THE CORPUS. Rarity is measured against the user's OWN items, so these tests
   * carry the surrounding portfolio rather than a bare pair: with two documents every
   * shared term appears in 100% of them and nothing can be distinctive. That is a real
   * property of the design, pinned below, not a testing convenience.
   */
  const rest = [
    { ...item("x1", "project", "OpenClaw · Home SOC", "Proxmox Homelab"), description: "Wazuh and Suricata on Proxmox VE." },
    { ...item("x2", "project", "n8n Cyber-News Pipeline", "Raspberry Pi"), description: "An n8n workflow summarising security news." },
    { ...item("x3", "project", "CTF & Forensics Practice", "TryHackMe"), description: "Rooms covering forensics and privilege escalation." },
    { ...item("x4", "project", "Active Directory Lab"), description: "A Windows domain with group policy and DNS." },
    { ...item("x5", "project", "Cloud Cost Optimization"), description: "Python scripts reporting on idle cloud spend." },
  ];

  const pairs: [string, string, string][] = [
    [
      "WordPress on AWS + Ansible",
      "Automated WordPress Deployment on AWS",
      "Deployed a WordPress stack on an AWS EC2 instance, provisioned and configured with Ansible.",
    ],
    [
      "Self-Hosted Nextcloud",
      "Private Network Storage & Identity Management Deployment",
      "A private Nextcloud file store on the home network, with accounts and access control.",
    ],
    [
      "Shield-Right DevSecOps",
      "Automated DevSecOps Pipeline Deployment & Runtime Protection",
      "Runtime protection and drift detection with IAST and RASP compared on OWASP Juice Shop.",
    ],
  ];

  it.each(pairs)("catches “%s” beside “%s”", (a, b, detail) => {
    const items = [
      { ...item("a", "project", a), description: detail },
      { ...item("b", "project", b), description: detail },
      ...rest,
    ];
    const found = findAllDuplicates(items).filter(
      (f) => f.itemIds?.includes("a") && f.itemIds?.includes("b"),
    );

    expect(found).toHaveLength(1);
  });

  it("hedges when it is not certain, and says why", () => {
    const items = [
      { ...item("a", "project", "WordPress on AWS + Ansible"), description: "A WordPress stack on EC2, provisioned with Ansible." },
      { ...item("b", "project", "Automated WordPress Deployment on AWS"), description: "A WordPress stack on EC2, provisioned with Ansible." },
      ...rest,
    ];
    const [found] = findAllDuplicates(items);

    // "These ARE the same" about work that isn't destroys trust in every other finding.
    expect(found.title).toMatch(/might be|written twice/);
    expect(found.detail).toMatch(/distinctive terms|artefact|same/i);
  });

  it("needs a corpus to judge — two items alone cannot be compared", () => {
    // Honest limit, stated rather than hidden: with one pair, every shared word is in
    // 100% of the documents, so nothing is distinctive and nothing is reported. On a
    // real portfolio (13 projects) the same pair is caught.
    const bare = [
      { ...item("a", "project", "WordPress on AWS + Ansible"), description: "EC2 and Ansible." },
      { ...item("b", "project", "Automated WordPress Deployment on AWS"), description: "EC2 and Ansible." },
    ];

    expect(findAllDuplicates(bare)).toEqual([]);
  });

  it("does not call two genuinely different projects the same work", () => {
    const items = [
      { ...item("a", "project", "Payroll migration"), description: "Moved payroll to a new provider for the finance team." },
      { ...item("b", "project", "Warehouse dashboard"), description: "Built a stock visibility dashboard for the warehouse." },
      ...rest,
    ];
    const found = findAllDuplicates(items).filter(
      (f) => f.itemIds?.includes("a") && f.itemIds?.includes("b"),
    );

    expect(found).toEqual([]);
  });

  it("never reports one pair twice because two passes noticed it", () => {
    const items = [
      { ...item("a", "project", "Linux server hardening"), description: "Hardened Linux servers with CIS benchmarks." },
      { ...item("b", "skill", "Linux server hardening"), description: "Hardened Linux servers with CIS benchmarks." },
      ...rest,
    ];
    const ids = findAllDuplicates(items).map((f) => [...(f.itemIds ?? [])].sort().join("|"));

    expect(new Set(ids).size).toBe(ids.length);
  });
});
