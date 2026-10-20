import { beforeEach, describe, expect, it, vi } from "vitest";
import { specForProject, templateForProject } from "./spec-from-project";

const mocks = vi.hoisted(() => ({
  structured: vi.fn(),
  list: vi.fn(),
  save: vi.fn(),
  probe: vi.fn(),
}));
vi.mock("@/lib/ai/user-generate", () => ({
  AiRateLimitError: class extends Error {},
  getUserDocGenerate: async () => ({ structured: mocks.structured }),
}));
vi.mock("@/lib/database/client", () => ({ getDatabase: () => ({}) }));
vi.mock("@/lib/observability/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));
vi.mock("@careeros/database", () => ({
  createLabResourcesRepository: () => ({ listForUser: mocks.list }),
  createProjectRunsRepository: () => ({ createWithSteps: mocks.save }),
  createCareerProfilesRepository: () => ({ getActiveForUser: async () => ({ id: "track-1" }) }),
}));
// This entry point used to launch a disposable Docker container during planning.
vi.mock("./broker", () => ({ packagesMissingFrom: mocks.probe }));

const steps = [
  { title: "Install", instruction: "apk add openssl", verify: "openssl version", produces: "" },
  {
    title: "Configure",
    instruction: "Edit the nginx configuration",
    verify: "nginx -t",
    produces: "nginx.conf",
  },
  { title: "Observe", instruction: "Request the page", verify: "HTTP 200", produces: "response" },
];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue([]);
  mocks.save.mockResolvedValue({ run: { id: "saved-run" } });
  mocks.probe.mockResolvedValue({ checked: true, missing: [] });
  mocks.structured.mockReset();
  mocks.structured.mockResolvedValue({ steps });
});

describe("planning does not provision", () => {
  it("saves an install plan without launching a package-check container", async () => {
    const { planProjectRun } = await import("./plan-run");
    const result = await planProjectRun("u1", { title: "Nginx TLS practice" });
    expect(result).toEqual({ ok: true, plan: { runId: "saved-run", steps: 3 } });
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.probe).not.toHaveBeenCalled();
  });

  it("a new project belongs to the direction it was planned under", async () => {
    // Reported: after switching from SOC Analyst to IT System Administrator, SOC labs still
    // showed, because projects recorded no direction at all.
    const { planProjectRun } = await import("./plan-run");
    await planProjectRun("u1", { title: "Nginx TLS practice" });
    expect(mocks.save.mock.calls[0][1]).toMatchObject({ careerProfileId: "track-1" });
  });

  it("does not require an eligible local host for a hosted-console project", async () => {
    mocks.list.mockResolvedValue([
      {
        id: "pi",
        label: "Pi",
        kind: "sbc",
        arch: "arm64",
        memoryMb: 4096,
        diskGb: 32,
        virtualization: "containers",
        alwaysOn: false,
      },
    ]);
    const { planProjectRun } = await import("./plan-run");
    const result = await planProjectRun("u1", {
      title: "ServiceNow",
      detail: "Document Windows Server incidents in a developer instance",
    });
    expect(result.ok).toBe(true);
    expect(mocks.save).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ resourceId: null }),
      expect.any(Array)
    );
  });

  it("still repairs a wrong distribution once and saves the repaired steps", async () => {
    mocks.structured.mockResolvedValueOnce({
      steps: steps.map((s) => ({ ...s, instruction: "apt-get install nginx" })),
    });
    const { planProjectRun } = await import("./plan-run");
    const result = await planProjectRun("u1", { title: "Nginx TLS practice" });
    expect(result.ok).toBe(true);
    expect(mocks.structured).toHaveBeenCalledTimes(2);
    expect(mocks.save.mock.calls[0][2][0].instruction).toBe("apk add openssl");
    expect(mocks.probe).not.toHaveBeenCalled();
  });

  it("does not save a plan that still contradicts the distribution after repair", async () => {
    mocks.structured.mockResolvedValue({
      steps: steps.map((s) => ({ ...s, instruction: "apt-get install nginx" })),
    });
    const { planProjectRun } = await import("./plan-run");
    expect((await planProjectRun("u1", { title: "Nginx TLS practice" })).ok).toBe(false);
    expect(mocks.structured).toHaveBeenCalledTimes(2);
    expect(mocks.save).not.toHaveBeenCalled();
  });
});

describe("project requirements come from work, not incidental nouns", () => {
  it.each([
    { title: "Deploy nginx locally and write a runbook", expected: "linux-web" },
    { title: "Install a local collector and send logs to Grafana Cloud", expected: "linux-ubuntu" },
    { title: "Build a Docker integration for Salesforce", expected: "linux-ubuntu" },
  ])("keeps the lab for $title", ({ title, expected }) => {
    expect(templateForProject({ title })).toBe(expected);
  });

  it("a monitoring exercise can run for an evening on a laptop", () => {
    expect(
      specForProject({
        title: "SIEM monitoring dashboard",
        detail: "Practise log collection in Docker for an evening.",
      }).spec.alwaysOn
    ).toBeUndefined();
  });

  it("honours an explicit continuous-availability requirement", () => {
    expect(specForProject({ title: "Run a monitoring service 24/7" }).spec.alwaysOn).toBe(true);
  });
});
