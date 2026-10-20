import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { judgeStep, lackedNetwork, rehearsalSummary } from "./rehearsal";

const ok = (output: string) => ({ exit: 0, output });
const fail = (output: string, exit = 1) => ({ exit, output });

describe("what a rehearsal proves about a step", () => {
  it("verified: the check fails before, the script runs, the check passes after", () => {
    expect(
      judgeStep({
        ordinal: 1,
        expect: "active",
        before: fail("inactive", 3),
        run: ok(""),
        after: ok("active"),
      }).verdict
    ).toBe("verified");
  });

  it("a check that passes before anything ran proves nothing", () => {
    expect(
      judgeStep({
        ordinal: 1,
        expect: "5",
        before: ok("15 files"),
        run: ok(""),
        after: ok("15 files"),
      }).verdict
    ).toBe("check-passes-before");
  });

  it("installed but not started — the owner's step 3", () => {
    expect(
      judgeStep({
        ordinal: 3,
        expect: "Running",
        before: fail(""),
        run: ok(""),
        after: ok("Stopped"),
      }).verdict
    ).toBe("check-failed-after");
  });

  it("a download with no network is reported as such, not as a broken plan", () => {
    const run = fail("curl: (6) Could not resolve host: packages.wazuh.com", 6);
    expect(judgeStep({ ordinal: 2, expect: "x", before: fail(""), run, after: null }).verdict).toBe(
      "needs-network"
    );
    expect(lackedNetwork("Temporary failure resolving 'archive.ubuntu.com'")).toBe(true);
    expect(lackedNetwork("syntax error near unexpected token")).toBe(false);
    // apt-get update offline exits 0 and only warns.
    const warned = ok("W: Failed to fetch … Temporary failure resolving 'archive.ubuntu.com'");
    expect(
      judgeStep({ ordinal: 2, expect: "curl", before: fail(""), run: warned, after: fail("") })
        .verdict
    ).toBe("needs-network");
  });

  it("lists only real plan faults as problems", () => {
    const summary = rehearsalSummary([
      { ordinal: 1, verdict: "verified", output: "" },
      { ordinal: 2, verdict: "needs-network", output: "" },
      { ordinal: 3, verdict: "run-failed", output: "" },
    ]);
    expect(summary.verified).toBe(1);
    expect(summary.problems.map((p) => p.ordinal)).toEqual([3]);
  });
});

/** In a real throwaway container. Needs Docker and the ubuntu:24.04 image. */
const hasUbuntu =
  spawnSync("docker", ["image", "inspect", "ubuntu:24.04"], { timeout: 10_000 }).status === 0;
(hasUbuntu ? describe : describe.skip)("rehearsing a plan in a throwaway Linux lab", () => {
  it("verifies a good step, catches a weak check and a broken script, reports a download, and leaves nothing behind", async () => {
    const { rehearsePlan } = await import("./rehearsal-runner");
    const result = await rehearsePlan("linux-ubuntu", [
      {
        ordinal: 1,
        script: "mkdir -p /srv/app && echo ready > /srv/app/status",
        check: { command: "cat /srv/app/status", expect: "ready" },
      },
      { ordinal: 2, script: "true", check: { command: "echo root", expect: "root" } },
      { ordinal: 3, script: "apt-get update", check: { command: "true", expect: "never" } },
    ]);
    expect(result.ok).toBe(true);
    expect(result.ok && result.steps.map((s) => s.verdict)).toEqual([
      "verified",
      "check-passes-before",
      "needs-network",
    ]);

    const broken = await rehearsePlan("linux-ubuntu", [
      { ordinal: 1, script: "if then fi", check: { command: "true", expect: "x" } },
      { ordinal: 2, script: "echo after", check: { command: "echo after", expect: "after" } },
    ]);
    expect(broken.ok && broken.steps.map((s) => s.verdict)).toEqual(["run-failed", "skipped"]);

    const left = spawnSync("docker", ["ps", "-a", "--filter", "label=fadi.rehearsal=1", "-q"], {
      encoding: "utf8",
    }).stdout.trim();
    expect(left).toBe("");
  }, 180_000);

  it("has no network and none of the person's files", async () => {
    const { rehearsePlan } = await import("./rehearsal-runner");
    const result = await rehearsePlan("linux-ubuntu", [
      {
        ordinal: 1,
        script:
          'test ! -e /home/mirzzie && test -z "$(ls /root/.ssh 2>/dev/null)" && ! getent hosts example.com && touch /tmp/isolated',
        check: { command: "ls /tmp/isolated", expect: "isolated" },
      },
    ]);
    expect(result.ok && result.steps[0]?.verdict).toBe("verified");
  }, 120_000);
});
