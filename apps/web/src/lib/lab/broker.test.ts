import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * THE GUARD THAT MATTERS FOR LOCAL EXECUTION.
 *
 * Fadi reads untrusted text by design — job descriptions, imported notes, portfolio
 * feedback from strangers. One oracle case already carries "ignore all validation rules".
 * A model that reads that AND can run commands is prompt injection with local execution,
 * and no amount of binding to 127.0.0.1 changes it.
 *
 * Two kinds of test here, because the property has two halves:
 *
 *   - BEHAVIOURAL: with no grant, nothing runs and the attempt is recorded. That is the
 *     deny-by-default claim, and it must be executed to be believed.
 *   - STRUCTURAL: the command list stays a fixed set of literals, and nothing reaches the
 *     executor from a caller. A behavioural test passes happily on a version that has
 *     grown one dangerous parameter, so this half reads the source, where the property
 *     actually lives.
 */

const execFileMock = vi.fn();
const findLive = vi.fn();
const proposed: Record<string, unknown>[] = [];
let pendingCapabilityResult: unknown = null;
const record = vi.fn();
// Owner-scoped lookups used by the snapshot write binding (see the binding tests at the end).
const resourceGet = vi.fn();
const runGetWithSteps = vi.fn();

vi.mock("node:child_process", () => ({
  // promisify looks for this symbol; without it the promisified call gets a callback
  // wrapper instead of our mock and the test would silently assert nothing.
  execFile: Object.assign(execFileMock, {
    [Symbol.for("nodejs.util.promisify.custom")]: (...args: unknown[]) => execFileMock(...args),
  }),
}));
vi.mock("@/lib/database/client", () => ({ getDatabase: () => ({}) }));
vi.mock("@/lib/observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@careeros/database", () => ({
  createLabGrantsRepository: () => ({ findLive, revokeAll: vi.fn() }),
  createLabActionsRepository: () => ({ record, denialsSince: async () => [] }),
  createLabActionRequestsRepository: () => ({
    pendingCapability: async () => pendingCapabilityResult,
    // A denied read now RAISES A REQUEST instead of only logging, so the queue can ask the
    // person wherever they are rather than leaving a standing list on a settings page.
    propose: async (row: Record<string, unknown>) => {
      proposed.push(row);
      return { ...row, id: "req-1" };
    },
    get: async () => null,
    executedLastHour: async () => 0,
  }),
  createLabResourcesRepository: () => ({ get: resourceGet }),
  createProjectRunsRepository: () => ({ getWithSteps: runGetWithSteps }),
}));

beforeEach(() => {
  execFileMock.mockReset();
  findLive.mockReset();
  record.mockReset();
  execFileMock.mockResolvedValue({ stdout: "27.1.1\n", stderr: "" });
});

describe("deny by default", () => {
  it("runs NOTHING when there is no grant", async () => {
    findLive.mockResolvedValue(null);
    const { requestCapability } = await import("./broker");

    const result = await requestCapability({
      userId: "u1",
      capability: "inspect.containers",
      actor: "model",
      origin: "test",
    });

    expect(result.ok).toBe(false);
    // The point of the whole layer: not "it returned an error", but that the machine was
    // never touched.
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("records the denial, because a denial nobody can see is not a control", async () => {
    findLive.mockResolvedValue(null);
    const { requestCapability } = await import("./broker");

    await requestCapability({
      userId: "u1",
      capability: "inspect.virtualisation",
      actor: "mcp",
      origin: "mcp:detect",
    });

    expect(record).toHaveBeenCalledTimes(1);
    const row = record.mock.calls[0][0];
    // "asked", not "denied". Being refused for want of permission and telling the user is
    // the system working; counting it as hostile made the breaker revoke everything during
    // ordinary use.
    expect(row.decision).toBe("asked");
    // Who asked is the information a person actually needs. "Something happened" is not
    // the same fact as "the MCP client asked for this".
    expect(row.actor).toBe("mcp");
    expect(row.capability).toBe("inspect.virtualisation");
  });

  it("denies a capability that is not in the catalogue, and logs the attempt", async () => {
    findLive.mockResolvedValue({ id: "g1" }); // even with a grant sitting there
    const { requestCapability } = await import("./broker");

    const result = await requestCapability({
      userId: "u1",
      capability: "shell.exec",
      actor: "model",
      origin: "test",
    });

    expect(result.ok).toBe(false);
    expect(execFileMock).not.toHaveBeenCalled();
    expect(record.mock.calls[0][0].decision).toBe("denied");
  });

  it("does not accept an expired or revoked grant — that is the repository's job, and it is asked every time", async () => {
    // findLive is the only gate, so a cached "granted" flag can never drift from it.
    findLive.mockResolvedValue(null);
    const { requestCapability } = await import("./broker");
    await requestCapability({
      userId: "u1",
      capability: "inspect.host",
      actor: "user",
      origin: "test",
    });
    expect(findLive).toHaveBeenCalledWith("u1", "inspect.host", null);
  });
});

describe("with a grant", () => {
  it("runs the catalogued commands and records each one", async () => {
    findLive.mockResolvedValue({ id: "g1", expiresAt: new Date(Date.now() + 60_000) });
    const { requestCapability } = await import("./broker");

    const result = await requestCapability({
      userId: "u1",
      capability: "inspect.containers",
      actor: "user",
      origin: "dashboard",
    });

    expect(result.ok).toBe(true);
    expect(execFileMock).toHaveBeenCalled();
    // Every argument that reached the OS came from the literal catalogue.
    for (const call of execFileMock.mock.calls) {
      expect(Array.isArray(call[1])).toBe(true);
    }
    expect(record.mock.calls.every((c) => c[0].decision === "allowed")).toBe(true);
  });

  it("records a command that could not run, rather than swallowing it", async () => {
    findLive.mockResolvedValue({ id: "g1" });
    execFileMock.mockRejectedValue(new Error("ENOENT"));
    const { requestCapability } = await import("./broker");

    const result = await requestCapability({
      userId: "u1",
      capability: "inspect.containers",
      actor: "user",
      origin: "dashboard",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.unavailable.length).toBeGreaterThan(0);
    // "unavailable", not "error". Most machines have some of these tools and not others,
    // and a log painted red for "podman isn't installed" teaches people to ignore red.
    // It is still recorded — "Fadi tried and the machine said no" is worth seeing.
    expect(record.mock.calls.some((c) => c[0].decision === "unavailable")).toBe(true);
    expect(record.mock.calls.some((c) => c[0].decision === "error")).toBe(false);
  });
});

const BROKER = readFileSync(join(process.cwd(), "src/lib/lab/broker.ts"), "utf8");
const PROBE = readFileSync(join(process.cwd(), "src/lib/lab/local-probe.ts"), "utf8");

describe("nothing can be steered from outside", () => {
  it("never uses a shell", () => {
    expect(BROKER).toContain('from "node:child_process"');
    expect(BROKER).not.toMatch(/\bspawn\s*\(|shell\s*:\s*true/);
  });

  it("builds no command or argument from a template", () => {
    const catalogue = BROKER.slice(
      BROKER.indexOf("export const CAPABILITIES"),
      BROKER.indexOf("export type BrokerDenial"),
    );
    expect(catalogue.length).toBeGreaterThan(200);
    expect(catalogue).not.toMatch(/`/);
    expect(catalogue).not.toMatch(/\$\{/);
    // No identifier is interpolated into argv either — every element is a literal.
    expect(catalogue).not.toMatch(/args:\s*\[[^\]]*[a-zA-Z_$][\w$]*\s*[,\]]/);
  });

  it("catalogues only read-only inspections", () => {
    // Discovering something must not grant control over it. A verb like this appearing
    // means someone crossed from observing the machine to changing it, and that needs a
    // different design with its own consent — not a quiet edit to this list.
    const catalogue = BROKER.slice(
      BROKER.indexOf("export const CAPABILITIES"),
      BROKER.indexOf("export type BrokerDenial"),
    );
    for (const verb of ['"run"', '"start"', '"stop"', '"rm"', '"exec"', '"create"', '"delete"', '"install"']) {
      expect(catalogue).not.toContain(verb);
    }
  });

  it("bounds every command in time and output", () => {
    expect(BROKER).toMatch(/timeout:\s*\d+/);
    expect(BROKER).toMatch(/maxBuffer:/);
  });

  it("keeps execution out of every other file in lib/lab", () => {
    // The reason the catalogue is worth auditing is that it is the ONLY place commands
    // live. A second executor elsewhere would make this whole file decorative.
    expect(PROBE).not.toContain("child_process");
  });
});

describe("permission is asked at the trigger, not stockpiled in advance", () => {
  it("raises a REQUEST when a read is refused, so the queue can ask", async () => {
    // The objection this answers: "why is there a predefined permissions list? the user
    // should only be asked when there is an action that requires system access."
    //
    // A standing list of "Allow for 2h" rows asks people to grant access speculatively for
    // things that may never happen — and a permission granted in advance is one nobody
    // remembers giving.
    findLive.mockResolvedValue(null);
    proposed.length = 0;
    const { requestCapability } = await import("./broker");

    await requestCapability({
      userId: "u1",
      capability: "inspect.containers",
      actor: "model",
      origin: "test",
    });

    expect(proposed).toHaveLength(1);
    expect(proposed[0].kind).toBe("capability");
    expect(proposed[0].recipe).toBe("inspect.containers");
    // The card must carry the consent text and its limit, not a bare capability id.
    expect(String(proposed[0].summary)).toMatch(/docker/i);
    expect(String(proposed[0].reversal)).toMatch(/cannot/i);
  });

  it("asks ONCE — a page that inspects repeatedly does not fill the queue", async () => {
    findLive.mockResolvedValue(null);
    proposed.length = 0;
    pendingCapabilityResult = { id: "already-asking" };
    const { requestCapability } = await import("./broker");

    await requestCapability({ userId: "u1", capability: "inspect.host", actor: "model", origin: "t" });

    expect(proposed).toHaveLength(0);
    pendingCapabilityResult = null;
  });

  it("still runs nothing and still records the denial", async () => {
    findLive.mockResolvedValue(null);
    const { requestCapability } = await import("./broker");

    const result = await requestCapability({
      userId: "u1",
      capability: "inspect.containers",
      actor: "model",
      origin: "test",
    });

    expect(result.ok).toBe(false);
    expect(execFileMock).not.toHaveBeenCalled();
    // Recorded, but as an ask rather than an incident.
    expect(record.mock.calls.some((c) => c[0].decision === "asked")).toBe(true);
    expect(record.mock.calls.some((c) => c[0].decision === "denied")).toBe(false);
  });
});

/**
 * THE SECURITY BOUNDARY FOR SNAPSHOT WRITES (Codex VM-safety review + re-review, 17 Oct 2026).
 *
 * A snapshot or project reset must be bound to the run that owns the machine, and the snapshot
 * name is derived server-side from that run — never trusted from the caller. hydrateRecipeParams
 * runs at BOTH propose and approval, so these tests exercise the function directly for the cases
 * Codex asked for: mismatched run/resource, a caller-supplied snapshot override, a missing run,
 * and reassignment between proposal and approval.
 */
describe("snapshot writes are bound to the run that owns the machine", () => {
  const RUN = "df3e6d83-fca4-4848-9782-0e3b04a87eda";
  const OWN_SNAPSHOT = "Fadi clean start df3e6d83fca4484897820e3b04a87eda";
  const RESOURCE = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const OTHER = "ffffffff-1111-4222-8333-444444444444";

  beforeEach(() => {
    resourceGet.mockReset();
    runGetWithSteps.mockReset();
    resourceGet.mockResolvedValue({
      id: RESOURCE,
      label: "Win11",
      endpoint: "vmware://local/home/u/vms/win11.vmx",
    });
    runGetWithSteps.mockResolvedValue({ run: { id: RUN, resourceId: RESOURCE }, steps: [] });
  });

  it("overwrites a caller-supplied snapshot name with the run's own full-id snapshot", async () => {
    const { hydrateRecipeParams } = await import("./broker");
    const out = await hydrateRecipeParams(
      "u1",
      "vmware.snapshot",
      // A caller trying to name another project's (or a hand-crafted) snapshot.
      { resourceId: RESOURCE, snapshot: "Fadi clean start deadbeef" },
      RUN
    );
    expect(out?.snapshot).toBe(OWN_SNAPSHOT);
  });

  it("rejects when the run does not own the named resource", async () => {
    runGetWithSteps.mockResolvedValue({ run: { id: RUN, resourceId: OTHER }, steps: [] });
    const { hydrateRecipeParams } = await import("./broker");
    expect(
      await hydrateRecipeParams("u1", "project.reset", { resourceId: RESOURCE, name: "x" }, RUN)
    ).toBeNull();
  });

  it("rejects a snapshot write with no run to bind to", async () => {
    const { hydrateRecipeParams } = await import("./broker");
    expect(
      await hydrateRecipeParams("u1", "vmware.snapshot", { resourceId: RESOURCE }, null)
    ).toBeNull();
  });

  it("re-checks at approval: a resource reassigned after the proposal is refused on the second pass", async () => {
    const { hydrateRecipeParams } = await import("./broker");
    // Proposal time: the run owns the resource, so it binds.
    const proposed = await hydrateRecipeParams(
      "u1",
      "vmware.snapshot",
      { resourceId: RESOURCE },
      RUN
    );
    expect(proposed?.snapshot).toBe(OWN_SNAPSHOT);
    // Between proposal and approval the run is reassigned to a different machine.
    runGetWithSteps.mockResolvedValue({ run: { id: RUN, resourceId: OTHER }, steps: [] });
    expect(
      await hydrateRecipeParams("u1", "vmware.snapshot", { resourceId: RESOURCE }, RUN)
    ).toBeNull();
  });
});
