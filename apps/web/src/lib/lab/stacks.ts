import { homedir, networkInterfaces } from "node:os";
import { join } from "node:path";

import { WAZUH_FILES, WAZUH_VERSION } from "./stacks/wazuh-files";

/**
 * LAB STACKS — the services a project runs BESIDE its machine (C2).
 *
 * A Wazuh/SIEM project used to be planned as "install Docker Desktop inside the Windows lab",
 * because a project could only have one machine. That nested a hypervisor inside a VM inside a
 * container and left the lab in a boot loop (15 Oct 2026). A real small business runs the SIEM
 * on Linux and the agent on Windows; a lab should look the same. So a stack is a fixed set of
 * containers on this computer, from a pinned upstream release, which the project's machine
 * reaches over the VMware network on this computer — never the home network.
 *
 * The catalogue is closed: a key picks a stack; nothing a caller says becomes a file, an image,
 * a port or a flag. Its files are written to Fadi's own folder (`stackFolder()`), where the
 * person can read exactly what ran.
 */

export type StackKey = "wazuh";

export type StackDefinition = {
  label: string;
  version: string;
  /** What it gives the project, in the person's terms. */
  purpose: string;
  /** Memory it needs while running, for the same pre-check as a lab machine. */
  ramMb: number;
  diskGb: number;
  /** Where the person opens it, and how they sign in. Lab-only defaults, said plainly. */
  open: { label: string; url: string; user: string; password: string };
  /** Ports the project's machine connects to on the agent address. */
  agentPorts: number[];
  /** Containers that must be running for the stack to be up. */
  services: string[];
  files: (agentIp: string) => Record<string, string>;
  /** The compose file that generates certificates first, when the stack needs them. */
  certs: string | null;
  /** Folders a container writes into, made first so they belong to this user, not root. */
  dirs: string[];
  /** Its images and their size on disk once pulled, MB (measured), for the readiness check. */
  images: Record<string, number>;
};

export const STACKS: Record<StackKey, StackDefinition> = {
  wazuh: {
    label: `Wazuh ${WAZUH_VERSION} SIEM`,
    version: WAZUH_VERSION,
    purpose:
      "The Wazuh manager, indexer and dashboard — an open-source SIEM — as three containers on this computer.",
    ramMb: 2300,
    diskGb: 6,
    open: {
      label: "Wazuh dashboard",
      url: "https://127.0.0.1:5443",
      user: "admin",
      password: "SecretPassword",
    },
    agentPorts: [1514, 1515],
    services: ["wazuh.manager", "wazuh.indexer", "wazuh.dashboard"],
    files: (agentIp) =>
      Object.fromEntries(
        Object.entries(WAZUH_FILES).map(([path, content]) => [
          path,
          content.replaceAll("__AGENT_IP__", agentIp),
        ])
      ),
    certs: "generate-indexer-certs.yml",
    dirs: ["config/wazuh_indexer_ssl_certs"],
    images: {
      "wazuh/wazuh-manager:4.14.9": 2710,
      "wazuh/wazuh-indexer:4.14.9": 2560,
      "wazuh/wazuh-dashboard:4.14.9": 2100,
      "wazuh/wazuh-certs-generator:0.0.4": 435,
    },
  },
};

export function isStackKey(value: string): value is StackKey {
  return Object.hasOwn(STACKS, value);
}

/** Fadi's own folder for stacks. Not the person's workspace: nothing here comes from them. */
export function stackRoot(): string {
  return process.env.FADI_STACKS_DIR || join(homedir(), ".local", "share", "fadi", "stacks");
}

/** One folder per stack project; the project name is validated before it gets here. */
export function stackFolder(project: string): string {
  return join(stackRoot(), project);
}

/** The compose project name: one per project per stack, so two projects never share one. */
export function stackProject(labName: string, key: StackKey): string {
  return `fadi-${labName}-${key}`;
}

/** Which stacks a project's own words call for. Deliberately literal: no guessing. */
export function stacksForProject(input: { title: string; detail?: string | null }): StackKey[] {
  const text = `${input.title} ${input.detail ?? ""}`;
  return /\bwazuh\b|\bsiem\b|security information and event/i.test(text) ? ["wazuh"] : [];
}

export const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

/**
 * The address lab VMs reach this computer on: VMware's NAT network (vmnet8) first, then its
 * host-only network (vmnet1). Never a home-network interface. 127.0.0.1 when there is none —
 * the stack still runs, but only this computer can send it logs.
 */
export function vmNetworkAddress(
  interfaces: ReturnType<typeof networkInterfaces> = networkInterfaces()
): string {
  for (const name of ["vmnet8", "vmnet1"]) {
    const v4 = interfaces[name]?.find((address) => address.family === "IPv4" && !address.internal);
    if (v4 && IPV4_RE.test(v4.address)) return v4.address;
  }
  return "127.0.0.1";
}
