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
  template: TemplateKey;
  hostLabel: string | null;
}): string {
  const labOs = labOsOf(input.template);
  const lab = LAB_TEMPLATES[input.template];
  const host = HOST_LABEL[input.hostOs];

  const lines = [
    `The person's own computer runs ${host}.`,
    `The lab for this project is ${lab.label}, which runs ${labOs === "windows" ? "Windows" : "Linux"}${
      input.hostLabel ? `, hosted on ${input.hostLabel}` : ""
    }.`,
  ];

  if (labOs === "windows" && input.hostOs !== "windows") {
    lines.push(
      `THE WORK HAPPENS INSIDE THE WINDOWS LAB, NOT ON THEIR ${host.toUpperCase()} COMPUTER.`,
      `Windows steps — .msi installers, PowerShell, C:\\ paths, Server Manager — belong inside the lab and must say so: "in the lab machine, ...".`,
      `Anything they do on their own ${host} computer is limited to opening a browser, approving what Fadi asks for, and running the commands Fadi proposes. Never tell them to install Windows software on ${host}.`,
    );
  } else if (labOs === "linux" && input.hostOs !== "linux") {
    lines.push(
      `THE WORK HAPPENS INSIDE THE LINUX LAB, NOT ON THEIR ${host.toUpperCase()} COMPUTER.`,
      `Linux steps — apt, systemctl, /etc paths — belong inside the lab and must say so: "in the lab machine, ...".`,
    );
  } else {
    lines.push(
      `The lab runs the same family as their computer, but it is still a separate machine: say which one each step happens on rather than writing "on your machine".`,
    );
  }

  if (input.hostOs === "macos") {
    // Worth stating rather than discovering: there is no macOS lab, and pretending
    // otherwise would produce steps nobody can run.
    lines.push(
      "Fadi cannot provision macOS — Apple's licensing restricts it to Apple hardware — so a project needing macOS specifically has to be done on their own computer, and you should say that plainly.",
    );
  }

  return lines.join("\n");
}
