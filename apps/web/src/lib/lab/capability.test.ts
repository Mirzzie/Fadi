import { describe, expect, it } from "vitest";

import { canHost, placeLab, type Resource } from "./capability";

/** The user's actual hardware, as they described it. */
const laptop: Resource = {
  id: "1", label: "ThinkPad", kind: "laptop", arch: "x86_64",
  memoryMb: 24576, diskGb: 500, virtualization: "vms", alwaysOn: false,
};
const proxmox: Resource = {
  id: "2", label: "Proxmox box", kind: "hypervisor", arch: "x86_64",
  memoryMb: 32768, diskGb: 1000, virtualization: "nested", alwaysOn: true,
};
const pi: Resource = {
  id: "3", label: "Raspberry Pi", kind: "sbc", arch: "arm64",
  memoryMb: 4096, diskGb: 64, virtualization: "containers", alwaysOn: true,
};
const esp32: Resource = {
  id: "4", label: "ESP32", kind: "microcontroller", arch: "mcu",
  memoryMb: null, diskGb: null, virtualization: "none", alwaysOn: true,
};
const ALL = [laptop, proxmox, pi, esp32];

describe("refusing to propose the impossible", () => {
  it("will not put a Windows domain lab on the Raspberry Pi", () => {
    // The failure this exists to prevent: an x86 VM cannot run on ARM, and finding
    // that out three steps into an evening is the cost of not checking.
    const v = canHost({ needs: "vms", arch: ["x86_64"], memoryMb: 8192 }, pi);

    expect(v.state).toBe("infeasible");
    expect(v.reasons.join(" ")).toMatch(/x86_64.*arm64/);
  });

  it("says plainly that a microcontroller is not a host", () => {
    const v = canHost({ needs: "containers" }, esp32);

    expect(v.state).toBe("infeasible");
    expect(v.reasons[0]).toMatch(/subject, not its host/);
  });

  it("still treats the ESP32 as a resource when nothing has to be hosted on it", () => {
    // It is genuinely useful — as the thing a lab monitors, flashes or attacks.
    expect(canHost({}, esp32).state).toBe("feasible");
  });

  it("names what was short rather than just refusing", () => {
    const v = canHost({ memoryMb: 65536 }, laptop);

    expect(v.state).toBe("infeasible");
    expect(v.reasons[0]).toContain("24 GB");
  });
});

describe("choosing where a lab should live", () => {
  it("puts a three-VM Active Directory lab on hardware that can take it", () => {
    const { fits, misses } = placeLab({ needs: "vms", arch: ["x86_64"], memoryMb: 12288 }, ALL);

    expect(fits.map((f) => f.label)).toEqual(["ThinkPad", "Proxmox box"]);
    expect(misses.map((m) => m.resource.label).sort()).toEqual(["ESP32", "Raspberry Pi"]);
  });

  it("prefers the always-on machine for something that must stay up", () => {
    // A monitoring target on a laptop that goes in a bag is not a monitoring target.
    const { fits } = placeLab({ needs: "containers", alwaysOn: true }, ALL);

    expect(fits[0].alwaysOn).toBe(true);
    expect(fits.map((f) => f.label)).not.toContain("ThinkPad");
  });

  it("prefers the smallest machine that fits, leaving the big one free", () => {
    const { fits } = placeLab({ needs: "containers" }, [proxmox, pi, laptop]);

    expect(fits[0].label).toBe("Raspberry Pi");
  });

  it("explains every rejection, so the UI never says no without a reason", () => {
    const { misses } = placeLab({ needs: "nested", arch: ["x86_64"], memoryMb: 16384 }, ALL);

    for (const m of misses) {
      expect(m.reasons.length).toBeGreaterThan(0);
      expect(m.reasons.join("")).not.toMatch(/undefined|NaN|null/);
    }
  });

  it("AM01: a missing number is a question, never a yes", () => {
    // Codex executed this: a 32 GiB / 200 GB lab was reported as FITTING a machine whose
    // capacity nobody had recorded. Unknown is not a refusal — but it is not a promise
    // either, and "may fit" must never be rendered as "can run it".
    const vague: Resource = { ...laptop, id: "5", label: "Old desktop", memoryMb: null, diskGb: null };
    const v = canHost({ memoryMb: 32768, diskGb: 200 }, vague);

    expect(v.state).toBe("unverified");
    expect(v.checks.join(" ")).toMatch(/how much RAM/);
    expect(v.checks.join(" ")).toMatch(/how much free disk/);

    const { fits, unverified } = placeLab({ memoryMb: 32768, diskGb: 200 }, [vague]);
    expect(fits).toEqual([]);
    expect(unverified.map((u) => u.resource.label)).toEqual(["Old desktop"]);
  });

  it("AM02: running VMs does not establish a container runtime", () => {
    // The old model ranked nested > vms > containers and let the heavier satisfy the
    // lighter, so a Proxmox box "supported containers". A hypervisor is not a runtime.
    const v = canHost({ needs: "containers" }, proxmox);

    expect(v.state).toBe("unverified");
    expect(v.checks[0]).toMatch(/container runtime would need installing/);
  });

  it("AM02: nested still implies VMs, because that is what nested virtualisation is", () => {
    expect(canHost({ needs: "vms" }, proxmox).state).toBe("feasible");
  });

  it("impossible beats unverified — never ask someone to measure a pointless thing", () => {
    // An ARM board cannot run an x86 image however much RAM it turns out to have.
    const v = canHost({ arch: ["x86_64"], memoryMb: 99999 }, { ...pi, memoryMb: null });

    expect(v.state).toBe("infeasible");
  });

  it("returns an honest empty result rather than inventing a home", () => {
    const { fits, unverified, misses } = placeLab({ needs: "nested" }, [pi, esp32]);

    // The Pi could in principle have a hypervisor installed, so it is a question, not a
    // refusal. The ESP32 cannot host anything, so it is a refusal. Both are honest; what
    // matters is that neither is reported as a fit.
    expect(fits).toEqual([]);
    expect(unverified.map((u) => u.resource.label)).toEqual(["Raspberry Pi"]);
    expect(misses.map((m) => m.resource.label)).toEqual(["ESP32"]);
  });
});
