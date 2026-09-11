import { describe, expect, it } from "vitest";

import { hostOsOf, labOsOf, placementBriefing } from "./host-and-lab";

/**
 * The bug: a Windows .msi and a C:\ path in a plan for a Linux laptop.
 *
 * The naive fix — "tell the model the host OS" — makes the opposite error available: a
 * Splunk-on-Windows-Server project rewritten as Linux steps, which teaches something
 * nobody asked to learn. Both machines have to be named, and so does which one each step
 * belongs to.
 */

describe("reading the host", () => {
  it("maps node's platform names to ones a person would use", () => {
    expect(hostOsOf("linux")).toBe("linux");
    expect(hostOsOf("darwin")).toBe("macos");
    expect(hostOsOf("win32")).toBe("windows");
    // Something unanticipated must not silently become Linux.
    expect(hostOsOf("freebsd")).toBe("unknown");
  });
});

describe("reading the lab", () => {
  it("knows a Windows template runs Windows even though docker starts it", () => {
    expect(labOsOf("windows-server-2025")).toBe("windows");
    expect(labOsOf("windows-11")).toBe("windows");
    expect(labOsOf("linux-ubuntu")).toBe("linux");
  });
});

describe("telling the planner where the work happens", () => {
  it("A WINDOWS PROJECT ON A LINUX LAPTOP: the work goes in the lab, not on the laptop", () => {
    const brief = placementBriefing({ hostOs: "linux", template: "windows-server-2025", hostLabel: "This laptop" });

    expect(brief).toContain("runs Linux");
    expect(brief).toMatch(/INSIDE THE WINDOWS LAB/);
    // The specific instruction that stops the reported bug recurring.
    expect(brief).toMatch(/Never tell them to install Windows software on Linux/);
    expect(brief).toMatch(/\.msi/);
  });

  it("A LINUX PROJECT ON A WINDOWS LAPTOP: the mirror image, handled the same way", () => {
    const brief = placementBriefing({ hostOs: "windows", template: "linux-ubuntu", hostLabel: null });
    expect(brief).toContain("runs Windows");
    expect(brief).toMatch(/INSIDE THE LINUX LAB/);
    expect(brief).toMatch(/apt/);
  });

  it("same family is still two machines", () => {
    const brief = placementBriefing({ hostOs: "linux", template: "linux-ubuntu", hostLabel: "This laptop" });
    // "on your machine" is the phrase that makes a plan unfollowable when there are two.
    expect(brief).toMatch(/separate machine/);
    expect(brief).toMatch(/on your machine/);
  });

  it("says plainly that macOS cannot be provisioned", () => {
    const brief = placementBriefing({ hostOs: "macos", template: "linux-ubuntu", hostLabel: null });
    expect(brief).toContain("macOS");
    // Apple's licensing is a fact, not an excuse, and a plan that pretended otherwise would
    // produce steps nobody can run.
    expect(brief).toMatch(/cannot provision macOS/);
    expect(brief).toMatch(/Apple hardware/);
  });

  it("names the lab machine so the person knows what they are looking at", () => {
    const brief = placementBriefing({ hostOs: "linux", template: "windows-server-2025", hostLabel: "This laptop" });
    expect(brief).toContain("Windows Server 2025");
    expect(brief).toContain("This laptop");
  });
});
