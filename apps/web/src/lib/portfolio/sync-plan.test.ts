import { describe, expect, it } from "vitest";

import { isSameEntry } from "@careeros/portfolio";

import { planEvidenceSync, type ExistingEntry, type SyncCandidate } from "./sync-plan";

/**
 * Projects are no longer seeded from evidence at all (they need an artefact a record cannot
 * carry), so what sync handles is experience, education, certifications and skills — where the
 * CMS's own section-scoped check is deterministic: section, organisation, years and title.
 *
 * Codex C15-03: a resemblance is not identity. Two different jobs scored 0.55 on shared
 * vocabulary alone, and linking on that writes false provenance AND hides the record from every
 * later sync. Only a deterministic match links now.
 */
const site: ExistingEntry[] = [
  {
    id: "item-spark",
    evidenceItemId: null,
    section: "experience",
    title: "IT Support Consultant",
    subtitle: "Spark Technomedia",
    dateRange: "Jan 2026 — Aug 2026",
    description: "Handled user support tickets for hardware, software and access issues.",
  },
  {
    id: "item-crozaint",
    evidenceItemId: null,
    section: "experience",
    title: "Junior DevOps Engineer Trainee",
    subtitle: "Crozaint Technologies",
    dateRange: "Jan 2024 — Jun 2024",
    description: "Python automation scripts; supported Windows and Microsoft 365 desktops.",
  },
];

const candidate = (over: Partial<SyncCandidate> & { evidenceItemId: string; title: string }): SyncCandidate => ({
  section: "experience",
  subtitle: null,
  dateRange: null,
  description: null,
  ...over,
});

const sameEntry = (c: SyncCandidate, e: ExistingEntry) => isSameEntry(c, e);

describe("planEvidenceSync", () => {
  it("links the record to the entry that is deterministically the same job", () => {
    const plan = planEvidenceSync(
      [
        candidate({
          evidenceItemId: "ev-spark",
          title: "IT Support Consultant",
          subtitle: "Spark Technomedia",
          dateRange: "Jan 2026 — Aug 2026",
          description: "Resolved Linux service and configuration problems.",
        }),
      ],
      site,
      { have: new Set(), sameEntry }
    );

    expect(plan.create).toEqual([]);
    expect(plan.link).toEqual([{ itemId: "item-spark", evidenceItemId: "ev-spark" }]);
  });

  it("C15-03: shared vocabulary alone links nothing", () => {
    // Different employer, different role, same industry words — exactly the pair Codex scored at
    // 0.55. It is added as its own entry, which the person can see, rather than silently
    // attached to someone else's job forever.
    const plan = planEvidenceSync(
      [
        candidate({
          evidenceItemId: "ev-other",
          title: "Systems Support Engineer",
          subtitle: "Another Company",
          dateRange: "2022",
          description: "Windows, systems, networks and cloud support for end users.",
        }),
      ],
      site,
      { have: new Set(), sameEntry }
    );

    expect(plan.link).toEqual([]);
    expect(plan.create.map((c) => c.evidenceItemId)).toEqual(["ev-other"]);
  });

  it("does not let two records claim one entry", () => {
    const twice = [
      candidate({
        evidenceItemId: "ev-a",
        title: "IT Support Consultant",
        subtitle: "Spark Technomedia",
        dateRange: "Jan 2026 — Aug 2026",
      }),
      candidate({
        evidenceItemId: "ev-b",
        title: "IT Support Consultant",
        subtitle: "Spark Technomedia",
        dateRange: "Jan 2026 — Aug 2026",
      }),
    ];
    const plan = planEvidenceSync(twice, site, { have: new Set(), sameEntry });

    expect(plan.link).toHaveLength(1);
    expect(plan.alreadyShown).toBe(2);
    expect(plan.create).toEqual([]);
  });

  it("leaves an entry that already knows its evidence alone", () => {
    const linked = site.map((x) => (x.id === "item-spark" ? { ...x, evidenceItemId: "ev-old" } : x));
    const plan = planEvidenceSync(
      [
        candidate({
          evidenceItemId: "ev-spark",
          title: "IT Support Consultant",
          subtitle: "Spark Technomedia",
          dateRange: "Jan 2026 — Aug 2026",
        }),
      ],
      linked,
      { have: new Set(), sameEntry }
    );

    expect(plan.link).toEqual([]);
    expect(plan.create).toEqual([]);
    expect(plan.alreadyShown).toBe(1);
  });

  it("respects a record the person removed from their site on purpose", () => {
    const plan = planEvidenceSync(
      [candidate({ evidenceItemId: "ev-x", title: "Anything" })],
      site,
      { have: new Set(), dismissed: new Set(["fact-x"]), factOf: () => "fact-x", sameEntry }
    );
    expect(plan).toMatchObject({ create: [], link: [], alreadyShown: 0 });
  });

  it("skips a record whose entry is already attached", () => {
    const plan = planEvidenceSync(
      [candidate({ evidenceItemId: "ev-spark", title: "Anything" })],
      site,
      { have: new Set(["ev-spark"]), sameEntry }
    );
    expect(plan).toMatchObject({ create: [], link: [], alreadyShown: 0 });
  });
});
