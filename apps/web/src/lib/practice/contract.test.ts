import { describe, expect, it } from "vitest";

import {
  environmentForLegacyPlace,
  practiceActivitySchema,
  type PracticeActivity,
} from "./contract";

function activity(
  id: string,
  environment: PracticeActivity["steps"][number]["environment"]["kind"],
  assessment: PracticeActivity["steps"][number]["assessment"]["kind"],
  output: PracticeActivity["steps"][number]["outputs"][number]["kind"]
) {
  return {
    schemaVersion: 1 as const,
    id,
    title: `Practice ${id}`,
    outcome: "Produce a result that another person can review.",
    competencies: ["domain competency"],
    steps: [
      {
        id: "step-1",
        title: "Complete the work",
        instruction: "Follow the activity brief and preserve the result.",
        environment: { kind: environment, adapter: null },
        assessment: { kind: assessment, adapter: null },
        outputs: [{ kind: output, required: true }],
      },
    ],
  };
}

describe("domain-neutral Practice contract", () => {
  it.each([
    ["cybersecurity", "virtual_machine", "machine_predicate", "machine_receipt"],
    ["business-writing", "document", "rubric", "file"],
    ["clinical-scenario", "simulation", "scenario_outcome", "scenario_result"],
    ["external-course", "external_tool", "external_credential", "credential"],
    ["supervised-trade", "physical_world", "attestation", "supervisor_attestation"],
  ] as const)("represents %s without changing the shared journey", (_name, place, check, proof) => {
    expect(practiceActivitySchema.safeParse(activity(_name, place, check, proof)).success).toBe(
      true
    );
  });

  it("keeps environment, assessment and output independent", () => {
    const parsed = practiceActivitySchema.parse(
      activity("sales-role-play", "conversation", "rubric", "media")
    );
    expect(parsed.steps[0]).toMatchObject({
      environment: { kind: "conversation" },
      assessment: { kind: "rubric" },
      outputs: [{ kind: "media" }],
    });
  });

  it("rejects duplicate step identities in a versioned activity", () => {
    const duplicate = activity("duplicate", "document", "submission", "file");
    duplicate.steps.push({ ...duplicate.steps[0] });
    expect(practiceActivitySchema.safeParse(duplicate).success).toBe(false);
  });

  it("maps the old places without guessing an unknown environment", () => {
    expect(environmentForLegacyPlace("lab")).toBe("managed_lab");
    expect(environmentForLegacyPlace("browser")).toBe("browser");
    expect(environmentForLegacyPlace("fadi")).toBe("none");
    expect(environmentForLegacyPlace("future-adapter")).toBe("unspecified");
  });
});
