import type { RemedyRef, Requirement } from "./contract";

/**
 * WHAT THE PERSON SEES AS THE WAY FORWARD for each closed remedy id. Recipes and flows are
 * buttons the page wires to existing actions; manual instructions are reviewed text, with
 * commands built only from numbers and addresses Fadi read from this computer. Fadi never runs
 * sudo, so these are shown, explained, and rechecked afterwards.
 */

export type RemedyView =
  | { kind: "recipe" | "flow"; id: string; label: string; stack?: string }
  | {
      kind: "manual";
      id: string;
      label: string;
      explain: string;
      commands: string[];
      /** Where the commands run: a terminal on this computer, or typed into the lab machine. */
      place: "host" | "lab";
      /** Fadi can apply it itself, once approved (a lab fix over its sign-in). */
      fadiCanApply?: boolean;
    };

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;

export function remedyView(
  remedy: RemedyRef,
  requirement: Requirement,
  context: { vmnetIp: string | null; natGateway?: string | null }
): RemedyView {
  switch (remedy.id) {
    case "lab.start":
      return { kind: "recipe", id: remedy.id, label: "Start the machine" };
    case "vmware.snapshot":
      return { kind: "recipe", id: remedy.id, label: "Save clean start" };
    case "stack.start":
      return { kind: "recipe", id: remedy.id, label: "Start it", stack: requirement.params.stack };
    case "checks.setup":
      return { kind: "flow", id: remedy.id, label: "Set up checks" };
    case "plan.create":
      return { kind: "flow", id: remedy.id, label: "Plan the steps" };
    case "machine.choose":
      return { kind: "flow", id: remedy.id, label: "Choose a machine" };
    case "host.vmnet_dns":
      return {
        kind: "manual",
        id: remedy.id,
        label: "Fix it in a terminal",
        place: "host",
        explain:
          "VMware's NAT asks this computer's local-only resolver, which the machine can't use. Give it real DNS servers, then restart VMware's networks. Needs your password once.",
        commands: [
          "sudo sed -i '/^\\[dns\\]/,/^\\[/{s/^#\\?\\s*nameserver1\\s*=.*/nameserver1 = 1.1.1.1/;s/^#\\?\\s*nameserver2\\s*=.*/nameserver2 = 9.9.9.9/}' /etc/vmware/vmnet8/nat/nat.conf",
          "sudo vmware-networks --stop; sudo vmware-networks --start",
        ],
      };
    case "lab.dns_forwarder": {
      const gateway =
        context.natGateway && IPV4.test(context.natGateway) ? context.natGateway : null;
      return {
        kind: "manual",
        id: remedy.id,
        label: "Fix it in the machine",
        place: "lab",
        fadiCanApply: Boolean(gateway),
        explain: gateway
          ? `In an Administrator PowerShell in the machine: point its DNS server's forwarder at VMware's gateway, ${gateway}, and forget the failed answers.`
          : "Fadi can't read VMware's gateway address on this computer, so it can't say where the forwarder should point.",
        commands: gateway
          ? [`Set-DnsServerForwarder -IPAddress ${gateway}`, "Clear-DnsServerCache -Force"]
          : [],
      };
    }
    case "lab.dns_client":
      return {
        kind: "manual",
        id: remedy.id,
        label: "Fix it in the machine",
        place: "lab",
        fadiCanApply: true,
        explain:
          "In an Administrator PowerShell in the machine: give its network adapter back the DNS server VMware hands out, and forget the failed answers.",
        commands: [
          "Get-NetAdapter | Where-Object Status -eq 'Up' | Set-DnsClientServerAddress -ResetServerAddresses",
          "Clear-DnsClientCache",
        ],
      };
    case "host.disk_room":
      return {
        kind: "manual",
        id: remedy.id,
        label: "Free some space",
        place: "host",
        explain:
          "Fadi deletes nothing of yours. The usual big items are virtual machines you no longer use, package caches (paru -Sc, yay -Sc) and Docker images no lab uses (docker image prune). Fadi's own lab folders are listed under Environment → Details.",
        commands: [],
      };
    case "host.firewall_vmnet": {
      const ports = requirement.params.ports ?? [];
      const range =
        ports.length > 1 && ports[ports.length - 1]! - ports[0]! === ports.length - 1
          ? `${ports[0]}:${ports[ports.length - 1]}`
          : ports.join(",");
      const iface = requirement.params.iface ?? "vmnet8";
      const to = context.vmnetIp && IPV4.test(context.vmnetIp) ? ` to ${context.vmnetIp}` : "";
      return {
        kind: "manual",
        id: remedy.id,
        label: "Allow it in a terminal",
        place: "host",
        explain: `Your firewall drops incoming connections. This opens port${ports.length > 1 ? "s" : ""} ${ports.join(" and ")} only to VMware's network on this computer — not to your home network or the internet.`,
        commands: [
          `sudo ufw allow in on ${iface}${to} port ${range} proto tcp comment 'Fadi lab services from VMware machines'`,
        ],
      };
    }
  }
}
