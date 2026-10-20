import { describe, expect, it } from "vitest";
import type { EvidenceItem } from "@careeros/database";
import { formatCareerRecords, selectCareerRecords, type Selection } from "./selection";
import { resumeFromCareerRecords } from "./resume-from-records";
import { emptyResume } from "@/lib/documents/resume";
const row = (id: string, extra = {}): EvidenceItem => ({
  id,
  factId: null,
  userId: "owner",
  kind: "experience",
  title: `Support ${id}`,
  organization: "Real employer",
  period: "2024",
  detail: "Resolved incidents.",
  metrics: null,
  attribution: "employment",
  tags: ["linux"],
  marketTags: [],
  updatedAt: new Date(0),
  createdAt: new Date(0),
  origin: "manual",
  reviewStatus: "accepted",
  reviewTargetId: null,
  reviewReasons: [],
  distinctFrom: [],
  isCanonical: true,
  renderingFor: null,
  ...extra,
});
const choice = (factId: string, mode: Selection["mode"], keepWording = false): Selection => ({
  factId,
  mode,
  keepWording,
  sortOrder: 0,
});
const select = (
  rows: EvidenceItem[],
  direction: Selection[] = [],
  application: Selection[] = [],
  limit = 8
) => selectCareerRecords(rows, direction, application, { role: "IT support" }, limit);
describe("career selection policy used by production context", () => {
  it("application choice overrides direction and a direction exclusion never enters Auto", () => {
    const result = select(
      [row("a"), row("b"), row("c")],
      [choice("a", "exclude"), choice("b", "include")],
      [choice("b", "exclude"), choice("c", "include")]
    );
    expect(result.selected.map((r) => r.factId)).toEqual(["c"]);
  });
  it("explicit includes survive the automatic context cap", () => {
    const rows = Array.from({ length: 12 }, (_, i) => row(String(i)));
    const result = select(
      rows,
      rows.map((r) => choice(r.id, "include")),
      [],
      2
    );
    expect(result.selected).toHaveLength(12);
    expect(select(rows, [], [], 2).selected).toHaveLength(2);
  });
  it("pending, discarded, unclassified and superseded rows are not selectable even when included", () => {
    const rows = [
      row("pending", { reviewStatus: "pending" }),
      row("discarded", { reviewStatus: "discarded" }),
      row("unknown", { kind: "unclassified" }),
      row("variant", { isCanonical: false }),
      row("cert", { kind: "certification" }),
    ];
    const result = select(
      rows,
      rows.map((r) => choice(r.id, "include"))
    );
    expect(result.selected.map((r) => r.factId)).toEqual(["cert"]);
    expect(result.held).toBe(4);
  });
  it("holds both heads of a corrupt canonical group instead of silently picking one", () => {
    expect(
      select([row("a", { factId: "same" }), row("b", { factId: "same" })]).selected
    ).toHaveLength(0);
  });
  it("keeps the chosen description even when the model rewrites it and drops its certification", () => {
    const { selected } = select(
      [
        row("a"),
        row("cert", { title: "Linux certification", kind: "certification" }),
        row("p", { kind: "project", title: "Home lab" }),
      ],
      [choice("a", "include", true), choice("p", "include", true)]
    );
    const result = resumeFromCareerRecords(
      selected,
      {
        summary: "IT support",
        experiences: [
          {
            title: "Support a",
            company: "Real employer",
            period: "2024",
            location: "Invented city",
            bullets: ["Different wording"],
          },
          {
            title: "Director",
            company: "Invented employer",
            period: "2026",
            location: "",
            bullets: ["Invented"],
          },
        ],
        education: [],
        projects: [{ title: "Home lab", url: "https://invented.test", description: "Rewritten" }],
        skills: ["Fabricated credential"],
      },
      emptyResume().personal
    );
    expect(result.experiences).toHaveLength(1);
    expect(result.experiences[0]).toMatchObject({
      company: "Real employer",
      bullets: "Resolved incidents.",
      location: "",
    });
    expect(result.certifications[0].name).toBe("Linux certification");
    expect(result.projects[0]).toMatchObject({ description: "Resolved incidents.", url: "" });
    expect(result.skills).toBe("linux");
  });
  it("includes attribution and recorded skills without calling acceptance verification", () => {
    const block = formatCareerRecords(select([row("a")]).selected);
    expect(block).toContain("Attribution: employment");
    expect(block).toContain("Recorded skills: linux");
    expect(block).toContain("not independently verified");
  });
});
