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

    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reasons.join(" ")).toMatch(/x86_64.*arm64|only does containers/);
  });

  it("says plainly that a microcontroller is not a host", () => {
    const v = canHost({ needs: "containers" }, esp32);

    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reasons[0]).toMatch(/subject, not its host/);
  });

  it("still treats the ESP32 as a resource when nothing has to be hosted on it", () => {
    // It is genuinely useful — as the thing a lab monitors, flashes or attacks.
    expect(canHost({}, esp32).ok).toBe(true);
  });

  it("names what was short rather than just refusing", () => {
    const v = canHost({ memoryMb: 65536 }, laptop);

    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reasons[0]).toContain("24 GB");
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

  it("does not refuse a plan just because a number is missing", () => {
    // Half the machines anyone owns are described from memory. Unknown RAM is not a no.
    const vague: Resource = { ...laptop, id: "5", label: "Old desktop", memoryMb: null, diskGb: null };

    expect(canHost({ memoryMb: 8192, diskGb: 100 }, vague).ok).toBe(true);
  });

  it("returns an honest empty result rather than inventing a home", () => {
    const { fits, misses } = placeLab({ needs: "nested" }, [pi, esp32]);

    expect(fits).toEqual([]);
    expect(misses).toHaveLength(2);
  });
});
