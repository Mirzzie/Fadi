import type { LabSpec } from "./capability";
import type { TemplateKey } from "./templates";

/**
 * WHAT WOULD THIS PROJECT NEED TO RUN?
 *
 * Read from the project's own words, deterministically. No model call: a plan that
 * changes because an LLM felt different today is not a plan, and this decides whether
 * Fadi tells someone their hardware is suitable.
 *
 * SILENCE MEANS NO CONSTRAINT, NEVER A SATISFIED ONE. If the description does not
 * indicate virtualisation, the spec asks for none — so `canHost` returns "feasible" on
 * the strength of having nothing to check, not on the strength of having checked. That
 * is the honest reading of an under-described project, and it is why the UI says
 * "nothing here suggests it needs more than a laptop" rather than "your machine fits".
 *
 * Deliberately not exhaustive. It recognises the shapes that actually decide a homelab
 * plan — a full OS, containers, Windows, something that must stay up — and stays quiet
 * about everything else rather than guessing at RAM figures nobody wrote down.
 */

/** Work that needs a real operating system, not a container. */
// The trailing \b bit me: "virtual machine" followed by \b cannot match the PLURAL,
// because the boundary has to fall between "e" and "s" and there is none. A lab
// description almost always says "virtual machines". Plurals are explicit now, and the
// group carries its own boundaries instead of relying on one at the end.
const VM_RE =
  /\b(?:virtual machines?|vms?\b|hypervisors?|proxmox|esxi|vmware|hyper-?v|domain controllers?|active directory|windows server|guest os)/i;

/** Work that a container runtime can carry. */
const CONTAINER_RE = /\b(?:docker|containers?|compose|kubernetes|k8s|podman|images?)\b/i;

/** Windows and most enterprise images are x86 only — this is the constraint that most
 *  often makes a Raspberry Pi the wrong answer, and the one a plan must not miss. */
const X86_RE =
  /\b(windows|active directory|domain controller|sccm|intune|\.net|hyper-?v|esxi|vmware)\b/i;

/** Something a reader has to be able to reach later, not a thing you spin up and kill. */
const ALWAYS_ON_RE =
  /\b(monitor(ing)?|uptime|always[- ]on|24\/7|server that stays|persistent|siem|log (collection|aggregation)|dashboard|scrape)\b/i;

/** Rough working memory, only where the text implies a multi-machine environment. */
const MULTI_HOST_RE = /\b(two|three|multiple|several|cluster|fleet|network of|lab of)\b/i;

export type DerivedSpec = {
  spec: LabSpec;
  /** What the wording actually said, so the UI never presents a guess as a measurement. */
  because: string[];
};

export function specForProject(input: { title: string; detail?: string | null }): DerivedSpec {
  const text = `${input.title} ${input.detail ?? ""}`;
  const spec: LabSpec = {};
  const because: string[] = [];

  if (VM_RE.test(text)) {
    spec.needs = "vms";
    because.push(
      "it describes a full operating system, so it needs virtual machines rather than containers"
    );
  } else if (CONTAINER_RE.test(text)) {
    spec.needs = "containers";
    because.push("it describes containerised services");
  }

  if (X86_RE.test(text)) {
    spec.arch = ["x86_64"];
    because.push("Windows and enterprise images are x86-only, so an ARM board cannot host it");
  }

  if (ALWAYS_ON_RE.test(text)) {
    spec.alwaysOn = true;
    because.push(
      "something has to keep running for this to mean anything, so it cannot live on a laptop that closes"
    );
  }

  // Only claim a memory figure when the text implies more than one machine, and keep it
  // modest. Inventing "16 GB" for an unspecified project would be exactly the kind of
  // confident number this platform exists not to produce.
  if (spec.needs === "vms" && MULTI_HOST_RE.test(text)) {
    spec.memoryMb = 12 * 1024;
    because.push("more than one virtual machine at once needs roughly 12 GB to be usable");
  }

  return { spec, because };
}

/**
 * Choose the smallest reviewed lab that can support the work described.
 *
 * This is deterministic and deliberately conservative. A project can override the
 * recommendation later, but an agent cannot turn free-form project text into an image,
 * flag, port, or host path. It can only select one key from the reviewed catalogue.
 */
export function templateForProject(input: { title: string; detail?: string | null }): TemplateKey {
  const text = `${input.title} ${input.detail ?? ""}`;

  // WINDOWS IS DETECTED WHEREVER IT IS SAID, not only in four enterprise phrases.
  //
  // The old list matched "active directory", "group policy" and two others. A project
  // describing a .msi, a C:\ path, PowerShell or plainly "on Windows" fell through to
  // Ubuntu — so the guide could be Windows while the machine was Linux, which is the
  // incoherence that gets someone stuck on step one.
  const SERVER = /\b(?:active directory|domain controllers?|group policy|windows server|gpo|adds|dcpromo)\b/i;
  const DESKTOP = /\b(?:windows ?1[01]|windows desktop|intune|sccm|edr|winget)\b/i;
  const ANY_WINDOWS = /\b(?:windows|win64|win32|powershell|\.msi\b|c:\\|msiexec|winrm|hyper-?v)\b/i;

  if (SERVER.test(text)) return "windows-server-2025";
  if (DESKTOP.test(text)) return "windows-11";
  if (ANY_WINDOWS.test(text)) {
    // Said Windows without saying which. A server is the safer default for lab work —
    // it does everything the desktop does and is what most infrastructure projects mean.
    return "windows-server-2025";
  }
  if (
    /\b(?:postgres(?:ql)?|relational database|sql database|database server|replication)\b/i.test(
      text
    )
  ) {
    return "linux-postgres";
  }
  if (/\b(?:nginx|reverse proxy|web server|tls|static (?:site|hosting))\b/i.test(text)) {
    return "linux-web";
  }
  return "linux-ubuntu";
}
