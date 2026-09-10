import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A BLOCKED SCAN MUST NOT LOOK LIKE AN EMPTY MACHINE.
 *
 * This is the honesty property of the permission layer. If Fadi is denied access and then
 * reports "nothing detectable here", it has told the user something false about their own
 * computer — and worse, it is the kind of false that leads somewhere: a project plan
 * built on "you have no hypervisor" when the hypervisor was simply never looked at.
 *
 * The other half is that the audit log's `actor` column must carry the truth. It exists
 * so a person can tell "an MCP client asked for this" from "I did", and it is decorative
 * unless callers actually pass their own identity through.
 */

const requestCapability = vi.fn();

vi.mock("./broker", async () => {
  const actual = await vi.importActual<typeof import("./broker")>("./broker");
  return { ...actual, requestCapability };
});

beforeEach(() => {
  // Braces matter: an expression body would return the mock, and vitest calls whatever a
  // hook returns as a cleanup function — invoking the mock with no arguments after every
  // test.
  requestCapability.mockReset();
});

describe("scanning is honest about what it was not allowed to see", () => {
  it("reports the missing permission instead of an empty machine", async () => {
    requestCapability.mockResolvedValue({
      ok: false,
      needsGrant: true,
      capability: "inspect.containers",
      message: "denied",
    });
    const { scanLocalMachine } = await import("./local-probe");

    const scan = await scanLocalMachine({ userId: "u1", actor: "model", origin: "test" });

    expect(scan.findings).toEqual([]);
    // The distinguishing fact. Without this the caller cannot tell "your machine is bare"
    // from "you never let me look".
    expect(scan.needsGrant.length).toBeGreaterThan(0);
    expect(scan.needsGrant[0].summary).toBeTruthy();
    // And it must not invent capacity it could not read.
    expect(scan.host).toBeNull();
  });

  it("passes the caller's own identity to the broker, so the log names who asked", async () => {
    requestCapability.mockResolvedValue({ ok: true, capability: "inspect.host", results: {}, unavailable: [] });
    const { scanLocalMachine } = await import("./local-probe");

    await scanLocalMachine({ userId: "u1", actor: "mcp", origin: "mcp:detect" });

    expect(requestCapability).toHaveBeenCalled();
    for (const call of requestCapability.mock.calls) {
      expect(call[0].actor).toBe("mcp");
      expect(call[0].origin).toBe("mcp:detect");
      expect(call[0].userId).toBe("u1");
    }
  });

  it("interprets output it is handed, and never runs anything itself", async () => {
    requestCapability.mockImplementation(async (input: { capability: string }) => {
      const capability = input.capability;
      return capability === "inspect.containers"
        ? { ok: true, capability, results: { docker: "27.1.1\n" }, unavailable: ["podman"] }
        : { ok: true, capability, results: {}, unavailable: [] };
    });
    const { scanLocalMachine } = await import("./local-probe");

    const scan = await scanLocalMachine({ userId: "u1", actor: "user", origin: "test" });

    expect(scan.findings.some((f) => f.detail.includes("27.1.1"))).toBe(true);
    // A tool that isn't installed is named, so a short answer stays explainable.
    expect(scan.absent).toContain("Podman");
  });
});
