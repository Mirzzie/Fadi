import { describe, expect, it } from "vitest";

import { NO_BACKED_RECORDS } from "./backed-records";
import { emptyResume, parseResume, serializeResume } from "./resume";
import { rewriteResume } from "./rewrite";

/**
 * THE REWRITE PATH ITSELF, under a stubbed model.
 *
 * Codex's S2-R2 and S2-R3 were both about what happens AFTER the model answers — the guard
 * rejecting the person's own work, and the rebuild silently dropping whole sections. Neither
 * shows up in a test of the note wording, so this drives the real function and reads the
 * document that comes out.
 */
const currentResume = () => {
  const data = emptyResume();
  data.personal = { ...data.personal, name: "A Person", headline: "IT Support" };
  data.summary = "Support engineer.";
  data.experiences = [
    {
      id: "e1",
      title: "IT Support Specialist",
      company: "Crozaint Technologies",
      location: "Dublin",
      period: "2024",
      bullets: "Supported Windows and Linux users.",
    },
  ];
  data.certifications = [
    { id: "c1", name: "AWS Solutions Architect", issuer: "Amazon Web Services", date: "2026" },
  ];
  data.interests = [{ id: "i1", name: "Home networking", keywords: "" }];
  return serializeResume(data);
};

const model = (revision: Record<string, unknown>) => ({
  structured: async <T,>(): Promise<T> => revision as T,
});

const baseRevision = {
  personal: { name: "A Person", headline: "IT Support", email: "", phone: "", location: "", links: "" },
  summary: "Support engineer.",
  experiences: [
    {
      title: "IT Support Specialist",
      company: "Crozaint Technologies",
      location: "Dublin",
      period: "2024",
      bullets: ["Supported Windows and Linux users."],
    },
  ],
  education: [],
  skills: ["Linux", "Windows"],
  projects: [],
};

describe("rewriteResume", () => {
  it("S2-R3: keeps sections the revision never covers — certifications survive a change", async () => {
    const result = await rewriteResume(model(baseRevision), currentResume(), "ground", {
      instruction: "Sharpen it for my target role",
      backed: NO_BACKED_RECORDS,
    });

    const after = parseResume(result.content);
    expect(after.certifications.map((c) => c.name)).toEqual(["AWS Solutions Architect"]);
    expect(after.interests.map((i) => i.name)).toEqual(["Home networking"]);
    expect(after.experiences).toHaveLength(1);
  });

  it("S2-R2: works in a project the person's record supports", async () => {
    const result = await rewriteResume(
      model({
        ...baseRevision,
        projects: [{ title: "SOC home lab", description: "Wazuh and Sysmon.", bullets: [] }],
      }),
      currentResume(),
      "ground",
      {
        instruction: "Work in SOC home lab",
        backed: { ...NO_BACKED_RECORDS, projects: [{ title: "SOC home lab" }] },
      }
    );

    expect(parseResume(result.content).projects.map((p) => p.title)).toEqual(["SOC home lab"]);
    expect(result.added).toEqual(["soc home lab"]);
    expect(result.invented).toEqual([]);
  });

  it("still refuses a project their record does not have", async () => {
    const result = await rewriteResume(
      model({
        ...baseRevision,
        projects: [{ title: "Kubernetes platform at Google", description: "Invented.", bullets: [] }],
      }),
      currentResume(),
      "ground",
      { instruction: "Make it stronger", backed: NO_BACKED_RECORDS }
    );

    expect(parseResume(result.content).projects).toHaveLength(0);
    expect(result.invented).toEqual(["kubernetes platform at google"]);
  });

  it("C15-02: asking to drop a job in prose does NOT remove it", async () => {
    // Codex reproduced what the old rule licensed: "Cut one bullet from the IT Support Consultant
    // job" gave the model authority to delete the whole role — the very failure this guard exists
    // for. Removing an entry stays something the person does in the editor.
    const result = await rewriteResume(
      model({ ...baseRevision, experiences: [] }),
      currentResume(),
      "ground",
      { instruction: "Drop the Crozaint Technologies job", backed: NO_BACKED_RECORDS }
    );

    expect(parseResume(result.content).experiences).toHaveLength(1);
    expect(result.restored).toEqual(["crozaint technologies · it support specialist"]);
    expect(result.removed).toEqual([]);
  });

  it("still restores a job dropped without being asked for", async () => {
    const result = await rewriteResume(
      model({ ...baseRevision, experiences: [] }),
      currentResume(),
      "ground",
      { instruction: "Cut it to one page", backed: NO_BACKED_RECORDS }
    );

    expect(parseResume(result.content).experiences).toHaveLength(1);
    expect(result.restored).toEqual(["crozaint technologies · it support specialist"]);
    expect(result.removed).toEqual([]);
  });

  it("keeps the section order the person chose", async () => {
    const data = parseResume(currentResume());
    const moved = [...data.order].reverse();
    const withOrder = serializeResume({ ...data, order: moved });

    const result = await rewriteResume(model(baseRevision), withOrder, "ground", {
      instruction: "Sharpen it",
      backed: NO_BACKED_RECORDS,
    });

    expect(parseResume(result.content).order).toEqual(moved);
  });
});
