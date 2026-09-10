import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Preflight's job is to tell the truth about what will happen. A note that is wrong is
 * worse than no note, because the person reads it and approves on the strength of it.
 *
 * The port check is the subtle one. Docker prints "0.0.0.0:5433->5432/tcp": the HOST port
 * is 5433 and the container port is 5432. Matching the bare number would report a clash on
 * 5432 that does not exist, and miss nothing — but it would teach the user to ignore the
 * warnings, which is the real damage.
 */

const execFileMock = vi.fn();

vi.mock("node:child_process", () => ({
  execFile: Object.assign(execFileMock, {
    [Symbol.for("nodejs.util.promisify.custom")]: (...args: unknown[]) => execFileMock(...args),
  }),
}));

const PORTS = "0.0.0.0:3005->3001/tcp, [::]:3005->3001/tcp\n0.0.0.0:5433->5432/tcp";

function dockerSays(map: Record<string, string>) {
  execFileMock.mockImplementation(async (_cmd: string, args: string[]) => {
    const key = args[0] + " " + (args[1] ?? "");
    for (const [prefix, stdout] of Object.entries(map)) {
      if (key.startsWith(prefix)) return { stdout, stderr: "" };
    }
    return { stdout: "", stderr: "" };
  });
}

beforeEach(() => {
  // Braces, not an expression body: returning the mock makes vitest treat it as a cleanup
  // hook and call it with no arguments after every test. (Second time today.)
  execFileMock.mockReset();
});

describe("container.run preflight", () => {
  it("warns that the image will be downloaded when it is not here", async () => {
    dockerSays({ "ps -a": "", images: "", ps: PORTS });
    const { preflightFor } = await import("./preflight");

    const notes = await preflightFor({
      userId: "u1",
      recipe: "container.run",
      params: { name: "web", image: "postgres:16-alpine" },
    });

    expect(notes.some((n) => n.kind === "warn" && /download/i.test(n.text))).toBe(true);
  });

  it("says nothing will be downloaded when the image is already here", async () => {
    dockerSays({ "ps -a": "", images: "sha256:abc123", ps: PORTS });
    const { preflightFor } = await import("./preflight");

    const notes = await preflightFor({
      userId: "u1",
      recipe: "container.run",
      params: { name: "web", image: "nginx:1.27-alpine" },
    });

    expect(notes.some((n) => /already here/i.test(n.text))).toBe(true);
    expect(notes.some((n) => /download/i.test(n.text) && n.kind === "warn")).toBe(false);
  });

  it("warns when the name is taken, because docker would refuse after approval", async () => {
    dockerSays({ "ps -a": "fadi-web", images: "sha", ps: PORTS });
    const { preflightFor } = await import("./preflight");

    const notes = await preflightFor({
      userId: "u1",
      recipe: "container.run",
      params: { name: "web", image: "nginx" },
    });

    expect(notes.some((n) => n.kind === "warn" && /already exists/i.test(n.text))).toBe(true);
  });

  it("reports a clash on the HOST port and not the container port", async () => {
    dockerSays({ "ps -a": "", images: "sha", ps: PORTS });
    const { preflightFor } = await import("./preflight");

    const clash = await preflightFor({
      userId: "u1",
      recipe: "container.run",
      params: { name: "web", image: "nginx", port: 5433 },
    });
    expect(clash.some((n) => n.kind === "warn" && /5433/.test(n.text))).toBe(true);

    // 5432 appears in the same line as the CONTAINER port. Nothing is listening on 5432 on
    // this host, so warning about it would be a false alarm — and false alarms are how a
    // person learns to click past all of them.
    const noClash = await preflightFor({
      userId: "u1",
      recipe: "container.run",
      params: { name: "web", image: "nginx", port: 5432 },
    });
    expect(noClash.some((n) => /5432/.test(n.text))).toBe(false);
  });

  it("says it could not check, rather than implying all is well", async () => {
    execFileMock.mockRejectedValue(new Error("docker not running"));
    const { preflightFor } = await import("./preflight");

    const notes = await preflightFor({
      userId: "u1",
      recipe: "container.run",
      params: { name: "web", image: "nginx" },
    });

    // Silence would read as "nothing to worry about", which is a claim nobody made.
    expect(notes).toHaveLength(1);
    expect(notes[0].kind).toBe("unknown");
  });
});

describe("container.stop preflight", () => {
  it("warns when something is actually running", async () => {
    dockerSays({ ps: "fadi-web" });
    const { preflightFor } = await import("./preflight");

    const notes = await preflightFor({
      userId: "u1",
      recipe: "container.stop",
      params: { name: "web" },
    });

    expect(notes.some((n) => n.kind === "warn" && /stop working/i.test(n.text))).toBe(true);
  });

  it("says so plainly when it is not running", async () => {
    dockerSays({ ps: "" });
    const { preflightFor } = await import("./preflight");

    const notes = await preflightFor({
      userId: "u1",
      recipe: "container.stop",
      params: { name: "web" },
    });

    expect(notes.some((n) => n.kind === "info" && /isn't running/i.test(n.text))).toBe(true);
  });
});
