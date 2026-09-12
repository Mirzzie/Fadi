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

  it("same family is still two machines, and the work goes in the disposable one", () => {
    const brief = placementBriefing({ hostOs: "linux", template: "linux-ubuntu", hostLabel: "This laptop" });
    // The earlier wording only said "say which machine each step happens on", which let a
    // real plan install nginx on the laptop with sudo. It now says where the work goes.
    expect(brief).toMatch(/SEPARATE, DISPOSABLE machine/);
    expect(brief).toMatch(/INSIDE the lab machine/);
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

describe("the briefing always says what the lab is NOT", () => {
  it("forbids Windows even when host and lab are both Linux", async () => {
    const { placementBriefing } = await import("./host-and-lab");
    // Found by re-planning a real Splunk project: with both machines on Linux the briefing
    // only distinguished the two MACHINES, so the model wrote msiexec, PowerShell and
    // C:\Program Files anyway. Familiar Windows install stories pull a plan toward Windows
    // unless the instruction is explicit.
    const brief = placementBriefing({ hostOs: "linux", template: "linux-ubuntu", hostLabel: "This laptop" });
    expect(brief).toMatch(/Every command in this plan runs on Linux/);
    expect(brief).toMatch(/Do NOT write/);
    expect(brief).toMatch(/msiexec/);
    expect(brief).toMatch(/usual install guide is written for Windows/);
  });

  it("forbids Linux syntax when the lab is Windows", async () => {
    const { placementBriefing } = await import("./host-and-lab");
    const brief = placementBriefing({ hostOs: "windows", template: "windows-server-2025", hostLabel: null });
    expect(brief).toMatch(/Every command in this plan runs on Windows/);
    expect(brief).toMatch(/apt/);
    expect(brief).toMatch(/systemctl/);
  });
})

describe("checking a plan against its own machine", () => {
  it("catches Windows constructs in a Linux plan", async () => {
    const { osViolations } = await import("./host-and-lab");
    // Exactly what came back from a real re-plan after being told not to.
    expect(osViolations("Save it to C:\\Logs\\apache_access.log", "linux")).toContain("a Windows drive path");
    expect(osViolations("run msiexec /i splunk.msi", "linux").length).toBeGreaterThan(0);
    expect(osViolations("Open PowerShell as Administrator", "linux")).toContain("PowerShell");
    expect(osViolations("Get-Service Splunkd", "linux")).toContain("a PowerShell cmdlet");
  });

  it("catches Linux constructs in a Windows plan", async () => {
    const { osViolations } = await import("./host-and-lab");
    expect(osViolations("run apt install splunk", "windows")).toContain("apt");
    expect(osViolations("systemctl enable splunkd", "windows")).toContain("systemctl");
  });

  it("does NOT flag ordinary prose that merely mentions an OS", async () => {
    const { osViolations } = await import("./host-and-lab");
    // The word is fine; the construct is not. Flagging "Windows" as a word would make the
    // check fire on every comparison and get switched off.
    expect(osViolations("Unlike Windows, Linux keeps logs in /var/log.", "linux")).toEqual([]);
    expect(osViolations("This is the Linux equivalent of Task Manager.", "windows")).toEqual([]);
  });

  it("reports each violation once", async () => {
    const { osViolations } = await import("./host-and-lab");
    const many = "C:\\a and C:\\b and C:\\c";
    expect(osViolations(many, "linux")).toEqual(["a Windows drive path"]);
  });
});

describe("briefing a project with no lab", () => {
  it("tells the planner there is no machine, plainly", async () => {
    const { placementBriefing } = await import("./host-and-lab");
    const brief = placementBriefing({ hostOs: "linux", template: null, hostLabel: null });

    expect(brief).toMatch(/NEEDS NO LAB MACHINE/);
    // The exact phrase that appeared in the broken plan must be forbidden, or the model
    // keeps writing steps for a machine that is not there.
    expect(brief).toMatch(/Do NOT say "in the lab machine"/);
    expect(brief).toMatch(/browser/i);
    // And it must not invent an OS instruction for a machine that does not exist.
    expect(brief).not.toMatch(/Every command in this plan runs on/);
  });
});

describe("found by driving the hub: the work goes IN the lab", () => {
  it("forbids installing on the person's own computer even when both run Linux", async () => {
    const { placementBriefing } = await import("./host-and-lab");
    // A real plan said "On the laptop, run: sudo apt install -y nginx certbot fail2ban
    // filebeat" for a project with a container lab.
    const brief = placementBriefing({ hostOs: "linux", template: "linux-web", hostLabel: null });
    expect(brief).toMatch(/INSIDE the lab machine/);
    expect(brief).toMatch(/Never tell them to install software, use sudo/);
    expect(brief).toMatch(/DISPOSABLE/);
  });

  it("rules out what a local lab cannot do", async () => {
    const { placementBriefing } = await import("./host-and-lab");
    // The same plan wanted a Let's Encrypt certificate for a public domain — impossible for
    // a container on a laptop.
    const brief = placementBriefing({ hostOs: "linux", template: "linux-web", hostLabel: null });
    expect(brief).toMatch(/no public domain/);
    expect(brief).toMatch(/never Let's Encrypt/);
    expect(brief).toMatch(/self-signed/);
    expect(brief).toMatch(/default repositories/);
  });

  it("says none of that when there is no lab", async () => {
    const { placementBriefing } = await import("./host-and-lab");
    const brief = placementBriefing({ hostOs: "linux", template: null, hostLabel: null });
    expect(brief).not.toMatch(/INSIDE the lab machine/);
  });
});
