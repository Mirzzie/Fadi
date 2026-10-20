import { describe, expect, it } from "vitest";

import { buildPracticeHome, type PracticeCommitment, type PracticeRun } from "./practice-home";

function run(id: string, over: Partial<PracticeRun> = {}): PracticeRun {
  return {
    id,
    title: `Project ${id}`,
    status: "active",
    commitmentId: null,
    steps: [
      { ordinal: 1, title: "Install", status: "done" },
      { ordinal: 2, title: "Configure", status: "pending" },
    ],
    ...over,
  };
}

function commitment(id: string, over: Partial<PracticeCommitment> = {}): PracticeCommitment {
  return {
    id,
    gap: `Gap ${id}`,
    title: `Course ${id}`,
    kind: "course",
    status: "committed",
    ...over,
  };
}

const empty = { runs: [], commitments: [], gaps: [], route: [] };

describe("buildPracticeHome", () => {
  it("continues the newest active project, at its next pending step", () => {
    const home = buildPracticeHome({ ...empty, runs: [run("old"), run("new")] });
    expect(home.continue).toMatchObject({
      kind: "run",
      run: { id: "new" },
      next: { ordinal: 2, title: "Configure" },
      total: 2,
    });
    expect(home.browse.runs.map((r) => r.id)).toEqual(["old"]);
  });

  it("never offers a finished or dropped project as the thing to continue", () => {
    const home = buildPracticeHome({
      ...empty,
      runs: [run("a", { status: "done" }), run("b", { status: "abandoned" })],
    });
    expect(home.continue).toBeNull();
    expect(home.browse.runs).toEqual([]);
    expect(home.browse.finished).toEqual(["Project a"]);
  });

  it("falls back to an open commitment with no project behind it", () => {
    const home = buildPracticeHome({ ...empty, commitments: [commitment("x"), commitment("y")] });
    expect(home.continue).toMatchObject({ kind: "commitment", commitment: { id: "x" } });
    expect(home.browse.commitments.map((c) => c.id)).toEqual(["y"]);
  });

  it("does not list a commitment separately from the project that fulfils it", () => {
    const home = buildPracticeHome({
      ...empty,
      runs: [run("r", { commitmentId: "linked" }), run("legacy", { title: "SIEM home lab" })],
      commitments: [
        commitment("linked"),
        // Planned before runs carried their commitment id; the title is the only link.
        commitment("old", { title: "SIEM Home Lab" }),
        commitment("free"),
      ],
    });
    expect(home.browse.commitments.map((c) => c.id)).toEqual(["free"]);
  });

  it("recommends the first gap nothing is being done about, and says where it sits in the route", () => {
    const home = buildPracticeHome({
      ...empty,
      commitments: [commitment("c", { gap: "Terraform" })],
      gaps: [
        { title: "Terraform", detail: "IaC" },
        { title: "Kubernetes", detail: "Orchestration" },
        { title: "Monitoring", detail: "Observability" },
      ],
      route: [{ title: "Terraform" }, { title: "kubernetes" }],
    });
    expect(home.recommended).toEqual({
      kind: "gap",
      gap: { title: "Kubernetes", detail: "Orchestration" },
      routeStep: 2,
    });
    expect(home.browse.gaps.map((g) => g.title)).toEqual(["Monitoring"]);
  });

  it("recommends the blueprint rather than demanding a report", () => {
    expect(buildPracticeHome(empty).recommended).toEqual({
      kind: "blueprint",
      reason: "no-report",
    });
  });

  it("says so when every gap already has work against it", () => {
    const home = buildPracticeHome({
      ...empty,
      commitments: [commitment("c", { gap: "Terraform", status: "completed" })],
      gaps: [{ title: "Terraform", detail: "IaC" }],
    });
    expect(home.recommended).toEqual({ kind: "blueprint", reason: "all-covered" });
    expect(home.browse.gaps).toEqual([]);
  });
});
