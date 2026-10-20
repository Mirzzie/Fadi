import { describe, expect, it } from "vitest";

import {
  describeChanges,
  machineChangeEntries,
  parseVmx,
  readMachineSettings,
  setVmxEntries,
  validMachineChanges,
} from "./vmware-config";

const VMX = [
  'numvcpus = "2"',
  'cpuid.coresPerSocket = "1"',
  'memsize = "4048"',
  'ethernet0.connectionType = "nat"',
  'svga.vramSize = "268435456"',
  "",
].join("\n");

describe("machine settings from Fadi", () => {
  it("reads what the machine has now", () => {
    expect(readMachineSettings(parseVmx(VMX))).toEqual({
      cpus: 2,
      memoryMb: 4048,
      network: "nat",
      screen: "auto",
    });
  });

  it("keeps only values from the closed set", () => {
    expect(
      validMachineChanges({
        cpus: 64,
        memoryMb: 4096,
        network: "bridged",
        screen: "1920x1080",
        "svga.maxWidth": "99999",
      })
    ).toEqual({ memoryMb: 4096, screen: "1920x1080" });
  });

  it("writes exactly the lines each change needs", () => {
    const written = setVmxEntries(
      VMX,
      machineChangeEntries({ cpus: 4, network: "hostonly", screen: "1600x900" })
    );
    const after = readMachineSettings(parseVmx(written));
    expect(after).toEqual({ cpus: 4, memoryMb: 4048, network: "hostonly", screen: "1600x900" });
    expect(written).toContain('cpuid.coresPerSocket = "4"');
    expect(written).toContain('svga.vramSize = "268435456"');
  });

  it("says what will change in words", () => {
    expect(describeChanges({ memoryMb: 6144, network: "hostonly" })).toEqual([
      "6 GB memory",
      "network: host-only (this computer only, no internet)",
    ]);
  });
});
