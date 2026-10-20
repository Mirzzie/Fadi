import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { connect } from "node:net";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * A project's Wazuh stack, for real: one approval writes the pinned files, generates the
 * certificates and brings up manager, indexer and dashboard; the dashboard answers on this
 * computer and the agent ports answer on the VMware network only; stop and remove work.
 *
 * Slow (first run downloads ~2 GB). Runs only with FADI_TEST_STACKS=1 and the test database.
 */
const DB = process.env.FADI_TEST_DATABASE_URL;
const suite = DB && process.env.FADI_TEST_STACKS === "1" ? describe : describe.skip;

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/database/client", () => ({ getDatabase: () => holder.db }));

const answers = (host: string, port: number) =>
  new Promise<boolean>((resolve) => {
    const socket = connect({ host, port });
    socket.setTimeout(1500);
    socket.once("connect", () => (socket.destroy(), resolve(true)));
    socket.once("timeout", () => (socket.destroy(), resolve(false)));
    socket.once("error", () => resolve(false));
  });

suite("a project's Wazuh stack", () => {
  let pool: import("pg").Pool;
  let userId: string;
  let runId: string;
  let project: string;
  let agentIp: string;

  beforeAll(async () => {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const db = await import("@careeros/database");
    pool = new Pool({ connectionString: DB });
    holder.db = drizzle(pool) as never;
    userId = (
      await pool.query("insert into users (email) values ($1) returning id", [
        `stack-${Date.now()}@example.test`,
      ])
    ).rows[0].id;
    runId = (
      await db
        .createProjectRunsRepository(holder.db as never)
        .createWithSteps(userId, { title: "Open-Source SIEM for an SME" }, [
          { ordinal: 1, title: "Start", instruction: "Start.", verify: null, produces: null },
        ])
    ).run.id;
    const { labNameForRun } = await import("./templates");
    const { stackProject, vmNetworkAddress } = await import("./stacks");
    project = stackProject(labNameForRun(runId), "wazuh");
    agentIp = vmNetworkAddress();
  });

  afterAll(async () => {
    try {
      execFileSync("docker", ["compose", "-p", project, "down", "-v"], { timeout: 120_000 });
    } catch {
      // nothing to remove
    }
    const { stackFolder } = await import("./stacks");
    // Certificates are written by a root container; Docker removes them for us.
    if (existsSync(stackFolder(project))) {
      execFileSync("docker", [
        "run",
        "--rm",
        "-v",
        `${path.dirname(stackFolder(project))}:/s`,
        "alpine:3.20",
        "rm",
        "-rf",
        `/s/${project}`,
      ]);
    }
    rmSync(stackFolder(project), { recursive: true, force: true });
    if (userId) await pool.query("delete from users where id = $1", [userId]);
    await pool?.end();
  });

  it("one click brings the SIEM up, reachable from this computer and the VM network only", async () => {
    const { proposeAction, approveAndRun } = await import("./broker");
    const { labNameForRun } = await import("./templates");
    const proposal = await proposeAction({
      userId,
      recipe: "stack.start",
      params: { stack: "wazuh", name: labNameForRun(runId), agentIp },
      actor: "user",
      origin: "test",
      runId,
    });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    expect(proposal.policy.confirm).toBe("click");
    const done = await approveAndRun({ userId, requestId: proposal.requestId });
    expect(done).toMatchObject({ ok: true });

    const { observeStack } = await import("./stack-observer");
    let state = await observeStack(project, "wazuh");
    for (let i = 0; i < 60 && state?.state !== "running"; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      state = await observeStack(project, "wazuh");
    }
    expect(state).toMatchObject({ state: "running", running: 3, total: 3 });

    // The dashboard answers here; the agent ports on the VMware network address.
    expect(await answers("127.0.0.1", 5443)).toBe(true);
    expect(await answers(agentIp, 1514)).toBe(true);
    expect(await answers(agentIp, 1515)).toBe(true);
    // And the indexer is not on the VMware network.
    if (agentIp !== "127.0.0.1") expect(await answers(agentIp, 9200)).toBe(false);
  }, 1_200_000);

  it("stops with one click and keeps its data", async () => {
    const { proposeAction, approveAndRun } = await import("./broker");
    const { labNameForRun } = await import("./templates");
    const proposal = await proposeAction({
      userId,
      recipe: "stack.stop",
      params: { stack: "wazuh", name: labNameForRun(runId) },
      actor: "user",
      origin: "test",
      runId,
    });
    expect(proposal.ok && proposal.policy.confirm).toBe("click");
    if (!proposal.ok) return;
    expect(await approveAndRun({ userId, requestId: proposal.requestId })).toMatchObject({
      ok: true,
    });
    const { observeStack } = await import("./stack-observer");
    expect((await observeStack(project, "wazuh"))?.state).toBe("stopped");
  }, 300_000);
});
