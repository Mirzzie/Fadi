import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MOVE_JOURNAL, moveDecision, reached, type MoveJournal } from "./vmware-move";

const journal = (phase: MoveJournal["phase"], source = "/hdd/vms/ws"): MoveJournal => ({
  version: 1,
  source,
  phase,
  startedAt: "2026-10-16T00:00:00Z",
  updatedAt: "2026-10-16T00:00:00Z",
});

describe("what a VM move does next, from its journal (Codex scan P1)", () => {
  const base = { sourceDir: "/hdd/vms/ws", targetDir: "/ssd/vmware/ws" };

  it("copies when nothing is there yet", () => {
    expect(moveDecision({ ...base, targetExists: false, journal: null })).toEqual({
      kind: "fresh",
    });
  });

  it("discards its own copy that was cut short, instead of refusing forever", () => {
    expect(moveDecision({ ...base, targetExists: true, journal: journal("copying") })).toEqual({
      kind: "discard-partial",
    });
  });

  it("never copies a finished machine twice", () => {
    expect(moveDecision({ ...base, targetExists: true, journal: journal("prepared") })).toEqual({
      kind: "continue",
      from: "prepared",
    });
  });

  it("never touches a folder that isn't its copy of this machine", () => {
    expect(moveDecision({ ...base, targetExists: true, journal: null }).kind).toBe("refuse");
    expect(
      moveDecision({ ...base, targetExists: true, journal: journal("listed", "/hdd/vms/other") })
        .kind
    ).toBe("refuse");
  });

  it("orders phases", () => {
    expect(reached(journal("listed"), "prepared")).toBe(true);
    expect(reached(journal("copied"), "listed")).toBe(false);
  });
});

/** On a real disk: temporary folders, a fake library, a tiny machine. Needs vmrun to answer. */
const hasVmrun = spawnSync("vmrun", ["-T", "ws", "list"], { timeout: 5000 }).status === 0;
const disk = hasVmrun ? describe : describe.skip;

disk("moving a VM, interrupted and resumed, on disk", () => {
  let root: string;
  let source: string;
  let vmx: string;
  let inventory: string;
  let fast: string;

  beforeEach(() => {
    // On the home disk, not /tmp: the move keeps 10 GB of headroom, and a small tmpfs can be just
    // under that, which made these tests depend on how full /tmp happened to be (19 Oct 2026).
    root = path.join(
      process.env.FADI_TEST_DISK_DIR ?? path.join(homedir(), ".cache"),
      `fadi-move-${process.pid}-${Math.random().toString(36).slice(2)}`
    );
    source = path.join(root, "hdd", "ws");
    fast = path.join(root, "ssd");
    vmx = path.join(source, "ws.vmx");
    inventory = path.join(root, "library", "inventory.vmls");
    mkdirSync(source, { recursive: true });
    mkdirSync(path.dirname(inventory), { recursive: true });
    writeFileSync(
      vmx,
      'displayName = "ws"\nuuid.bios = "56 4d 11 22 33 44 55 66-77 88 99 aa bb cc dd ee"\n'
    );
    writeFileSync(path.join(source, "disk.vmdk"), Buffer.alloc(1024 * 1024, 7));
    writeFileSync(inventory, `vmlist1.config = "${vmx}"\n`);
    process.env.FADI_FAST_VM_DIR = fast;
  });

  afterEach(() => {
    chmodSync(path.dirname(inventory), 0o755);
    rmSync(root, { recursive: true, force: true });
    delete process.env.FADI_FAST_VM_DIR;
  });

  const target = () => path.join(fast, "ws");
  const readJournal = () =>
    JSON.parse(readFileSync(path.join(target(), MOVE_JOURNAL), "utf8")) as MoveJournal;

  it("a clean move copies, repoints the library, and finishes when Fadi's record does", async () => {
    const { finishMove, moveMachineToFastDisk } = await import("./vmware");
    const result = await moveMachineToFastDisk(vmx, inventory);
    expect(result).toMatchObject({ ok: true, newVmxPath: path.join(target(), "ws.vmx") });
    expect(readFileSync(inventory, "utf8")).toContain(path.join(target(), "ws.vmx"));
    expect(readJournal()).toMatchObject({ phase: "listed", inventory: "updated" });
    await finishMove(path.join(target(), "ws.vmx"));
    expect(readJournal().phase).toBe("done");
  });

  it("CRASH MID-COPY: the half-made copy is replaced, not a dead end", async () => {
    mkdirSync(target(), { recursive: true });
    writeFileSync(path.join(target(), MOVE_JOURNAL), JSON.stringify(journal("copying", source)));
    writeFileSync(path.join(target(), "disk.vmdk"), Buffer.alloc(1000));
    const { moveMachineToFastDisk } = await import("./vmware");
    expect(await moveMachineToFastDisk(vmx, inventory)).toMatchObject({ ok: true });
    expect(statSync(path.join(target(), "disk.vmdk")).size).toBe(1024 * 1024);
  });

  it("LIBRARY FAILS: says so, and the retry finishes without copying again", async () => {
    chmodSync(path.dirname(inventory), 0o555);
    const { moveMachineToFastDisk } = await import("./vmware");
    const first = await moveMachineToFastDisk(vmx, inventory);
    expect(first.ok).toBe(false);
    expect(first.ok ? "" : first.message).toMatch(/VMware's library couldn't be updated/);
    expect(readJournal().phase).toBe("prepared");
    const copied = statSync(path.join(target(), "disk.vmdk"));

    chmodSync(path.dirname(inventory), 0o755);
    const second = await moveMachineToFastDisk(vmx, inventory);
    expect(second).toMatchObject({ ok: true });
    expect(statSync(path.join(target(), "disk.vmdk")).mtimeMs).toBe(copied.mtimeMs);
    expect(readFileSync(inventory, "utf8")).toContain(path.join(target(), "ws.vmx"));
  });

  it("refuses a folder that is in the way and isn't Fadi's", async () => {
    mkdirSync(target(), { recursive: true });
    writeFileSync(path.join(target(), "someone-elses.txt"), "keep me");
    const { moveMachineToFastDisk } = await import("./vmware");
    const result = await moveMachineToFastDisk(vmx, inventory);
    expect(result.ok).toBe(false);
    expect(readFileSync(path.join(target(), "someone-elses.txt"), "utf8")).toBe("keep me");
  });
});
