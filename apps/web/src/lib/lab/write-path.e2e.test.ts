import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * THE WHOLE WRITE PATH, AGAINST THIS ACTUAL MACHINE.
 *
 * Everything else about the write path is tested with `execFile` mocked, which proves the
 * logic and proves nothing about whether Fadi can really start a container. This runs the
 * loop for real: a model proposes, nothing happens, a person approves, and a container
 * exists on the machine — then it is removed again.
 *
 * It also checks the containment claim where it counts: with a container the user created
 * themselves sitting right there, Fadi refuses to touch it.
 *
 * Requires FADI_E2E_DOCKER=1, plus a working docker and FADI_TEST_DATABASE_URL. Skipped
 * everywhere else, because a test that silently starts containers on someone's laptop is
 * not a test anybody wants running by default.
 */
const ENABLED = process.env.FADI_E2E_DOCKER === "1" && !!process.env.FADI_TEST_DATABASE_URL;
const suite = ENABLED ? describe : describe.skip;

const NAME = "e2e" + Math.random().toString(36).slice(2, 8);
const FULL = "fadi-" + NAME;
const FOREIGN = "not-fadi-" + NAME;

suite("Fadi can actually change this machine, once asked", () => {
  let pool: import("pg").Pool;
  let userId: string;
  let sh: (cmd: string, args: string[]) => Promise<string>;

  beforeAll(async () => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const run = promisify(execFile);
    sh = async (cmd, args) => {
      try {
        const { stdout } = await run(cmd, args, { timeout: 120_000 });
        return stdout.trim();
      } catch {
        return "";
      }
    };

    const { Pool } = await import("pg");
    pool = new Pool({ connectionString: process.env.FADI_TEST_DATABASE_URL });
    const { rows } = await pool.query(`insert into users (email) values ($1) returning id`, [
      `e2e-${Date.now()}@example.test`,
    ]);
    userId = rows[0].id as string;

    // A container the USER made. Fadi must not be able to name it.
    await sh("docker", ["run", "-d", "--name", FOREIGN, "nginx:1.27-alpine"]);
  }, 300_000);

  afterAll(async () => {
    await sh("docker", ["rm", "-f", FULL]);
    await sh("docker", ["rm", "-f", FOREIGN]);
    if (userId) await pool.query(`delete from users where id = $1`, [userId]);
    await pool?.end();
  }, 120_000);

  it("a proposal changes nothing on the machine", async () => {
    const { proposeAction } = await import("./broker");
    const res = await proposeAction({
      userId,
      recipe: "container.run",
      params: { image: "nginx", name: NAME },
      actor: "model",
      origin: "e2e",
    });

    expect(res.ok).toBe(true);
    // The machine is untouched. This is the claim the whole design rests on, and here it
    // is checked against docker rather than against a mock.
    const running = await sh("docker", ["ps", "-a", "--filter", "name=^" + FULL + "$", "--format", "{{.Names}}"]);
    expect(running).toBe("");
  }, 120_000);

  it("approving it starts the container for real", async () => {
    const { proposeAction, approveAndRun } = await import("./broker");
    const proposal = await proposeAction({
      userId,
      recipe: "container.run",
      params: { image: "nginx", name: NAME },
      actor: "model",
      origin: "e2e",
    });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;

    const result = await approveAndRun({ userId, requestId: proposal.requestId });
    expect(result.ok, result.ok ? "" : result.message).toBe(true);

    const names = await sh("docker", ["ps", "--filter", "name=^" + FULL + "$", "--format", "{{.Names}}"]);
    expect(names).toContain(FULL);
  }, 300_000);

  it("REFUSES a container the user created themselves", async () => {
    const { proposeAction } = await import("./broker");
    // The name is real, the container is right there, and Fadi still will not name it —
    // because it is not in the list of things Fadi executed.
    const res = await proposeAction({
      userId,
      recipe: "container.remove",
      // Naming it outright. Two separate things stop this: the container is not in the
      // list of what Fadi executed, and the renderer prepends "fadi-" regardless — so
      // there is no string at all that reaches a container Fadi did not create.
      params: { name: FOREIGN },
      actor: "model",
      origin: "e2e",
    });

    expect(res.ok).toBe(false);
    const still = await sh("docker", ["ps", "-a", "--filter", "name=^" + FOREIGN + "$", "--format", "{{.Names}}"]);
    expect(still).toContain(FOREIGN);
  }, 120_000);

  it("removes its own container when asked", async () => {
    const { proposeAction, approveAndRun } = await import("./broker");
    const proposal = await proposeAction({
      userId,
      recipe: "container.remove",
      params: { name: NAME },
      actor: "user",
      origin: "e2e",
    });
    expect(proposal.ok, proposal.ok ? "" : proposal.message).toBe(true);
    if (!proposal.ok) return;

    const result = await approveAndRun({ userId, requestId: proposal.requestId });
    expect(result.ok).toBe(true);

    const gone = await sh("docker", ["ps", "-a", "--filter", "name=^" + FULL + "$", "--format", "{{.Names}}"]);
    expect(gone).toBe("");
  }, 300_000);
});
