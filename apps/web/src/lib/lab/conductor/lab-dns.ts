import type { Verdict } from "./contract";

/**
 * WHY A WINDOWS LAB CAN'T RESOLVE NAMES — decided from what the machine itself reports. Pure.
 *
 * The owner's VM (16 Oct 2026) is a domain controller: Windows points its DNS at itself
 * (127.0.0.1), and its DNS server forwarded to 192.168.238.2 — VMware's NAT gateway when the VM
 * was made, on a network that no longer exists. The host's DNS was fine and asking 1.1.1.1
 * directly worked; only the machine's own configuration was wrong. A host-only check could
 * never see that, so the question is asked inside.
 */

/** Prints the facts as JSON. Fixed text; nothing in it comes from a request or a model. */
export const WINDOWS_DNS_SCRIPT = [
  "$servers=@(Get-DnsClientServerAddress -AddressFamily IPv4 | ? { $_.ServerAddresses } | % { $_.ServerAddresses })",
  "$resolves=[bool](Resolve-DnsName example.com -DnsOnly -QuickTimeout -ErrorAction SilentlyContinue)",
  "$direct=[bool](Resolve-DnsName example.com -Server 1.1.1.1 -DnsOnly -QuickTimeout -ErrorAction SilentlyContinue)",
  "$role=(Get-CimInstance Win32_ComputerSystem).DomainRole",
  "$fwd=@(); if (Get-Command Get-DnsServerForwarder -ErrorAction SilentlyContinue) { $fwd=@((Get-DnsServerForwarder).IPAddress | % { $_.IPAddressToString }) }",
  "[ordered]@{servers=$servers; resolves=$resolves; direct=$direct; role=$role; forwarders=$fwd} | ConvertTo-Json -Compress",
].join("; ");

export type LabDnsFacts = {
  servers: string[];
  resolves: boolean;
  direct: boolean;
  /** Win32_ComputerSystem.DomainRole: 4 and 5 are domain controllers. */
  role: number | null;
  forwarders: string[];
};

export type LabDnsRemedy = "lab.dns_forwarder" | "lab.dns_client" | "host.vmnet_dns" | null;

export type LabDnsVerdict = { verdict: Verdict; seen: string; remedy: LabDnsRemedy };

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const list = (value: unknown): string[] =>
  (Array.isArray(value) ? value : value === undefined || value === null ? [] : [value])
    .map(String)
    .filter((ip) => IPV4.test(ip));

export function parseLabDns(stdout: string): LabDnsFacts | null {
  try {
    const raw = JSON.parse(stdout.trim().split("\n").pop() ?? "") as Record<string, unknown>;
    return {
      servers: list(raw.servers),
      resolves: raw.resolves === true,
      direct: raw.direct === true,
      role: typeof raw.role === "number" ? raw.role : null,
      forwarders: list(raw.forwarders),
    };
  } catch {
    return null;
  }
}

export function diagnoseLabDns(facts: LabDnsFacts, natGateway: string | null): LabDnsVerdict {
  if (facts.resolves) {
    return {
      verdict: "pass",
      seen: "From inside the machine, example.com resolves.",
      remedy: null,
    };
  }
  if (!facts.direct) {
    return {
      verdict: "fail",
      seen: "From inside the machine, no DNS server answers — not even 1.1.1.1 directly. The machine has no way out to the internet.",
      remedy: "host.vmnet_dns",
    };
  }
  const servers = facts.servers.join(", ") || "none";
  const controller = facts.role === 4 || facts.role === 5;
  if (controller && natGateway && !facts.forwarders.includes(natGateway)) {
    const forwards = facts.forwarders.join(", ") || "nowhere";
    return {
      verdict: "fail",
      seen: `The machine is a domain controller and answers its own DNS (${servers}). Its DNS server forwards to ${forwards}, which isn't VMware's gateway (${natGateway}) — so outside names fail, though 1.1.1.1 answers directly.`,
      remedy: "lab.dns_forwarder",
    };
  }
  if (!controller) {
    return {
      verdict: "fail",
      seen: `The machine asks DNS server${facts.servers.length === 1 ? "" : "s"} ${servers}, which don't answer for outside names — though 1.1.1.1 answers directly.`,
      remedy: "lab.dns_client",
    };
  }
  return {
    verdict: "fail",
    seen: `The machine's DNS server (${servers}) forwards to ${natGateway} but still can't resolve outside names, though 1.1.1.1 answers directly.`,
    remedy: null,
  };
}
