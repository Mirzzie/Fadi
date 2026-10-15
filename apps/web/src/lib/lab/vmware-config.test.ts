import { describe, expect, it } from "vitest";

import {
  familyOf,
  newScreenPassword,
  parseInventory,
  parseVmx,
  screenEntries,
  screenOf,
  screenPortFor,
  setVmxEntries,
  summariseVmx,
} from "./vmware-config";

const VMX = [
  '.encoding = "UTF-8"',
  'displayName = "Windows Server 2025"',
  'guestOS = "windows2022srvnext-64"',
  'memsize = "4096"',
  'numvcpus = "2"',
  'ethernet0.connectionType = "nat"',
  "",
].join("\n");

describe("reading a VM's settings", () => {
  it("describes the machine from its .vmx", () => {
    expect(summariseVmx(parseVmx(VMX), "fallback")).toEqual({
      name: "Windows Server 2025",
      guestOs: "windows2022srvnext-64",
      family: "windows-server",
      memoryMb: 4096,
      cpus: 2,
      screen: null,
    });
  });

  it("knows the OS family from VMware's guest id", () => {
    expect(familyOf("windows11-64")).toBe("windows");
    expect(familyOf("windows2019srv-64")).toBe("windows-server");
    expect(familyOf("debian12-64")).toBe("linux");
    expect(familyOf("other-64")).toBe("other");
  });

  it("reads VMware's library", () => {
    const inventory = [
      '.encoding = "UTF-8"',
      'vmlist4.config = "/hdd/vmware/kali/kali.vmx"',
      'vmlist4.DisplayName = "KALI"',
      'vmlist5.config = "folder1"',
      'vmlist7.config = "/hdd/vmware/Windows Server 2025/Windows Server 2025.vmx"',
      'vmlist7.DisplayName = "Windows Server 2025"',
    ].join("\n");
    expect(parseInventory(inventory)).toEqual([
      { vmxPath: "/hdd/vmware/kali/kali.vmx", name: "KALI" },
      {
        vmxPath: "/hdd/vmware/Windows Server 2025/Windows Server 2025.vmx",
        name: "Windows Server 2025",
      },
    ]);
  });
});

describe("turning the screen on", () => {
  it("changes only the screen lines and keeps every other line as VMware wrote it", () => {
    const screen = { port: 5931, password: "Ab3dEf7h" };
    const written = setVmxEntries(VMX, screenEntries(screen));
    for (const line of VMX.split("\n").filter(Boolean)) expect(written).toContain(line);
    expect(screenOf(parseVmx(written))).toEqual(screen);
  });

  it("replaces an existing screen line instead of adding a second one", () => {
    const once = setVmxEntries(VMX, screenEntries({ port: 5931, password: "Ab3dEf7h" }));
    const twice = setVmxEntries(once, screenEntries({ port: 5944, password: "Zz9yXx8w" }));
    expect(twice.match(/RemoteDisplay\.vnc\.port/g)).toHaveLength(1);
    expect(screenOf(parseVmx(twice))?.port).toBe(5944);
  });

  it("does not show a screen someone opened to the network", () => {
    const open = setVmxEntries(VMX, {
      ...screenEntries({ port: 5931, password: "Ab3dEf7h" }),
      "RemoteDisplay.vnc.ip": "0.0.0.0",
    });
    expect(screenOf(parseVmx(open))).toBeNull();
  });

  it("gives each machine a stable port that avoids ones in use", () => {
    const first = screenPortFor("machine-a", new Set());
    expect(screenPortFor("machine-a", new Set())).toBe(first);
    expect(first).toBeGreaterThanOrEqual(5901);
    expect(first).toBeLessThanOrEqual(5999);
    expect(screenPortFor("machine-a", new Set([first]))).not.toBe(first);
  });

  it("makes eight-character passwords that need no escaping", () => {
    expect(newScreenPassword()).toMatch(/^[A-Za-z0-9]{8}$/);
  });
});
