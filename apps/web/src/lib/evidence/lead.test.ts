import { describe, expect, it } from "vitest";

import { chooseLeadEvidence } from "./lead";
import type { EvidenceView } from "./pool";

const item = (over: Partial<EvidenceView>): EvidenceView => ({
  id: Math.random().toString(36).slice(2),
  kind: "experience",
  title: "Untitled",
  organization: null,
  period: null,
  detail: "",
  metrics: null,
  tags: [],
  marketTags: [],
  origin: "manual",
  ...over,
});

// A pool that spans exactly the breadth the reviewer flagged: IT ops, cloud,
// DevOps and security in one history.
const soc = item({
  title: "Home SOC lab",
  detail: "Ran a detection lab, triaged alerts end to end.",
  tags: ["wazuh", "suricata"],
  marketTags: ["siem", "incident triage"],
});
const cloud = item({
  // Overlaps this posting on incidental prose ("runbooks") but on none of its
  // named skills — the shape that should be held back, not led with.
  title: "Azure migration support",
  detail: "Moved file shares and wrote runbooks for the team.",
  tags: ["azure"],
  marketTags: ["cloud migration"],
});
const helpdesk = item({
  title: "IT support technician",
  detail: "First-line desktop support for 200 staff.",
  tags: ["helpdesk"],
  marketTags: ["service desk"],
});

const socRole = {
  title: "Junior SOC Analyst",
  description: "Monitor security alerts in our SIEM. Incident triage, escalation, and runbooks.",
};

// ALL of the user's directions, including the one this posting belongs to — the
// posting is matched against them to find its spine.
const directions = [
  { role: "SOC Analyst", domain: "siem incident triage security" },
  { role: "Cloud Engineer", domain: "cloud migration azure" },
  { role: "IT Support", domain: "service desk helpdesk" },
];

describe("chooseLeadEvidence", () => {
  it("identifies which of the user's directions the posting actually is", () => {
    const d = chooseLeadEvidence([soc, cloud, helpdesk], socRole, directions);

    expect(d.spineDirection).toBe("SOC Analyst");
  });

  it("leads with the evidence belonging to that direction", () => {
    const d = chooseLeadEvidence([cloud, helpdesk, soc], socRole, directions);

    expect(d.lead[0]?.item.title).toBe("Home SOC lab");
    expect(d.lead[0]?.named).toEqual(expect.arrayContaining(["siem"]));
    expect(d.spine).toEqual(expect.arrayContaining(["siem"]));
  });

  it("produces a decision, not a score — every pick carries a plain-language reason", () => {
    const d = chooseLeadEvidence([cloud, helpdesk, soc], socRole, directions);

    for (const pick of [...d.lead, ...d.support, ...d.holdBack, ...d.untranslated]) {
      expect(pick.reason.length).toBeGreaterThan(0);
    }
  });

  it("holds back evidence that belongs to another direction, and says which", () => {
    const d = chooseLeadEvidence([cloud, helpdesk, soc], socRole, directions);

    const azure = d.holdBack.find((p) => p.item.title === "Azure migration support");
    expect(azure).toBeDefined();
    expect(azure?.home).toBe("Cloud Engineer");
    expect(azure?.reason).toContain("Cloud Engineer");
  });

  it("NEVER deletes: every item comes back in exactly one bucket", () => {
    const pool = [cloud, helpdesk, soc];
    const d = chooseLeadEvidence(pool, socRole, directions);

    const returned = [...d.lead, ...d.support, ...d.holdBack, ...d.untranslated];
    expect(returned).toHaveLength(pool.length);
    expect(new Set(returned.map((p) => p.item.id)).size).toBe(pool.length);
  });

  it("treats a zero score as UNTRANSLATED, never as hold-back", () => {
    // The load-bearing case: real, strong evidence that shares no words with the
    // posting. Demoting this is the exact failure the translation layer exists to fix.
    const lab = item({
      title: "Proxmox home lab",
      detail: "Built and ran virtualised infrastructure at home.",
      tags: ["proxmox"],
    });
    const d = chooseLeadEvidence([lab], { title: "Junior SOC Analyst", description: "" }, []);

    expect(d.untranslated.map((p) => p.item.title)).toContain("Proxmox home lab");
    expect(d.holdBack).toHaveLength(0);
    expect(d.untranslated[0]?.reason).toContain("untranslated");
  });

  it("caps the lead at three — leading with everything leads with nothing", () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      item({ title: `SIEM work ${i}`, marketTags: ["siem", "incident triage"] })
    );
    const d = chooseLeadEvidence(many, socRole, []);

    expect(d.lead).toHaveLength(3);
    expect(d.support).toHaveLength(3);
  });

  it("flags dilution by naming what it set aside", () => {
    const d = chooseLeadEvidence([soc, cloud, helpdesk], socRole, directions);

    expect(d.spread.diluted).toBe(true);
    expect(d.spread.directions).toContain("Cloud Engineer");
    expect(d.spread.note).toContain("unfocused");
  });

  it("reports focus when everything presented supports one claim", () => {
    const d = chooseLeadEvidence([soc], socRole, directions);

    expect(d.spread.diluted).toBe(false);
    expect(d.spread.note).toContain("Focused");
  });

  it("is JD-length independent — boilerplate can't drown the decision", () => {
    // The failure that killed the first design: an 8000-char posting matched
    // everything, so nothing was ever held back. Padding must not change the call.
    const padded = {
      ...socRole,
      description: `${socRole.description} ${"We offer a competitive salary, pension, healthcare and a supportive team culture. ".repeat(60)}`,
    };
    const d = chooseLeadEvidence([soc, cloud, helpdesk], padded, directions);

    expect(d.spineDirection).toBe("SOC Analyst");
    expect(d.lead[0]?.item.title).toBe("Home SOC lab");
    expect(d.holdBack.map((p) => p.item.title)).toContain("Azure migration support");
  });

  it("NEVER holds back a qualification, a credential or a skills list", () => {
    // Found on real data: the first version told a candidate to hold back their
    // M.Sc. and their bachelor's degree. No careers adviser in any field would
    // give that advice — structural evidence goes on every application.
    const msc = item({
      kind: "education",
      title: "M.Sc. Cybersecurity",
      tags: ["cybersecurity"],
      marketTags: ["information security"],
    });
    // Both belong to the Cloud direction, so both are off-spine here — and both
    // must still survive, because neither competes for the lead.
    const cert = item({
      kind: "achievement",
      title: "AWS Certified Cloud Practitioner",
      detail: "Studied alongside the runbooks work.",
      tags: ["aws"],
      marketTags: ["cloud migration"],
    });
    const skills = item({
      kind: "skill",
      title: "Programming Languages",
      detail: "Used to automate runbooks.",
      tags: ["python"],
      marketTags: ["cloud migration"],
    });
    // Same off-spine home, but a project — this one SHOULD be held back.
    const rivalProject = item({
      kind: "project",
      title: "Azure landing zone build",
      detail: "Runbooks for the platform team.",
      tags: ["azure"],
      marketTags: ["cloud migration"],
    });

    const d = chooseLeadEvidence([soc, msc, cert, skills, rivalProject], socRole, directions);
    const heldTitles = d.holdBack.map((p) => p.item.title);

    expect(heldTitles).not.toContain("M.Sc. Cybersecurity");
    expect(heldTitles).not.toContain("AWS Certified Cloud Practitioner");
    expect(heldTitles).not.toContain("Programming Languages");
    expect(heldTitles).toContain("Azure landing zone build");

    const credential = d.support.find((p) => p.item.title === "AWS Certified Cloud Practitioner");
    expect(credential?.reason).toContain("credential");
    expect(d.support.find((p) => p.item.title === "Programming Languages")?.reason).toContain(
      "skills list"
    );
  });

  it("is career-agnostic — same machinery for a nurse choosing rotations", () => {
    const paeds = item({
      title: "Paediatric ICU placement",
      tags: ["paediatrics"],
      marketTags: ["paediatric intensive care"],
    });
    const theatre = item({
      title: "Theatre rotation",
      tags: ["scrub"],
      marketTags: ["perioperative"],
    });
    const d = chooseLeadEvidence(
      [theatre, paeds],
      { title: "Paediatric Staff Nurse", description: "Paediatric intensive care ward." },
      [
        { role: "Paediatric Nurse", domain: "paediatric intensive care" },
        { role: "Theatre Nurse", domain: "perioperative scrub" },
      ]
    );

    expect(d.spineDirection).toBe("Paediatric Nurse");
    expect(d.lead[0]?.item.title).toBe("Paediatric ICU placement");
  });
});
