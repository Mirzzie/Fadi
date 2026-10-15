import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * A project on the person's own VMware machine, end to end on this computer: one approval
 * turns the screen on and starts the machine in the background; the project sees it running
 * and gets a screen it can show; a second start is not needed; suspend works.
 *
 * Uses a throwaway, disk-less VM (256 MB, boots to firmware) so nothing of the owner's is
 * touched. Runs only with VMware installed and FADI_TEST_VMWARE=1, plus the test database.
 */
const DB = process.env.FADI_TEST_DATABASE_URL;
const suite = DB && process.env.FADI_TEST_VMWARE === "1" ? describe : describe.skip;

const holder = vi.hoisted(() => {
  process.env.FADI_SCREEN_BRIDGE_PORT = "6190";
  return { db: null as unknown };
});
vi.mock("@/lib/database/client", () => ({ getDatabase: () => holder.db }));

const dir = path.join(process.env.FADI_TEST_VM_DIR ?? tmpdir(), `fadi-vmware-test-${process.pid}`);
const vmx = path.join(dir, "probe.vmx");

suite("a project on your own VMware machine", () => {
  let pool: import("pg").Pool;
  let userId: string;
  let resourceId: string;
  let runId: string;

  beforeAll(async () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      vmx,
      [
        '.encoding = "UTF-8"',
        'config.version = "8"',
        'virtualHW.version = "21"',
        'displayName = "Fadi test machine"',
        'guestOS = "windows2022srvnext-64"',
        'memsize = "256"',
        'numvcpus = "1"',
        'firmware = "efi"',
        'ethernet0.present = "FALSE"',
        'sound.present = "FALSE"',
        "",
      ].join("\n")
    );

    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const db = await import("@careeros/database");
    pool = new Pool({ connectionString: DB });
    holder.db = drizzle(pool) as never;
    userId = (
      await pool.query("insert into users (email) values ($1) returning id", [
        `vmware-${Date.now()}@example.test`,
      ])
    ).rows[0].id;
    resourceId = (
      await db.createLabResourcesRepository(holder.db as never).upsertDetected(userId, {
        label: "Fadi test machine",
        kind: "vm",
        arch: "x86_64",
        memoryMb: 256,
        diskGb: null,
        virtualization: "none",
        alwaysOn: false,
        notes: null,
        scopes: ["read", "provision"],
        endpoint: `vmware://local${encodeURI(vmx)}`,
        secretCiphertext: null,
        secretHint: null,
        lastSeenAt: null,
      })
    ).id;
    runId = (
      await db
        .createProjectRunsRepository(holder.db as never)
        .createWithSteps(
          userId,
          { title: "Harden Windows Server", resourceId, resourceLabel: "Fadi test machine" },
          [
            {
              ordinal: 1,
              title: "Look around",
              instruction: "Sign in.",
              verify: null,
              produces: null,
            },
          ]
        )
    ).run.id;
  });

  afterAll(async () => {
    try {
      execFileSync("vmrun", ["-T", "ws", "stop", vmx, "hard"], { timeout: 30_000 });
    } catch {
      // already off
    }
    rmSync(dir, { recursive: true, force: true });
    if (userId) await pool.query("delete from users where id = $1", [userId]);
    await pool?.end();
  });

  it("one click starts it in the background with its screen on, and the project can show it", async () => {
    const { proposeAction, approveAndRun } = await import("./broker");
    const proposal = await proposeAction({
      userId,
      recipe: "vmware.start",
      params: { resourceId, screen: true },
      actor: "user",
      origin: "test",
      runId,
    });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    expect(proposal.policy.confirm).toBe("click");
    expect(proposal.argv.at(-1)).toEqual(["vmrun", "-T", "ws", "start", vmx, "nogui"]);

    const done = await approveAndRun({ userId, requestId: proposal.requestId });
    expect(done).toMatchObject({ ok: true });

    // The settings file gained the screen, on this computer only, and the original was kept.
    const text = readFileSync(vmx, "utf8");
    expect(text).toMatch(/RemoteDisplay\.vnc\.ip = "127\.0\.0\.1"/);
    expect(existsSync(`${vmx}.before-fadi`)).toBe(true);
    expect(readFileSync(`${vmx}.before-fadi`, "utf8")).not.toMatch(/RemoteDisplay/);

    const { observeProjectRuntime } = await import("./runtime-observer");
    const runtime = await observeProjectRuntime(userId, runId);
    expect(runtime?.template).toBe("vmware");
    expect(["booting", "ready"]).toContain(runtime?.phase);
    const screen = runtime?.endpoints.find((e) => e.kind === "viewer");
    expect(screen?.state).toBe("reachable");
    expect(screen?.sessionPath).toMatch(/^\/lab-screen\.html#port=6190&t=[0-9a-f]+&p=/);

    // And the screen really is the machine's: through the bridge, VNC answers.
    const ticket = new URLSearchParams(screen!.sessionPath!.split("#")[1]).get("t")!;
    const greeting = await new Promise<string>((resolve, reject) => {
      const socket = connect(6190, "127.0.0.1", () =>
        socket.write(
          [
            `GET /screen?t=${ticket} HTTP/1.1`,
            "Host: 127.0.0.1:6190",
            "Upgrade: websocket",
            "Connection: Upgrade",
            "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
            "Sec-WebSocket-Version: 13",
            "Origin: http://localhost:3000",
            "",
            "",
          ].join("\r\n")
        )
      );
      let data = "";
      socket.on("data", (chunk) => {
        data += chunk.toString("latin1");
        if (data.includes("RFB 003.")) {
          socket.destroy();
          resolve(data);
        }
      });
      socket.on("error", reject);
      setTimeout(() => reject(new Error(`no VNC greeting: ${data.slice(0, 80)}`)), 8000);
    });
    expect(greeting).toContain("101 Switching Protocols");
    expect(greeting).toMatch(/RFB 003\.\d{3}/);

    if (process.env.FADI_TEST_SCREEN_URL_FILE) {
      // Optional, for a person or a browser outside the test to look at the live screen through
      // the running Fadi's static page while this test holds the bridge open.
      writeFileSync(
        process.env.FADI_TEST_SCREEN_URL_FILE,
        `http://localhost:3000${screen!.sessionPath}`
      );
      await new Promise((resolve) => setTimeout(resolve, 25_000));
    }
  }, 120_000);

  it("does not ask to start a machine that is already running", async () => {
    const { runningVmxPaths } = await import("./vmware");
    expect((await runningVmxPaths())?.has(vmx)).toBe(true);
  });

  it("suspends it with one click, and the project says so", async () => {
    const { proposeAction, approveAndRun } = await import("./broker");
    const proposal = await proposeAction({
      userId,
      recipe: "vmware.suspend",
      params: { resourceId },
      actor: "user",
      origin: "test",
      runId,
    });
    expect(proposal.ok && proposal.policy.confirm).toBe("click");
    if (!proposal.ok) return;
    expect(await approveAndRun({ userId, requestId: proposal.requestId })).toMatchObject({
      ok: true,
    });
    const { observeProjectRuntime } = await import("./runtime-observer");
    const runtime = await observeProjectRuntime(userId, runId);
    expect(runtime?.phase).toBe("stopped");
    expect(runtime?.phaseDetail).toMatch(/suspended/);
  }, 120_000);

  it("changes network and screen with one click, but not CPU while suspended", async () => {
    const { proposeAction, approveAndRun } = await import("./broker");
    const ask = async (changes: Record<string, unknown>) => {
      const proposal = await proposeAction({
        userId,
        recipe: "vmware.configure",
        params: { resourceId, changes },
        actor: "user",
        origin: "test",
        runId,
      });
      expect(proposal.ok && proposal.policy.confirm).toBe("click");
      return proposal.ok ? approveAndRun({ userId, requestId: proposal.requestId }) : null;
    };
    // Suspended by the previous test: its saved state has the old CPU count.
    expect(await ask({ cpus: 2 })).toMatchObject({ ok: false });
    expect(readFileSync(vmx, "utf8")).not.toMatch(/numvcpus = "2"/);
    expect(await ask({ network: "hostonly", screen: "1600x900", bridged: true })).toMatchObject({
      ok: true,
    });
    const text = readFileSync(vmx, "utf8");
    expect(text).toMatch(/svga\.autodetect = "FALSE"/);
    expect(text).toMatch(/svga\.maxWidth = "1600"/);
    expect(text).not.toMatch(/bridged/);
  }, 120_000);

  it("a fresh start returns the machine to its clean start and clears the project", async () => {
    const { proposeAction, approveAndRun } = await import("./broker");
    const { hasCleanSnapshot } = await import("./vmware");
    const { labNameForRun } = await import("./templates");
    const snap = await proposeAction({
      userId,
      recipe: "vmware.snapshot",
      params: { resourceId },
      actor: "user",
      origin: "test",
      runId,
    });
    expect(snap.ok && snap.policy.confirm).toBe("click");
    if (!snap.ok) return;
    expect(await approveAndRun({ userId, requestId: snap.requestId })).toMatchObject({ ok: true });
    expect(await hasCleanSnapshot(vmx)).toBe(true);

    const reset = await proposeAction({
      userId,
      recipe: "project.reset",
      params: { name: labNameForRun(runId), stacks: [], resourceId },
      actor: "user",
      origin: "test",
      runId,
    });
    expect(reset.ok && reset.policy.confirm).toBe("type-name");
    if (!reset.ok) return;
    expect(
      await approveAndRun({ userId, requestId: reset.requestId, confirmation: reset.confirmToken })
    ).toMatchObject({ ok: true });
    const runs = (await import("@careeros/database")).createProjectRunsRepository(holder.db as never);
    expect((await runs.getWithSteps(userId, runId))!.steps).toEqual([]);
  }, 300_000);

  it("refuses to resize a suspended machine, and moves it to the fast disk by copying", async () => {
    const { setMachineMemory } = await import("./vmware");
    // Suspended by the previous test: its memory was saved at the old size.
    const resized = await setMachineMemory(vmx, 4096);
    expect(resized).toMatchObject({ ok: false });

    const { proposeAction, approveAndRun } = await import("./broker");
    const proposal = await proposeAction({
      userId,
      recipe: "vmware.move",
      params: { resourceId },
      actor: "user",
      origin: "test",
      runId,
    });
    expect(proposal.ok && proposal.policy.confirm).toBe("click");
    if (!proposal.ok) return;
    expect(await approveAndRun({ userId, requestId: proposal.requestId })).toMatchObject({
      ok: true,
    });
    const moved = path.join(process.env.FADI_FAST_VM_DIR!, path.basename(dir), "probe.vmx");
    expect(readFileSync(moved, "utf8")).toMatch(/uuid\.action = "keep"/);
    expect(existsSync(vmx)).toBe(true); // the original is untouched
    const { createLabResourcesRepository } = await import("@careeros/database");
    const row = await createLabResourcesRepository(holder.db as never).get(userId, resourceId);
    expect(decodeURI(row!.endpoint!)).toBe(`vmware://local${moved}`);
    // And the moved machine starts in the background without VMware asking anything.
    execFileSync("vmrun", ["-T", "ws", "start", moved, "nogui"], { timeout: 120_000 });
    execFileSync("vmrun", ["-T", "ws", "stop", moved, "hard"], { timeout: 60_000 });
    // Off and not suspended now: memory can change, with the old settings kept.
    const sized = await setMachineMemory(moved, 3072);
    expect(sized).toMatchObject({ ok: true });
    expect(readFileSync(moved, "utf8")).toMatch(/memsize = "3072"/);
    rmSync(path.dirname(moved), { recursive: true, force: true });
  }, 300_000);

  it("refuses to change the settings of a running machine", async () => {
    const { enableScreen } = await import("./vmware");
    execFileSync("vmrun", ["-T", "ws", "start", vmx, "nogui"], { timeout: 60_000 });
    const before = readFileSync(vmx, "utf8");
    const result = await enableScreen({ vmxPath: vmx, resourceId, otherVmxPaths: [] });
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.message).toMatch(/running/);
    expect(readFileSync(vmx, "utf8")).toBe(before);
  }, 120_000);
});
