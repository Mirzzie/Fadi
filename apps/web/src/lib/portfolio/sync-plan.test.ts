import { describe, expect, it } from "vitest";

import { planEvidenceSync, type ExistingEntry, type SyncCandidate } from "./sync-plan";

/** The owner's real portfolio entries — built by hand, with screenshots. */
const site: ExistingEntry[] = [
  {
    id: "item-wordpress",
    evidenceItemId: null,
    section: "project",
    title: "WordPress on AWS + Ansible",
    subtitle: "Cloud Automation",
    dateRange: "2025",
    description:
      "A hardened WordPress stack on AWS EC2, provisioned entirely with Ansible playbooks — repeatable, versioned, torn down as easily as brought up.",
  },
  {
    id: "item-ctf",
    evidenceItemId: null,
    section: "project",
    title: "CTF & Forensics Practice",
    subtitle: "TryHackMe / HTB",
    dateRange: null,
    description:
      "Ongoing capture-the-flag work — web exploitation, mobile forensic evidence recovery, and Linux privilege-escalation labs.",
  },
  {
    id: "item-nextcloud",
    evidenceItemId: null,
    section: "project",
    title: "Self-Hosted Nextcloud",
    subtitle: "Raspberry Pi",
    dateRange: null,
    description: "A private cloud drive on a Raspberry Pi — encrypted file sync for the household.",
  },
];

/** The same work as it arrived from their CV, worded differently. */
const candidate = (over: Partial<SyncCandidate> & { evidenceItemId: string; title: string }): SyncCandidate => ({
  section: "project",
  subtitle: null,
  dateRange: null,
  description: null,
  ...over,
});

describe("planEvidenceSync", () => {
  it("THE POINT: work already on the site is linked, not copied without its screenshots", () => {
    const plan = planEvidenceSync(
      [
        candidate({
          evidenceItemId: "ev-wordpress",
          title: "Automated WordPress Deployment on AWS",
          description:
            "Deployed a WordPress stack on an AWS EC2 instance, provisioned and configured with Ansible.",
        }),
      ],
      site,
      { have: new Set() }
    );

    expect(plan.create).toEqual([]);
    expect(plan.link).toEqual([{ itemId: "item-wordpress", evidenceItemId: "ev-wordpress" }]);
    expect(plan.alreadyShown).toBe(1);
  });

  it("adds work the site does not have yet", () => {
    const plan = planEvidenceSync(
      [
        candidate({
          evidenceItemId: "ev-ad",
          title: "Active Directory & Hybrid IT Network Simulation",
          description: "A Windows domain with group policy, DNS and a hybrid Azure AD join.",
        }),
      ],
      site,
      { have: new Set() }
    );

    expect(plan.create.map((c) => c.evidenceItemId)).toEqual(["ev-ad"]);
    expect(plan.link).toEqual([]);
  });

  it("does not let two records fight over one entry", () => {
    const plan = planEvidenceSync(
      [
        candidate({
          evidenceItemId: "ev-ctf",
          title: "TryHackMe Smol CTF Security Analysis",
          description: "Capture-the-flag rooms: web exploitation and privilege escalation.",
        }),
        candidate({
          evidenceItemId: "ev-forensics",
          title: "WhatsApp Forensic Investigation and Evidence Extraction",
          description: "Mobile forensic evidence recovery and analysis from a device image.",
        }),
      ],
      site,
      { have: new Set() }
    );

    expect(plan.link).toHaveLength(1);
    expect(plan.link[0].itemId).toBe("item-ctf");
    expect(plan.create).toEqual([]); // the second is recognised as the same work, not added
  });

  it("leaves an entry that already knows its evidence alone", () => {
    const linkedSite = site.map((x) =>
      x.id === "item-wordpress" ? { ...x, evidenceItemId: "ev-old" } : x
    );
    const plan = planEvidenceSync(
      [candidate({ evidenceItemId: "ev-wordpress", title: "Automated WordPress Deployment on AWS" })],
      linkedSite,
      { have: new Set() }
    );

    expect(plan.link).toEqual([]);
    expect(plan.create).toEqual([]);
    expect(plan.alreadyShown).toBe(1);
  });

  it("respects a record the person removed from their site on purpose", () => {
    const plan = planEvidenceSync(
      [candidate({ evidenceItemId: "ev-nextcloud", title: "Private Network Storage Deployment" })],
      site,
      { have: new Set(), dismissed: new Set(["fact-nextcloud"]), factOf: () => "fact-nextcloud" }
    );

    expect(plan).toMatchObject({ create: [], link: [], alreadyShown: 0 });
  });

  it("skips a record whose entry is already attached", () => {
    const plan = planEvidenceSync(
      [candidate({ evidenceItemId: "ev-wordpress", title: "Anything at all" })],
      site,
      { have: new Set(["ev-wordpress"]) }
    );
    expect(plan).toMatchObject({ create: [], link: [], alreadyShown: 0 });
  });
});
