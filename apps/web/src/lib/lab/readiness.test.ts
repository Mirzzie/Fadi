import { describe, expect, it } from "vitest";

import { assessReadiness, readinessForPlanner, type ReadinessFacts } from "./readiness";

const wazuh = { label: "Wazuh", ramMb: 2300, diskGb: 6, running: false, downloadMb: 0 };
const server = {
  kind: "vmware" as const,
  label: "Windows Server 2025",
  family: "windows-server" as const,
  memoryMb: 2048,
  running: false,
  onSpinningDisk: true,
  toolsRunning: null,
};

const facts = (over: Partial<ReadinessFacts>): ReadinessFacts => ({
  availableMb: 12_000,
  machine: null,
  services: [],
  dockerFreeGb: 100,
  ...over,
});

describe("can this project run here", () => {
  it("names the owner's real case: a 2 GB Windows Server on an HDD is slow, and why", () => {
    const result = assessReadiness(
      facts({ machine: server, services: [wazuh], availableMb: 7200 })
    );
    expect(result.verdict).toBe("slow");
    expect(result.checks.map((c) => c.id)).toEqual(
      expect.arrayContaining(["vm-memory", "vm-disk", "memory"])
    );
    expect(result.checks.find((c) => c.id === "vm-memory")?.text).toMatch(/2 GB.*4 GB/);
  });

  it("blocks what will not fit in memory, counting only what is not already running", () => {
    expect(
      assessReadiness(
        facts({
          machine: { ...server, onSpinningDisk: false, memoryMb: 4096 },
          services: [wazuh],
          availableMb: 5000,
        })
      ).verdict
    ).toBe("blocked");
    // The same machine already running costs nothing more.
    const running = assessReadiness(
      facts({
        machine: {
          ...server,
          onSpinningDisk: false,
          memoryMb: 4096,
          running: true,
          toolsRunning: true,
        },
        services: [wazuh],
        availableMb: 5000,
      })
    );
    expect(running.verdict).toBe("ready");
  });

  it("blocks a service when the disk cannot hold it, and says what downloads", () => {
    const result = assessReadiness(
      facts({ services: [{ ...wazuh, downloadMb: 7000 }], dockerFreeGb: 8 })
    );
    expect(result.verdict).toBe("blocked");
    expect(result.checks.some((c) => /downloads about 6.8 GB/.test(c.text))).toBe(true);
  });

  it("is ready when nothing stands in the way", () => {
    expect(assessReadiness(facts({ services: [wazuh] })).verdict).toBe("ready");
    expect(readinessForPlanner(assessReadiness(facts({ services: [wazuh] })))).toBe("");
  });

  it("tells the planner only what constrains the steps", () => {
    const line = readinessForPlanner(
      assessReadiness(facts({ machine: server, services: [wazuh], availableMb: 7200 }))
    );
    expect(line).toMatch(/^RESOURCES ON THIS COMPUTER/);
    expect(line).toMatch(/spinning disk/);
  });

  it("says when Fadi and VMware use different copies of the same machine, instead of offering a move", () => {
    const result = assessReadiness(
      facts({ machine: { ...server, memoryMb: 4096, libraryCopy: "/home/me/vmware/ws/ws.vmx" } })
    );
    expect(result.checks.map((c) => c.id)).toContain("vm-elsewhere");
    expect(result.checks.map((c) => c.id)).not.toContain("vm-disk");
  });

  it("warns when VMware's NAT gives the machine no DNS — it cannot download anything", () => {
    const result = assessReadiness(
      facts({ machine: { ...server, memoryMb: 4096, onSpinningDisk: false, natDnsWorks: false } })
    );
    expect(result.checks.find((c) => c.id === "vm-dns")?.level).toBe("warn");
  });
});
