/**
 * CAN I ACTUALLY RUN THIS?
 *
 * The point of knowing someone's hardware is not the inventory — it is refusing to
 * suggest what they cannot do. Fadi's learning section already names gaps and links
 * roadmaps; what it never answers is "and what do I run it on?", which is the question
 * standing between a plan and an evening's work.
 *
 * This is pure and deterministic: no database, no model call. A plan that depends on
 * whether an LLM felt generous today is not a plan.
 *
 * IT PREVENTS RATHER THAN EXPLAINS. The failure worth designing out is proposing a lab
 * that cannot exist — three x86 VMs on a Raspberry Pi, a domain controller on an ESP32,
 * an always-on service on a laptop that lives in a bag. Discovering that halfway
 * through costs an evening; refusing up front costs nothing.
 */

export type Arch = "x86_64" | "arm64" | "mcu";
export type Virtualization = "none" | "containers" | "vms" | "nested";

export type Resource = {
  id: string;
  label: string;
  kind: string;
  arch: Arch;
  memoryMb: number | null;
  diskGb: number | null;
  virtualization: Virtualization;
  alwaysOn: boolean;
};

/** What a lab needs. Every field optional: most labs constrain only one or two things. */
export type LabSpec = {
  /** Rough working memory the lab needs on one machine. */
  memoryMb?: number;
  diskGb?: number;
  /** "vms" for anything needing a real OS; "containers" for services. */
  needs?: Virtualization;
  /** x86-only work (Windows Server, most enterprise images) cannot go on ARM. */
  arch?: Arch[];
  /** Must survive the lid closing — a monitoring target, a service that must stay up. */
  alwaysOn?: boolean;
};

/**
 * AM02 (Codex): virtualization is NOT a total ordering.
 *
 * The old model ranked none < containers < vms < nested and let the heavier satisfy the
 * lighter, so a Proxmox box "supported containers". It does not follow: running VMs
 * establishes a hypervisor, not a container runtime, its images, its networking or
 * permission to use it. What a VM host can offer is a PLAN — create a guest, install a
 * runtime — which is a prerequisite to state, not a capability to assume.
 *
 * Nested does imply vms, because nested virtualisation IS running VMs. Nothing else
 * implies anything.
 */
const SATISFIES: Record<Virtualization, Virtualization[]> = {
  none: [],
  containers: ["containers"],
  vms: ["vms"],
  nested: ["nested", "vms"],
};

/** What it would take to get there, when the resource cannot do it as it stands. */
const PREREQUISITE: Partial<Record<Virtualization, string>> = {
  containers: "a container runtime would need installing first",
  vms: "a hypervisor would need installing first",
};

/**
 * AM01 (Codex): THREE STATES, NOT TWO.
 *
 * The old model answered yes/no, and unknown capacity answered YES — a 32 GiB, 200 GB
 * lab was reported as fitting a machine whose RAM and disk nobody had recorded. The
 * reasoning was that refusing to plan on a missing number helps nobody, which is true
 * and does not make "we have not checked" the same as "it fits".
 *
 * `unverified` keeps the resource as a candidate while naming exactly what has to be
 * established before anything is applied to it. Planning stays useful; the guarantee
 * stops being fictional.
 */
export type Feasibility = "feasible" | "infeasible" | "unverified";

export type Verdict = {
  resource: Resource;
  state: Feasibility;
  /** Why it cannot work. Populated only for `infeasible`. */
  reasons: string[];
  /** What must be confirmed or installed first. Populated only for `unverified`. */
  checks: string[];
};

export function canHost(spec: LabSpec, r: Resource): Verdict {
  const reasons: string[] = [];
  const checks: string[] = [];

  // A microcontroller is a resource, but it is not a host. Saying so plainly is kinder
  // than silently ranking it last and letting someone wonder why it never gets picked.
  if (r.arch === "mcu" && (spec.needs ?? "none") !== "none") {
    reasons.push(`${r.label} is a microcontroller — it can be a lab's subject, not its host`);
  }

  if (spec.arch && !spec.arch.includes(r.arch)) {
    reasons.push(`needs ${spec.arch.join(" or ")}, and ${r.label} is ${r.arch}`);
  }

  if (spec.needs && spec.needs !== "none" && !SATISFIES[r.virtualization].includes(spec.needs)) {
    // A host that could get there with setup is unverified, not impossible. One that
    // runs nothing at all is impossible.
    if (r.virtualization === "none" || r.arch === "mcu") {
      reasons.push(
        `needs ${spec.needs}, and ${r.label} runs neither containers nor VMs`,
      );
    } else {
      checks.push(
        `${r.label} does ${r.virtualization}, not ${spec.needs} — ${
          PREREQUISITE[spec.needs] ?? "it would need setting up first"
        }`,
      );
    }
  }

  // A recorded number that falls short is a real no. A missing one is a question —
  // never a yes, which is what it used to be.
  if (spec.memoryMb != null) {
    if (r.memoryMb == null) checks.push(`how much RAM ${r.label} has (needs about ${gb(spec.memoryMb)})`);
    else if (r.memoryMb < spec.memoryMb) {
      reasons.push(`needs about ${gb(spec.memoryMb)} of RAM, ${r.label} has ${gb(r.memoryMb)}`);
    }
  }
  if (spec.diskGb != null) {
    if (r.diskGb == null) checks.push(`how much free disk ${r.label} has (needs ${spec.diskGb} GB)`);
    else if (r.diskGb < spec.diskGb) {
      reasons.push(`needs ${spec.diskGb} GB free, ${r.label} has ${r.diskGb} GB`);
    }
  }

  if (spec.alwaysOn && !r.alwaysOn) {
    reasons.push(`has to stay up, and ${r.label} isn't always on`);
  }

  // Impossible beats unverified: no amount of checking rescues an ARM board from an
  // x86 image, so do not ask the user to go and measure something pointless.
  const state: Feasibility =
    reasons.length > 0 ? "infeasible" : checks.length > 0 ? "unverified" : "feasible";
  return { resource: r, state, reasons, checks };
}

const gb = (mb: number) => `${Math.round((mb / 1024) * 10) / 10} GB`;

export type Placement = {
  /** Everything confirmed to work, best first. */
  fits: Resource[];
  /**
   * Candidates whose suitability is not established — kept, because dropping them would
   * make an unmeasured machine indistinguishable from an unsuitable one, and listed
   * with what has to be confirmed. NEVER presented as fits (AM01).
   */
  unverified: { resource: Resource; checks: string[] }[];
  /** Why each of the others cannot — so a "no" is always explained. */
  misses: { resource: Resource; reasons: string[] }[];
};

/**
 * Where could this lab run?
 *
 * Ordering matters as much as the yes/no: an always-on Pi is the right home for a
 * service that must persist, and the 24 GB laptop is the right home for three VMs.
 * Preferring the SMALLEST machine that fits leaves the big one free and matches how
 * people actually use their own hardware.
 */
export function placeLab(spec: LabSpec, resources: Resource[]): Placement {
  const verdicts = resources.map((r) => canHost(spec, r));
  const fits = verdicts
    .filter((v) => v.state === "feasible")
    .map((v) => v.resource)
    .sort((a, b) => {
      if (spec.alwaysOn && a.alwaysOn !== b.alwaysOn) return a.alwaysOn ? -1 : 1;
      return (a.memoryMb ?? Number.MAX_SAFE_INTEGER) - (b.memoryMb ?? Number.MAX_SAFE_INTEGER);
    });
  const unverified = verdicts
    .filter((v) => v.state === "unverified")
    .map(({ resource, checks }) => ({ resource, checks }));
  const misses = verdicts
    .filter((v) => v.state === "infeasible")
    .map(({ resource, reasons }) => ({ resource, reasons }));

  return { fits, unverified, misses };
}
