import { describe, expect, it } from "vitest";

import { hostOsOf, labOsOf, placementBriefing, toolchainViolations } from "./host-and-lab";

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

describe("found by running step 1 in the real lab: the distribution matters", () => {
  it("names Alpine and its package manager, and forbids apt and sudo", async () => {
    const { placementBriefing } = await import("./host-and-lab");
    // A real plan said "sudo apt-get update" for a lab that was Alpine Linux — measured: no
    // apt, no sudo. "Linux" in the briefing was true and useless.
    const brief = placementBriefing({ hostOs: "linux", template: "linux-web", hostLabel: null });
    expect(brief).toMatch(/Alpine Linux/);
    expect(brief).toMatch(/apk add/);
    expect(brief).toMatch(/NOT apt or apt-get/);
    expect(brief).toMatch(/do NOT write sudo/);
    // nginx's image has no bash.
    expect(brief).toMatch(/bash is not installed/);
  });

  it("names Ubuntu's package manager, and still forbids sudo", async () => {
    const { placementBriefing } = await import("./host-and-lab");
    const brief = placementBriefing({ hostOs: "linux", template: "linux-ubuntu", hostLabel: null });
    expect(brief).toMatch(/Ubuntu 24\.04/);
    expect(brief).toMatch(/apt-get install -y/);
    // Measured: the Ubuntu image does not ship sudo either.
    expect(brief).toMatch(/do NOT write sudo/);
  });

  it("tells them exactly how to get a shell in the lab", async () => {
    const { placementBriefing } = await import("./host-and-lab");
    // "Open a terminal in the lab machine" was the instruction, with no way to do it.
    const brief = placementBriefing({
      hostOs: "linux",
      template: "linux-web",
      hostLabel: null,
      containerName: "fadi-project-bb94e388",
    });
    expect(brief).toContain("docker exec -it fadi-project-bb94e388 sh");
  });
});

describe("checking a plan against the distribution", () => {
  it("THE REAL ONE: sudo apt-get on Alpine", async () => {
    const { toolchainViolations } = await import("./host-and-lab");
    const v = toolchainViolations("In the lab, run: sudo apt-get update", "linux-web");
    expect(v.some((x) => /sudo/.test(x))).toBe(true);
    expect(v.some((x) => /apt/.test(x))).toBe(true);
  });

  it("apk on Ubuntu, and bash on a shell-only image", async () => {
    const { toolchainViolations } = await import("./host-and-lab");
    expect(toolchainViolations("apk add nginx", "linux-ubuntu").some((x) => /apk/.test(x))).toBe(true);
    expect(toolchainViolations("run bash setup.sh", "linux-web").some((x) => /bash/.test(x))).toBe(true);
    // postgres:16-alpine DOES ship bash, measured — so it must not be flagged there.
    expect(toolchainViolations("run bash setup.sh", "linux-postgres")).toEqual([]);
  });

  it("passes a plan that matches", async () => {
    const { toolchainViolations } = await import("./host-and-lab");
    expect(toolchainViolations("apk add openssl && nginx -t", "linux-web")).toEqual([]);
    expect(toolchainViolations("apt-get update && apt-get install -y nginx", "linux-ubuntu")).toEqual([]);
  });

  it("does not flag the word sudo in an explanation", async () => {
    const { toolchainViolations } = await import("./host-and-lab");
    // Only as a command. "you don't need sudo here" is exactly the right thing to write.
    expect(toolchainViolations("Commands run as root, so pseudo-privileges are not needed.", "linux-web")).toEqual([]);
  });
});

describe("a container has no service manager", () => {
  it("THE REPORTED STEP: rc-service in the nginx lab is flagged", () => {
    const step = "rc-service nginx start\nrc-service fail2ban start";
    expect(toolchainViolations(step, "linux-web")).toContain(
      "rc-service/systemctl/service, which do not exist in a container",
    );
  });

  it("systemctl and `service x restart` are flagged on Ubuntu too", () => {
    expect(toolchainViolations("systemctl enable --now nginx", "linux-ubuntu")).toHaveLength(1);
    expect(toolchainViolations("service nginx restart", "linux-ubuntu")).toHaveLength(1);
  });

  it("prose that merely says 'service' is not flagged", () => {
    expect(toolchainViolations("Check the service responds on port 8080.", "linux-web")).toEqual([]);
  });

  it("the briefing says nginx is already running and the lab cannot enforce bans", () => {
    const b = placementBriefing({ hostOs: "linux", template: "linux-web", hostLabel: "laptop" });
    expect(b).toMatch(/NO service manager/);
    expect(b).toMatch(/nginx is ALREADY RUNNING/);
    expect(b).toMatch(/nginx -s reload/);
    expect(b).toMatch(/cannot change firewall rules/);
  });
});

describe("no hypervisor inside the lab", () => {
  it("catches the step that left the Windows lab in a boot loop (15 Oct 2026)", async () => {
    const { nestedVirtualisationViolations } = await import("./host-and-lab");
    const step =
      "In the lab PowerShell, execute winget install -e --id Docker.DockerDesktop to install Docker Desktop.";
    expect(nestedVirtualisationViolations(step)).toContain(
      "Docker Desktop (a hypervisor inside the lab)"
    );
    expect(
      nestedVirtualisationViolations(
        "Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform"
      )
    ).toContain("Hyper-V (a hypervisor inside the lab)");
    expect(nestedVirtualisationViolations("wsl --install")).toContain(
      "WSL (a hypervisor inside the lab)"
    );
    expect(nestedVirtualisationViolations("sudo apt-get install -y docker.io")).toContain(
      "Docker inside the lab machine"
    );
  });

  it("leaves the agent install and ordinary mentions alone", async () => {
    const { nestedVirtualisationViolations } = await import("./host-and-lab");
    expect(
      nestedVirtualisationViolations(
        "Download wazuh-agent-4.14.9-1.msi and run msiexec.exe /i wazuh-agent.msi /q WAZUH_MANAGER='172.16.89.1'. The manager runs in Docker beside the lab."
      )
    ).toEqual([]);
  });
});
