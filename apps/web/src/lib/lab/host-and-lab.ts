import { LAB_TEMPLATES, type TemplateKey } from "./templates";

/**
 * THE HOST IS NOT THE LAB.
 *
 * A plan was produced telling the owner to download a Windows .msi into
 * C:\Users\%USERNAME%\Downloads — on a Linux laptop. The first fix was to tell the planner
 * which OS the machine runs. That was necessary and not sufficient, because it makes the
 * opposite error available: a Splunk-on-Windows project rewritten as Linux steps, teaching
 * something nobody asked to learn.
 *
 * There are two machines in every practical project and they are frequently different:
 *
 *   the HOST — the person's own laptop, where they open a browser and type `docker`;
 *   the LAB  — what Fadi provisions, where the actual work happens.
 *
 * So the planner is told both, and told which steps belong to which. A Windows project on a
 * Linux laptop is not a contradiction to be smoothed over — it is a Windows lab, started
 * from a Linux host.
 */

export type HostOs = "linux" | "macos" | "windows" | "unknown";

export type LabOs = "windows" | "linux";

export function hostOsOf(platform: string): HostOs {
  if (platform === "linux") return "linux";
  if (platform === "darwin") return "macos";
  if (platform === "win32") return "windows";
  return "unknown";
}

const HOST_LABEL: Record<HostOs, string> = {
  linux: "Linux",
  macos: "macOS",
  windows: "Windows",
  unknown: "an unrecognised system",
};

/** Which OS the lab template actually runs. */
export function labOsOf(template: TemplateKey): LabOs {
  return LAB_TEMPLATES[template].needsVirtualisation ? "windows" : "linux";
}

/**
 * What the planner needs to know about where the work happens.
 *
 * Written as instructions rather than facts, because a model given "host: linux, lab:
 * windows" will still write whichever it saw last. Naming the failure is what prevents it.
 */
export function placementBriefing(input: {
  hostOs: HostOs;
  template: TemplateKey | null;
  hostLabel: string | null;
  /** The lab's container name, when known, so the plan can say exactly how to get in. */
  containerName?: string | null;
}): string {
  const host = HOST_LABEL[input.hostOs];

  // NO LAB, and that is a real answer.
  //
  // A ServiceNow project was given an Ubuntu container; ServiceNow is a website. The plan
  // then said "on the laptop (Ubuntu 24.04) open a web browser", conflating the laptop
  // with a machine that had no reason to exist. When nothing needs provisioning the
  // planner is told so plainly, or it will write steps for a machine that is not there.
  if (!input.template) {
    return [
      `The person's own computer runs ${host}.`,
      "THIS PROJECT NEEDS NO LAB MACHINE. It is done in a browser or on their own computer — a hosted product, a vendor console, or writing.",
      `Write every step for their own ${host} computer or for the website in question. Do NOT say "in the lab machine", do not reference a container or a VM, and do not ask them to install an operating system for this.`,
      "If something does need to be saved, save it in their own working folder.",
    ].join("\n");
  }

  const labOs = labOsOf(input.template);
  const lab = LAB_TEMPLATES[input.template];

  const lines = [
    `The person's own computer runs ${host}.`,
    `The lab for this project is ${lab.label}, which runs ${labOs === "windows" ? "Windows" : "Linux"}${
      input.hostLabel ? `, hosted on ${input.hostLabel}` : ""
    }.`,
  ];

  // WHICH MACHINE each step happens on.
  if (labOs === "windows" && input.hostOs !== "windows") {
    lines.push(
      `THE WORK HAPPENS INSIDE THE WINDOWS LAB, NOT ON THEIR ${host.toUpperCase()} COMPUTER.`,
      `Windows steps — .msi installers, PowerShell, C:\\ paths, Server Manager — belong inside the lab and must say so: "in the lab machine, ...".`,
      `Anything they do on their own ${host} computer is limited to opening a browser, approving what Fadi asks for, and running the commands Fadi proposes. Never tell them to install Windows software on ${host}.`
    );
  } else if (labOs === "linux" && input.hostOs !== "linux") {
    lines.push(
      `THE WORK HAPPENS INSIDE THE LINUX LAB, NOT ON THEIR ${host.toUpperCase()} COMPUTER.`,
      `Linux steps — apt, systemctl, /etc paths — belong inside the lab and must say so: "in the lab machine, ...".`
    );
  } else {
    lines.push(
      `The lab runs the same family as their computer, but it is a SEPARATE, DISPOSABLE machine.`
    );
  }

  // THE WORK HAPPENS IN THE LAB — stated for every lab, not only when the OS differs.
  //
  // Driving the hub end to end produced "On the laptop, run: sudo apt install -y nginx
  // certbot fail2ban filebeat" for a project with a container lab. Both machines ran Linux,
  // so nothing had said the laptop was off limits, and the plan installed four services on
  // the person's own computer with sudo — the exact damage a disposable lab exists to
  // prevent.
  lines.push(
    `ALL hands-on steps — installing packages, editing config, starting services, running tests — happen INSIDE the lab machine and must say so ("in the lab machine, run ..."). Their own ${host} computer is used only to open the lab and approve what Fadi asks for. Never tell them to install software, use sudo, or edit system files on their own computer.`
  );

  // WHICH DISTRIBUTION, AND HOW TO GET IN.
  //
  // "Linux" was true and useless. A plan said "in the lab machine, open a terminal and run:
  // sudo apt-get update" for a lab that was Alpine — no apt, no sudo — and never said how to
  // open a terminal in a container at all. Both facts are now stated exactly, including the
  // command that gets them in, so step one is something they can actually do.
  const tc = lab.toolchain;
  if (tc.shell === "powershell") {
    lines.push(
      `The lab is ${tc.distro}. Use PowerShell and ${tc.packageManager} for installs. They reach it through the desktop viewer Fadi opens, not a terminal on their own computer.`
    );
    if (lab.signIn) {
      lines.push(
        `They sign in as "${lab.signIn.user}" with the password "${lab.signIn.password}" — a local administrator created when the lab installed, and shown in Fadi's lab panel. There is NO other account to be given: never say "the supplied Administrator credentials". Elevated steps say "open PowerShell as Administrator" (right-click, Run as administrator) under this account. Where a step needs a NEW password (a domain's Safe Mode password, a service account), the step itself tells them to choose one and write it down.`
      );
    }
  } else {
    lines.push(
      `The lab is ${tc.distro}. Install packages with \`${tc.packageManager === "apk" ? "apk add" : "apt-get install -y"}\`${
        tc.packageManager === "apt" ? " after `apt-get update`" : ""
      } — ${tc.packageManager === "apk" ? "NOT apt or apt-get, which do not exist here" : "NOT apk"}.`,
      `Commands in the lab run as root: do NOT write sudo, which is not installed and fails with "command not found".`,
      `The lab's shell is ${tc.shell}${tc.shell === "sh" ? " (bash is not installed — avoid bash-only syntax)" : ""}.`,
      input.containerName
        ? `Their first step must be opening a shell in the lab, with exactly: docker exec -it ${input.containerName} ${tc.shell}`
        : `Their first step must be opening a shell in the lab with docker exec -it <lab-name> ${tc.shell}.`
    );
    if (tc.serviceManager === "none") {
      lines.push(
        "The lab is a container with NO service manager: rc-service, systemctl and service do not exist. Start a background program by running it directly (for example `fail2ban-client start`, or `crond -b`) and check it with `ps`."
      );
    }
    if (tc.mainService) {
      lines.push(
        `${tc.mainService.name} is ALREADY RUNNING as the lab's main process. Never tell them to start it; apply config changes with \`${tc.mainService.reload}\`.`
      );
      if (tc.mainService.logs) lines.push(tc.mainService.logs);
    }
    if (!tc.firewall) {
      lines.push(
        "The lab cannot change firewall rules (no iptables/nftables permission). Anything that works by blocking traffic — fail2ban bans, iptables rules — will not take effect; if the project needs it, have them verify detection (logs, fail2ban-client status/regex tests) and say plainly that enforcement is out of scope for this lab."
      );
    }
  }

  // AND WHAT A LOCAL LAB CANNOT DO.
  //
  // The same plan asked for a Let's Encrypt certificate "for a domain that resolves to"
  // the server — impossible for a container on a laptop, with no public domain and no
  // inbound port 80 — and installed filebeat from a repository Ubuntu does not ship. A step
  // that cannot work is a dead end however well it is written.
  lines.push(
    "The lab is local: it has no public domain name and cannot receive traffic from the internet. Use self-signed certificates (openssl or mkcert), localhost, or the lab's own address — never Let's Encrypt or a real domain. Use packages available in the distribution's default repositories, or state the exact commands to add the vendor repository first."
  );

  // AND WHAT THE LAB IS NOT — always, not only when the two machines differ.
  //
  // Found by re-planning a real project and reading what came back. With host and lab both
  // Linux, the branch above distinguishes the two MACHINES and never rules out another OS;
  // the model, seeing "Splunk", wrote msiexec, PowerShell and C:\Program Files anyway,
  // because nothing had told it not to. Software with a familiar Windows install story
  // pulls a plan toward Windows unless the instruction is explicit.
  if (labOs === "linux") {
    lines.push(
      "Every command in this plan runs on Linux. Use Linux paths, package managers and shells. Do NOT write a C:\\ path, a .msi, msiexec, PowerShell, a Windows service, or any Windows UI step — not even for software whose usual install guide is written for Windows."
    );
  } else {
    lines.push(
      "Every command in this plan runs on Windows. Use Windows paths, PowerShell and Windows tooling. Do NOT write apt, systemctl, /etc paths or bash-only syntax."
    );
  }

  if (input.hostOs === "macos") {
    // Worth stating rather than discovering: there is no macOS lab, and pretending
    // otherwise would produce steps nobody can run.
    lines.push(
      "Fadi cannot provision macOS — Apple's licensing restricts it to Apple hardware — so a project needing macOS specifically has to be done on their own computer, and you should say that plainly."
    );
  }

  return lines.join("\n");
}

/**
 * DOES THIS PLAN MATCH THE MACHINE IT RUNS ON?
 *
 * The briefing tells the model which OS the lab is. It is not a guarantee. Re-planning a
 * real Splunk project with an explicit "do NOT write a C:\\ path, a .msi, msiexec or
 * PowerShell" still produced `C:\Logs\apache_access.log` and `C:\Program Files` — the
 * titles turned Linux, the instructions did not. Software with a familiar Windows install
 * story pulls hard, and a smaller model follows the pull.
 *
 * So the output is CHECKED rather than trusted, which is the same rule the rest of this
 * codebase applies to everything a model produces. A plan that contradicts its own machine
 * is not a stylistic problem — it is unfollowable from step one.
 */
export function osViolations(text: string, labOs: LabOs): string[] {
  const found: string[] = [];

  if (labOs === "linux") {
    // Windows-only constructs. Deliberately narrow: "Windows" as a word is fine in prose
    // ("unlike Windows, ..."), a C:\ path is not.
    if (/[A-Za-z]:\\\\/.test(text) || /[A-Za-z]:\\/.test(text)) found.push("a Windows drive path");
    if (/\.msi\b/i.test(text)) found.push("an .msi installer");
    if (/\bmsiexec\b/i.test(text)) found.push("msiexec");
    if (/\bpowershell\b/i.test(text)) found.push("PowerShell");
    if (/\bGet-[A-Z][A-Za-z]+\b/.test(text)) found.push("a PowerShell cmdlet");
    if (/\bServer Manager\b/i.test(text)) found.push("Server Manager");
  } else {
    if (/\bapt(?:-get)?\s+install\b/i.test(text)) found.push("apt");
    if (/\bsystemctl\b/i.test(text)) found.push("systemctl");
    if (/\byum\s+install\b|\bdnf\s+install\b/i.test(text)) found.push("a Linux package manager");
    if (/\bchmod\s+\+x\b/i.test(text)) found.push("chmod");
  }

  return [...new Set(found)];
}

/**
 * DOES THIS PLAN MATCH THE DISTRIBUTION, not just the operating system?
 *
 * osViolations catches Windows steps on Linux. It cannot catch "sudo apt-get update" on
 * Alpine, which is Linux and still fails on the first line. Measured, not assumed: none of
 * the Linux template images ship sudo, and the Alpine ones have apk and not apt.
 */
export function toolchainViolations(text: string, template: TemplateKey): string[] {
  const tc = LAB_TEMPLATES[template].toolchain;
  if (tc.shell === "powershell") return [];
  const found: string[] = [];

  if (!tc.hasSudo && /(?:^|[\s;&|`(])sudo\s/m.test(text))
    found.push("sudo, which is not installed in the lab");
  if (tc.packageManager === "apk" && /\bapt(?:-get)?\s+(?:install|update|upgrade)\b/i.test(text)) {
    found.push("apt, which does not exist on Alpine");
  }
  if (tc.packageManager === "apt" && /\bapk\s+(?:add|update)\b/i.test(text)) {
    found.push("apk, which does not exist on Ubuntu");
  }
  if (tc.shell === "sh" && /\bbash\s|#!\/bin\/bash/.test(text))
    found.push("bash, which is not installed in the lab");
  if (
    tc.serviceManager === "none" &&
    /\b(?:rc-service|systemctl|rc-update)\s|\bservice\s+[\w.-]+\s+(?:start|restart|stop|reload)\b/.test(
      text
    )
  ) {
    found.push("rc-service/systemctl/service, which do not exist in a container");
  }
  return found;
}
