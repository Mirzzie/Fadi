import { describe, expect, it } from "vitest";

import { explicitRemovals, inventedNote, restoreDropped, restoredNote } from "./revision-guard";

const KEYS = ["company", "title"] as const;

describe("a rewrite cannot delete a job", () => {
  const before = [
    { company: "Hexastack Solutions", title: "IT Support Specialist", bullets: "a" },
    { company: "Crozaint Technologies", title: "Junior DevOps Engineer Trainee", bullets: "b" },
    { company: "F13 Technologies", title: "AWS Cloud Intern", bullets: "c" },
  ];

  it("THE REPORTED LOSS: a dropped employer is put back, and named", () => {
    // 20 Sep: "lead with the Linux and cloud work" returned a résumé without the most recent
    // role at all, and nothing noticed.
    const after = [before[2], before[1]];
    const result = restoreDropped(before, after, KEYS);
    expect(result.entries.map((e) => e.company)).toContain("Hexastack Solutions");
    expect(result.restored).toEqual(["hexastack solutions · it support specialist"]);
    expect(restoredNote(result.restored)).toMatch(/Fadi kept/);
  });

  it("keeps the rewrite's order for everything it did return", () => {
    const after = [before[2], before[1], before[0]];
    expect(restoreDropped(before, after, KEYS).entries.map((e) => e.company)).toEqual([
      "F13 Technologies",
      "Crozaint Technologies",
      "Hexastack Solutions",
    ]);
  });

  it("reworded bullets are not a deletion — the entry is matched by who and what", () => {
    const after = [
      { company: "Hexastack Solutions", title: "IT Support Specialist", bullets: "rewritten" },
      before[1],
      before[2],
    ];
    const result = restoreDropped(before, after, KEYS);
    expect(result.restored).toEqual([]);
    expect(result.entries[0].bullets).toBe("rewritten");
  });

  it("says nothing when nothing was lost", () => {
    expect(restoredNote([])).toBe("");
    expect(restoreDropped(before, before, KEYS).restored).toEqual([]);
  });

  it("an entry with no identifying fields is kept rather than quietly lost", () => {
    const withBlank = [...before, { company: "", title: "", bullets: "x" }];
    expect(restoreDropped(withBlank, before, KEYS).entries).toHaveLength(4);
  });
});

describe("a rewrite cannot invent a job either", () => {
  const KEYS2 = ["company", "title"] as const;
  const before = [
    { company: "Hexastack Solutions, India", title: "IT Support Specialist" },
    { company: "Crozaint Technologies Pvt Ltd, India", title: "Junior DevOps Engineer Trainee" },
  ];

  it("THE REPORTED DUPLICATION: a tidied company name is the same job, not a new one", () => {
    // 21 Sep: "Crozaint Technologies Pvt Ltd, India" came back as "Crozaint Technologies Pvt
    // Ltd", so the guard restored the original and the résumé listed six roles for three jobs.
    const after = [
      { company: "Crozaint Technologies Pvt Ltd", title: "Junior DevOps Engineer Trainee" },
      { company: "Hexastack Solutions", title: "IT Support Specialist" },
    ];
    const result = restoreDropped(before, after, KEYS2);
    expect(result.entries).toHaveLength(2);
    expect(result.restored).toEqual([]);
    expect(result.invented).toEqual([]);
  });

  it("an employer taken from somewhere else is removed and named", () => {
    // The model replaced an employer with a company from the person's OTHER résumé.
    const after = [
      { company: "Spark Technomedia", title: "IT Support Consultant" },
      before[1],
    ];
    const result = restoreDropped(before, after, KEYS2);
    expect(result.invented).toEqual(["spark technomedia · it support consultant"]);
    expect(result.entries.map((e) => e.company)).toEqual([
      "Hexastack Solutions, India",
      "Crozaint Technologies Pvt Ltd, India",
    ]);
    expect(inventedNote(result.invented)).toMatch(/can't add to your history/);
  });

  it("a reworded job title on the same employer is still the same job", () => {
    const after = [{ company: "Hexastack Solutions, India", title: "IT Support Specialist" }];
    expect(restoreDropped(before, after, KEYS2).invented).toEqual([]);
  });
});

describe("what the rewrite is allowed to change (S2-R2)", () => {
  const before = [
    { company: "Crozaint Technologies", title: "IT Support Specialist", bullets: ["Windows."] },
    { company: "Retail Co", title: "Sales Assistant", bullets: ["Served customers."] },
  ];

  it("keeps an entry the person's record supports — the change Fadi itself offers", () => {
    const after = [
      ...before,
      { company: "", title: "SOC home lab", bullets: ["Wazuh and Sysmon."] },
    ];
    const result = restoreDropped(before, after, ["company", "title"], {
      backed: [{ company: "", title: "SOC home lab" }],
    });
    expect(result.entries).toHaveLength(3);
    expect(result.added).toEqual(["soc home lab"]);
    expect(result.invented).toEqual([]);
  });

  it("still removes an entry that is in neither the document nor the record", () => {
    const after = [...before, { company: "Google", title: "Staff Engineer", bullets: [] }];
    const result = restoreDropped(before, after, ["company", "title"], {
      backed: [{ company: "", title: "SOC home lab" }],
    });
    expect(result.entries).toHaveLength(2);
    expect(result.invented).toEqual(["google · staff engineer"]);
    expect(result.added).toEqual([]);
  });

  it("honours a removal the person asked for by name", () => {
    const removable = explicitRemovals("Drop the Retail Co job, it's not relevant", before, [
      "company",
      "title",
    ]);
    const result = restoreDropped(before, [before[0]], ["company", "title"], { removable });
    expect(result.entries).toHaveLength(1);
    expect(result.removed).toEqual(["retail co · sales assistant"]);
    expect(result.restored).toEqual([]);
  });

  it("restores a silent omission even when something else was asked to be removed", () => {
    const removable = explicitRemovals("Remove the Retail Co job", before, ["company", "title"]);
    const result = restoreDropped(before, [], ["company", "title"], { removable });
    expect(result.entries).toHaveLength(1);
    expect(result.restored).toEqual(["crozaint technologies · it support specialist"]);
    expect(result.removed).toEqual(["retail co · sales assistant"]);
  });
});

describe("explicitRemovals", () => {
  const before = [
    { company: "Deloitte", title: "Analyst" },
    { company: "Crozaint Technologies", title: "IT Support Specialist" },
  ];

  it("recognises the entry named alongside a removal verb", () => {
    expect(explicitRemovals("drop the Deloitte role", before, ["company", "title"])).toEqual([
      "deloitte · analyst",
    ]);
    expect(explicitRemovals("please remove the analyst job", before, ["company", "title"])).toEqual([
      "deloitte · analyst",
    ]);
  });

  it("does not treat shortening as deleting history", () => {
    expect(explicitRemovals("cut it to one page", before, ["company", "title"])).toEqual([]);
    expect(explicitRemovals("trim the bullets", before, ["company", "title"])).toEqual([]);
    expect(explicitRemovals("make it shorter", before, ["company", "title"])).toEqual([]);
  });

  it("needs a removal verb, not just the name", () => {
    expect(explicitRemovals("lead with the Deloitte work", before, ["company", "title"])).toEqual([]);
  });

  it("removes nothing when the instruction names nothing it has", () => {
    expect(explicitRemovals("drop the marketing section", before, ["company", "title"])).toEqual([]);
  });
});
