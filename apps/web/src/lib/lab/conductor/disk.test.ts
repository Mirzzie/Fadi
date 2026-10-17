import { describe, expect, it } from "vitest";

import { diskRoomVerdict, type DiskTarget } from "./disk";

const GIB = 1024 ** 3;

// By default the two targets sit on DIFFERENT filesystems, each with room to spare.
const vm = (over: Partial<DiskTarget> = {}): DiskTarget => ({
  role: "vm",
  label: "the VM's disk",
  path: "/mnt/vms/win11",
  needBytes: 10 * GIB,
  freeBytes: 50 * GIB,
  fsId: "vmfs",
  ...over,
});
const docker = (over: Partial<DiskTarget> = {}): DiskTarget => ({
  role: "docker",
  label: "Docker's data",
  path: "/srv/docker",
  needBytes: 8 * GIB,
  freeBytes: 50 * GIB,
  fsId: "dockerfs",
  ...over,
});

describe("diskRoomVerdict checks the real write targets (Codex VM-safety review, 17 Oct 2026)", () => {
  it("passes only when every required target has its own room", () => {
    expect(diskRoomVerdict([vm(), docker()]).verdict).toBe("pass");
  });

  it("fails when a VMX target on a separate mount is full, though another disk is free", () => {
    const result = diskRoomVerdict([vm({ freeBytes: 1 * GIB }), docker({ freeBytes: 500 * GIB })]);
    expect(result.verdict).toBe("fail");
    expect(result.seen).toContain("the VM's disk");
  });

  it("measures a custom / rootless Docker data-root, not a guessed path", () => {
    const rootless = diskRoomVerdict([
      docker({ path: "/home/u/.local/share/docker", freeBytes: 2 * GIB, needBytes: 12 * GIB }),
    ]);
    expect(rootless.verdict).toBe("fail");
  });

  it("is 'unknown' (never pass) when a required target can't be resolved or read", () => {
    expect(diskRoomVerdict([vm({ path: null }), docker()]).verdict).toBe("unknown");
    expect(diskRoomVerdict([vm({ freeBytes: null }), docker()]).verdict).toBe("unknown");
    expect(diskRoomVerdict([vm({ fsId: null }), docker()]).verdict).toBe("unknown");
  });

  it("checks VMware-only labs independently of Docker's data-root", () => {
    expect(diskRoomVerdict([vm({ freeBytes: 40 * GIB })]).verdict).toBe("pass");
    expect(diskRoomVerdict([vm({ freeBytes: 2 * GIB })]).verdict).toBe("fail");
  });

  it("SUMS targets that share a filesystem — the overcommit blocker (Codex re-review)", () => {
    // Same fs, 15 GB free: 10 and 8 pass individually, but the combined 18 GB write would fail.
    const shared = diskRoomVerdict([
      vm({ fsId: "root", freeBytes: 15 * GIB, needBytes: 10 * GIB }),
      docker({ fsId: "root", freeBytes: 15 * GIB, needBytes: 8 * GIB }),
    ]);
    expect(shared.verdict).toBe("fail");
    // The very same needs/free on SEPARATE filesystems are genuinely fine.
    const separate = diskRoomVerdict([
      vm({ fsId: "a", freeBytes: 15 * GIB, needBytes: 10 * GIB }),
      docker({ fsId: "b", freeBytes: 15 * GIB, needBytes: 8 * GIB }),
    ]);
    expect(separate.verdict).toBe("pass");
  });

  it("compares in bytes, so a need one byte over free fails (no floor-to-GB false pass)", () => {
    expect(diskRoomVerdict([vm({ freeBytes: 10 * GIB })]).verdict).toBe("pass");
    expect(diskRoomVerdict([vm({ freeBytes: 10 * GIB - 1 })]).verdict).toBe("fail");
  });

  it("passes when nothing is required", () => {
    expect(diskRoomVerdict([vm({ needBytes: 0 }), docker({ needBytes: 0 })]).verdict).toBe("pass");
  });
});
