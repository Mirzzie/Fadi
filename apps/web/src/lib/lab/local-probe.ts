import "server-only";

import { CAPABILITIES, requestCapability, type Actor, type Capability } from "./broker";

/**
 * WHAT IS ACTUALLY ON THIS MACHINE.
 *
 * Fadi runs on the user's own laptop, so it can see the truth instead of asking them to
 * type it: whether Docker is up, which VMs the hypervisor knows about, how much memory
 * there really is. That turns the resource registry from a form into an observation.
 *
 * NOTHING HERE RUNS A COMMAND. Every execution lives in the broker, behind a grant the
 * user gave and an audit row that records the attempt. This file only interprets output
 * it is handed — which is the whole point of the split: the list of things Fadi may run
 * is auditable in one file, and adding to it is a deliberate edit there.
 */

export type ProbeFinding = {
  kind: "laptop" | "server" | "hypervisor" | "sbc" | "microcontroller" | "cloud";
  label: string;
  virtualization: "none" | "containers" | "vms" | "nested";
  detail: string;
};

const firstLine = (s: string) => s.split("\n")[0]?.trim() ?? "";

/** Interpreters, keyed by the broker's command ids. No argv here, by design. */
const PARSERS: Record<string, { label: string; parse: (stdout: string) => ProbeFinding | null }> = {
  docker: {
    label: "Docker",
    parse: (out) => {
      const v = firstLine(out);
      return v
        ? {
            kind: "laptop",
            label: "This machine (Docker)",
            virtualization: "containers",
            detail: "Docker Engine " + v + " is running here.",
          }
        : null;
    },
  },
  podman: {
    label: "Podman",
    parse: (out) => {
      const v = firstLine(out);
      return v
        ? { kind: "laptop", label: "This machine (Podman)", virtualization: "containers", detail: v }
        : null;
    },
  },
  libvirt: {
    label: "KVM / libvirt",
    parse: (out) => {
      const vms = out.split("\n").map((l) => l.trim()).filter(Boolean);
      return {
        kind: "hypervisor",
        label: "This machine (KVM)",
        virtualization: "vms",
        detail: vms.length
          ? "libvirt knows " + vms.length + " domain(s): " + vms.slice(0, 4).join(", ") + "."
          : "libvirt is available, no domains defined.",
      };
    },
  },
  vmware: {
    label: "VMware",
    parse: (out) => ({
      kind: "hypervisor",
      label: "This machine (VMware)",
      virtualization: "vms",
      detail: firstLine(out) || "VMware is installed.",
    }),
  },
  wsl: {
    label: "WSL",
    parse: (out) => ({
      kind: "laptop",
      label: "This machine (WSL)",
      virtualization: "containers",
      detail: firstLine(out.split("\n").slice(1).join(" ")) || "WSL is available.",
    }),
  },
};

export type LocalScan = {
  findings: ProbeFinding[];
  /** Probes that found nothing, so a short result is explainable rather than mysterious. */
  absent: string[];
  /** Real capacity, read rather than remembered. Null when host access wasn't granted. */
  host: { memoryMb: number | null; cpus: number | null; arch: "x86_64" | "arm64" } | null;
  /**
   * What Fadi wanted to look at and was not allowed to. Not an error — the scan returns
   * what it could see and names what it could not, so a thin result reads as "you haven't
   * allowed this yet" instead of "your machine has nothing on it".
   */
  needsGrant: Array<{ capability: Capability; summary: string; limit: string }>;
};

const SCAN_CAPABILITIES: Capability[] = [
  "inspect.containers",
  "inspect.virtualisation",
  "inspect.host",
];

/**
 * Look, and report. Never changes anything, never takes a command from a caller.
 *
 * A missing tool is not an error — most machines have some of these and not others, and a
 * scan that failed because `vmrun` is absent would be useless on every Linux laptop.
 */
export async function scanLocalMachine(input: {
  userId: string;
  actor: Actor;
  origin: string;
}): Promise<LocalScan> {
  const findings: ProbeFinding[] = [];
  const absent: string[] = [];
  const needsGrant: LocalScan["needsGrant"] = [];
  let host: LocalScan["host"] = null;

  for (const capability of SCAN_CAPABILITIES) {
    const result = await requestCapability({
      userId: input.userId,
      capability,
      actor: input.actor,
      origin: input.origin,
    });

    if (!result.ok) {
      if (result.needsGrant) {
        const spec = CAPABILITIES[capability];
        needsGrant.push({ capability, summary: spec.summary, limit: spec.limit });
      }
      continue;
    }

    for (const id of result.unavailable) {
      absent.push(PARSERS[id]?.label ?? id);
    }

    for (const [id, stdout] of Object.entries(result.results)) {
      const parser = PARSERS[id];
      if (!parser) continue;
      const found = parser.parse(stdout);
      if (found) findings.push(found);
      else absent.push(parser.label);
    }

    if (capability === "inspect.host") {
      const os = await import("node:os");
      host = {
        memoryMb: Math.round(os.totalmem() / (1024 * 1024)),
        cpus: os.cpus()?.length ?? null,
        arch: os.arch() === "arm64" ? "arm64" : "x86_64",
      };
    }
  }

  return { findings, absent, host, needsGrant };
}
