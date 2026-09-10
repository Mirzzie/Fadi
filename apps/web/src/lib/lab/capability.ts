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

/** Heavier capability implies the lighter one: nested ⊃ vms ⊃ containers ⊃ none. */
const VIRT_RANK: Record<Virtualization, number> = { none: 0, containers: 1, vms: 2, nested: 3 };

export type Verdict =
  | { ok: true; resource: Resource }
  /** Every rejection names what was short, so the UI never has to say "no" without a why. */
  | { ok: false; resource: Resource; reasons: string[] };

export function canHost(spec: LabSpec, r: Resource): Verdict {
  const reasons: string[] = [];

  // A microcontroller is a resource, but it is not a host. Saying so plainly is kinder
  // than silently ranking it last and letting someone wonder why it never gets picked.
  if (r.arch === "mcu" && (spec.needs ?? "none") !== "none") {
    reasons.push(`${r.label} is a microcontroller — it can be a lab's subject, not its host`);
  }

  if (spec.arch && !spec.arch.includes(r.arch)) {
    reasons.push(`needs ${spec.arch.join(" or ")}, and ${r.label} is ${r.arch}`);
  }

  if (spec.needs && VIRT_RANK[r.virtualization] < VIRT_RANK[spec.needs]) {
    reasons.push(
      `needs ${spec.needs}, and ${r.label} ${
        r.virtualization === "none" ? "runs neither containers nor VMs" : `only does ${r.virtualization}`
      }`,
    );
  }

  // Unknown memory is not a failure. Half the machines someone owns are described from
  // memory, and refusing to plan because a number is missing helps nobody.
  if (spec.memoryMb != null && r.memoryMb != null && r.memoryMb < spec.memoryMb) {
    reasons.push(`needs about ${gb(spec.memoryMb)} of RAM, ${r.label} has ${gb(r.memoryMb)}`);
  }
  if (spec.diskGb != null && r.diskGb != null && r.diskGb < spec.diskGb) {
    reasons.push(`needs ${spec.diskGb} GB free, ${r.label} has ${r.diskGb} GB`);
  }

  if (spec.alwaysOn && !r.alwaysOn) {
    reasons.push(`has to stay up, and ${r.label} isn't always on`);
  }

  return reasons.length === 0 ? { ok: true, resource: r } : { ok: false, resource: r, reasons };
}

const gb = (mb: number) => `${Math.round((mb / 1024) * 10) / 10} GB`;

export type Placement = {
  /** Resources that can run it, best first. */
  fits: Resource[];
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
    .filter((v): v is { ok: true; resource: Resource } => v.ok)
    .map((v) => v.resource)
    .sort((a, b) => {
      if (spec.alwaysOn && a.alwaysOn !== b.alwaysOn) return a.alwaysOn ? -1 : 1;
      return (a.memoryMb ?? Number.MAX_SAFE_INTEGER) - (b.memoryMb ?? Number.MAX_SAFE_INTEGER);
    });
  const misses = verdicts
    .filter((v): v is { ok: false; resource: Resource; reasons: string[] } => !v.ok)
    .map(({ resource, reasons }) => ({ resource, reasons }));

  return { fits, misses };
}
