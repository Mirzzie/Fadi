import { describe, expect, it } from "vitest";

import { backedRecords } from "./backed-records";

describe("backedRecords", () => {
  it("puts each record in the section a résumé would show it in", () => {
    const backed = backedRecords([
      { kind: "experience", title: "IT Support Specialist", organization: "Crozaint" },
      { kind: "education", title: "BSc Computing", organization: "TU Dublin" },
      { kind: "project", title: "SOC home lab", organization: null },
    ]);
    expect(backed.experiences).toEqual([{ company: "Crozaint", title: "IT Support Specialist" }]);
    expect(backed.education).toEqual([{ school: "TU Dublin", degree: "BSc Computing" }]);
    expect(backed.projects).toEqual([{ title: "SOC home lab" }]);
  });

  it("does not let a certification back an experience — a certificate is not a job", () => {
    const backed = backedRecords([
      { kind: "certification", title: "AWS Solutions Architect", organization: "Amazon" },
      { kind: "unclassified", title: "Something", organization: "Somewhere" },
    ]);
    expect(backed).toEqual({ experiences: [], education: [], projects: [] });
  });

  it("ignores a record with no title, which could match anything", () => {
    expect(backedRecords([{ kind: "project", title: "  ", organization: "X" }]).projects).toEqual([]);
  });
});
