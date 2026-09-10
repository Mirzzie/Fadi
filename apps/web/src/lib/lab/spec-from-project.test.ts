import { describe, expect, it } from "vitest";

import { placeLab, type Resource } from "./capability";
import { specForProject } from "./spec-from-project";

/** The user's real hardware. */
const laptop: Resource = { id: "1", label: "ThinkPad", kind: "laptop", arch: "x86_64", memoryMb: 24576, diskGb: 500, virtualization: "vms", alwaysOn: false };
const proxmox: Resource = { id: "2", label: "Proxmox box", kind: "hypervisor", arch: "x86_64", memoryMb: 32768, diskGb: 1000, virtualization: "nested", alwaysOn: true };
const pi: Resource = { id: "3", label: "Raspberry Pi", kind: "sbc", arch: "arm64", memoryMb: 4096, diskGb: 64, virtualization: "containers", alwaysOn: true };
const ALL = [laptop, proxmox, pi];

describe("what a suggested project needs", () => {
  it("routes a Windows domain lab away from the ARM board", () => {
    const { spec } = specForProject({
      title: "Active Directory & hybrid IT network simulation",
      detail: "Stand up a domain controller and two Windows workstations, then break replication.",
    });
    const { fits, misses } = placeLab(spec, ALL);

    expect(spec.needs).toBe("vms");
    expect(spec.arch).toEqual(["x86_64"]);
    expect(fits.map((f) => f.label)).toEqual(["ThinkPad", "Proxmox box"]);
    expect(misses.map((m) => m.resource.label)).toEqual(["Raspberry Pi"]);
  });

  it("puts a monitoring stack on the machine that stays up", () => {
    const { spec } = specForProject({
      title: "Log aggregation and dashboards",
      detail: "Run a container stack that scrapes metrics and keeps a dashboard available.",
    });
    const { fits } = placeLab(spec, ALL);

    expect(spec.needs).toBe("containers");
    expect(spec.alwaysOn).toBe(true);
    // The laptop closes; the Pi does not.
    expect(fits.map((f) => f.label)).not.toContain("ThinkPad");
    expect(fits[0].label).toBe("Raspberry Pi");
  });

  it("says WHY, in the user's terms, never as a bare verdict", () => {
    const { because } = specForProject({
      title: "Windows Server patching lab",
      detail: "Three virtual machines to practise a patch cycle.",
    });

    expect(because.join(" ")).toMatch(/x86-only/);
    expect(because.join(" ")).toMatch(/virtual machines/);
    expect(because.join("")).not.toMatch(/undefined|NaN/);
  });

  it("claims no constraint it cannot read, rather than guessing", () => {
    // An under-described project must not acquire invented requirements. "16 GB" for a
    // project nobody sized is exactly the confident number this platform must not make.
    const { spec, because } = specForProject({ title: "PowerShell scripting practice" });

    expect(spec).toEqual({});
    expect(because).toEqual([]);
  });

  it("only asks for memory when the text implies more than one machine", () => {
    const single = specForProject({ title: "Build a VM and install Linux" });
    const many = specForProject({ title: "Three virtual machines in a small lab network" });

    expect(single.spec.memoryMb).toBeUndefined();
    expect(many.spec.memoryMb).toBe(12288);
  });

  it("an unsized project fits a machine of unknown capacity — and says so as feasible, not verified", () => {
    // The honest reading of "nothing to check": placeLab returns it as a fit because no
    // constraint was asserted, which is different from having confirmed anything.
    const unknown: Resource = { ...laptop, id: "9", label: "Old desktop", memoryMb: null, diskGb: null };
    const { spec } = specForProject({ title: "PowerShell scripting practice" });

    expect(placeLab(spec, [unknown]).fits.map((f) => f.label)).toEqual(["Old desktop"]);
  });
});
