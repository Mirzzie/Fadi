import { describe, expect, it } from "vitest";

import { admitAgainst, toIdentity, type Candidate } from "./admit";
import { admitPortfolioItems } from "@/lib/portfolio/admit-items";

/**
 * PREVENTION, not detection.
 *
 * Every duplicate in the user's real portfolio scored "maybe", never "same". The old
 * rule created on a maybe and left a check to find it afterwards — by which time two
 * copies of one project were on a public site and in every generated document.
 */
const pool: Candidate[] = [
  {
    kind: "project",
    title: "WordPress on AWS + Ansible",
    detail: "Deployed a WordPress stack on an AWS EC2 instance, provisioned with Ansible.",
  },
  {
    kind: "project",
    title: "OpenClaw · Home SOC",
    organization: "Proxmox Homelab",
    detail: "A self-hosted security-operations lab — Wazuh and Suricata on Proxmox VE.",
  },
  {
    kind: "project",
    title: "n8n Cyber-News Pipeline",
    organization: "Raspberry Pi",
    detail: "An n8n workflow summarising security news each morning.",
  },
  {
    kind: "project",
    title: "Self-Hosted Nextcloud",
    organization: "Raspberry Pi",
    detail: "A private Nextcloud file store on the home network with per-user accounts.",
  },
  {
    kind: "project",
    title: "CTF & Forensics Practice",
    organization: "TryHackMe",
    detail: "Rooms covering forensics, privilege escalation and web exploitation.",
  },
];
const asPool = () => pool.map((c, i) => toIdentity(c, `p${i}`));
const identity = (id: string) => ({ factId: id });

describe("the admission gate", () => {
  it("absorbs a re-worded project instead of creating a second one", () => {
    const rewrite: Candidate = {
      kind: "project",
      title: "Automated WordPress Deployment on AWS",
      detail: "Automated the deployment of a WordPress stack onto EC2 using Ansible.",
    };
    const verdict = admitAgainst(rewrite, asPool(), identity);

    expect(verdict.decision).toBe("absorb");
    if (verdict.decision === "absorb") expect(verdict.intoId).toBe("p0");
  });

  it("flags an uncertain link so it can be questioned, not buried", () => {
    // Being strict is only safe because being wrong is cheap AND visible. A "maybe"
    // keeps every word it arrived with and is marked for the background pass to ask about.
    const verdict = admitAgainst(
      {
        kind: "project",
        title: "Private Network Storage & Identity Management",
        detail: "A private Nextcloud file store with accounts and access control on the home network.",
      },
      asPool(),
      identity,
    );

    expect(verdict.decision).toBe("absorb");
    if (verdict.decision === "absorb") {
      expect(verdict.sure).toBe(false);
      expect(verdict.reasons.length).toBeGreaterThan(0);
    }
  });

  it("lets genuinely new work through", () => {
    const verdict = admitAgainst(
      { kind: "project", title: "Payroll migration", detail: "Moved payroll to a new provider for the finance team." },
      asPool(),
      identity,
    );

    expect(verdict.decision).toBe("create");
  });

  it("does not confuse a skill with a project of the same name", () => {
    const verdict = admitAgainst(
      { kind: "skill", title: "Ansible", detail: "Configuration management." },
      asPool(),
      identity,
    );

    expect(verdict.decision).toBe("create");
  });
});

describe("batch admission into the portfolio", () => {
  const existing = pool.map((c, i) => ({
    id: `e${i}`,
    section: c.kind,
    title: c.title,
    subtitle: c.organization ?? null,
    dateRange: null,
    description: c.detail ?? null,
  }));

  it("holds back a re-worded item and names what it matched", () => {
    const incoming = [
      { section: "project", title: "Automated WordPress Deployment on AWS", description: "Automated a WordPress stack onto EC2 with Ansible." },
      { section: "project", title: "Payroll migration", description: "Moved payroll to a new provider." },
    ];
    const { keep, heldBack } = admitPortfolioItems(incoming, existing);

    expect(keep.map((k) => k.title)).toEqual(["Payroll migration"]);
    expect(heldBack[0].matches).toBe("WordPress on AWS + Ansible");
  });

  it("catches a file that contains the same project twice", () => {
    // An import is compared against what it has already admitted, not just what was
    // there before — otherwise one file can duplicate itself in a single pass.
    const twice = [
      { section: "project", title: "Payroll migration", description: "Moved payroll to a new provider for finance." },
      { section: "project", title: "Payroll provider migration", description: "Migrated the payroll system to a new provider for the finance team." },
    ];
    const { keep } = admitPortfolioItems(twice, existing);

    expect(keep).toHaveLength(1);
  });

  it("admits everything when the portfolio is empty", () => {
    const incoming = [{ section: "project", title: "Anything", description: "First item." }];

    expect(admitPortfolioItems(incoming, []).keep).toHaveLength(1);
  });
});

describe("the two-way route — a document edited elsewhere and brought back", () => {
  const standing: Candidate & { origin: string } = {
    kind: "project",
    title: "Shield-Right DevSecOps",
    organization: "MSc Dissertation",
    detail: "Runtime protection and drift detection, IAST vs RASP on OWASP Juice Shop.",
    origin: "ai",
  };
  const poolWith = (c: Candidate & { origin: string }) => [toIdentity(c, "e0"), ...asPool()];
  const metaWith = (c: Candidate & { origin: string }) => (id: string) =>
    id === "e0" ? { factId: "e0", origin: c.origin, detail: c.detail } : { factId: id };

  it("lets an edit you made in another tool take the lead", () => {
    // THE HOLE THIS CLOSES. Sharpen a description in M365, bring it back, and the gate
    // used to file it as a non-leading rewording — stored, and invisible, while the
    // older wording carried on leading everywhere.
    const edited = { ...standing, detail: "Compared IAST and RASP under load on OWASP Juice Shop; RASP blocked 100% of SQLi with <3ms overhead.", origin: "upload" };
    const verdict = admitAgainst(edited, poolWith(standing), metaWith(standing));

    expect(verdict.decision).toBe("update");
    if (verdict.decision === "update") expect(verdict.intoId).toBe("e0");
  });

  it("never lets Fadi's own extraction overwrite what is leading", () => {
    // Extraction runs on its own schedule. If it could displace the leading wording it
    // would quietly rewrite the user's history behind them.
    const regenerated = { ...standing, detail: "A dissertation project about DevSecOps.", origin: "ai" };
    const verdict = admitAgainst(regenerated, poolWith(standing), metaWith(standing));

    expect(verdict.decision).toBe("absorb");
  });

  it("refuses to choose between two versions you wrote yourself", () => {
    // Both human-authored and different: a real disagreement. Picking a winner would
    // silently discard one of the user's own decisions.
    const typedInFadi = { ...standing, origin: "manual" };
    const fromWord = { ...typedInFadi, detail: "A different account of the same project.", origin: "upload" };
    const verdict = admitAgainst(fromWord, poolWith(typedInFadi), metaWith(typedInFadi));

    expect(verdict.decision).toBe("absorb");
    if (verdict.decision === "absorb") expect(verdict.conflict).toBe(true);
  });

  it("treats an unchanged re-upload as nothing to do", () => {
    // Re-uploading the same CV must not raise a conflict on every project in it.
    const typedInFadi = { ...standing, origin: "manual" };
    const identical = { ...typedInFadi, origin: "upload" };
    const verdict = admitAgainst(identical, poolWith(typedInFadi), metaWith(typedInFadi));

    expect(verdict.decision).toBe("absorb");
    if (verdict.decision === "absorb") expect(verdict.conflict).toBeUndefined();
  });

  it("still creates genuinely new work arriving from the same document", () => {
    const brandNew = { kind: "project", title: "Payroll migration", detail: "Moved payroll to a new provider.", origin: "upload" };
    expect(admitAgainst(brandNew, poolWith(standing), metaWith(standing)).decision).toBe("create");
  });
});
