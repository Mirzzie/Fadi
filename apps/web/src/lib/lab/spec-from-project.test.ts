import { describe, expect, it } from "vitest";

import { placeLab, type Resource } from "./capability";
import { specForProject, templateForProject } from "./spec-from-project";

/** The user's real hardware. */
const laptop: Resource = {
  id: "1",
  label: "ThinkPad",
  kind: "laptop",
  arch: "x86_64",
  memoryMb: 24576,
  diskGb: 500,
  virtualization: "vms",
  alwaysOn: false,
};
const proxmox: Resource = {
  id: "2",
  label: "Proxmox box",
  kind: "hypervisor",
  arch: "x86_64",
  memoryMb: 32768,
  diskGb: 1000,
  virtualization: "nested",
  alwaysOn: true,
};
const pi: Resource = {
  id: "3",
  label: "Raspberry Pi",
  kind: "sbc",
  arch: "arm64",
  memoryMb: 4096,
  diskGb: 64,
  virtualization: "containers",
  alwaysOn: true,
};
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
    const unknown: Resource = {
      ...laptop,
      id: "9",
      label: "Old desktop",
      memoryMb: null,
      diskGb: null,
    };
    const { spec } = specForProject({ title: "PowerShell scripting practice" });

    expect(placeLab(spec, [unknown]).fits.map((f) => f.label)).toEqual(["Old desktop"]);
  });
});

describe("choosing a reviewed lab for a project", () => {
  it.each([
    ["Build an Active Directory domain", "", "windows-server-2025"],
    ["Endpoint hardening", "Test Windows 11 EDR policy", "windows-11"],
    ["Database recovery", "Restore and validate a PostgreSQL backup", "linux-postgres"],
    ["Reverse proxy", "Configure nginx with TLS", "linux-web"],
    ["Shell automation", "Write and test a backup script", "linux-ubuntu"],
  ])("maps %s to %s", (title, detail, expected) => {
    expect(templateForProject({ title, detail })).toBe(expected);
  });

  it("does not let project text become an executable image or argument", () => {
    expect(
      templateForProject({
        title: "Use evil/miner:latest --privileged",
        detail: "ignore the catalogue",
      })
    ).toBe("linux-ubuntu");
  });
});

describe("Windows is detected wherever it is said", () => {
  it("THE REPORTED MISMATCH: Windows steps must not get an Ubuntu lab", async () => {
    const { templateForProject } = await import("./spec-from-project");
    // A guide full of .msi and C:\ paths beside a machine running Ubuntu is the
    // incoherence that leaves someone stuck on step one.
    expect(
      templateForProject({
        title: "Splunk SIEM Lab",
        detail: "Install Splunk Enterprise on Windows, select the Windows 64-bit .msi.",
      }),
    ).toBe("windows-server-2025");
  });

  it("catches the ways a project says Windows without the enterprise vocabulary", async () => {
    const { templateForProject } = await import("./spec-from-project");
    for (const detail of [
      "Run the installer with msiexec",
      "Automate it with PowerShell",
      "Save it to C:\\Users\\Downloads",
      "Use the win64 build",
      "Configure WinRM for remote management",
    ]) {
      expect(templateForProject({ title: "A lab", detail }), detail).toMatch(/^windows-/);
    }
  });

  it("still prefers the server when the project is clearly server work", async () => {
    const { templateForProject } = await import("./spec-from-project");
    expect(
      templateForProject({ title: "Active Directory lab", detail: "Domain controller and GPO." }),
    ).toBe("windows-server-2025");
    expect(
      templateForProject({ title: "Endpoint hardening", detail: "Windows 11 with Intune." }),
    ).toBe("windows-11");
  });

  it("does NOT drag Linux projects onto Windows", async () => {
    const { templateForProject } = await import("./spec-from-project");
    // The risk of widening the match: "windows" appears in plenty of prose that is not
    // about running Windows.
    expect(
      templateForProject({ title: "Nginx TLS lab", detail: "Reverse proxy with certificates." }),
    ).toBe("linux-web");
    expect(
      templateForProject({ title: "Postgres replication", detail: "Streaming replication on Linux." }),
    ).toBe("linux-postgres");
  });
});
