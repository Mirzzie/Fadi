import type { RemedyRef, Requirement } from "./contract";

/**
 * WHAT THE PERSON SEES AS THE WAY FORWARD for each closed remedy id. Recipes and flows are
 * buttons the page wires to existing actions; manual instructions are reviewed text, with
 * commands built only from numbers and addresses Fadi read from this computer. Fadi never runs
 * sudo, so these are shown, explained, and rechecked afterwards.
 */

export type RemedyView =
  | { kind: "recipe" | "flow"; id: string; label: string; stack?: string }
  | { kind: "manual"; id: string; label: string; explain: string; commands: string[] };

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;

export function remedyView(
  remedy: RemedyRef,
  requirement: Requirement,
  context: { vmnetIp: string | null }
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
        explain:
          "VMware's NAT asks this computer's local-only resolver, which the machine can't use. Give it real DNS servers, then restart VMware's networks. Needs your password once.",
        commands: [
          "sudo sed -i '/^\\[dns\\]/,/^\\[/{s/^#\\?\\s*nameserver1\\s*=.*/nameserver1 = 1.1.1.1/;s/^#\\?\\s*nameserver2\\s*=.*/nameserver2 = 9.9.9.9/}' /etc/vmware/vmnet8/nat/nat.conf",
          "sudo vmware-networks --stop; sudo vmware-networks --start",
        ],
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
        explain: `Your firewall drops incoming connections. This opens port${ports.length > 1 ? "s" : ""} ${ports.join(" and ")} only to VMware's network on this computer — not to your home network or the internet.`,
        commands: [
          `sudo ufw allow in on ${iface}${to} port ${range} proto tcp comment 'Fadi lab services from VMware machines'`,
        ],
      };
    }
  }
}
