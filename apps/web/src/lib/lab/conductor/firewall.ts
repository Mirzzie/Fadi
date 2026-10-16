import type { Verdict } from "./contract";

/**
 * DOES THIS COMPUTER'S FIREWALL LET A VMWARE MACHINE IN ON THESE PORTS? Read from ufw's own
 * files (world-readable), never by changing anything. Pure, so it is tested against the rules
 * the owner actually has: ufw active, incoming DROP, and nothing for 1514/1515 — the agent in
 * their VM would have failed to enrol with no explanation (15 Oct 2026).
 *
 * Only ufw is understood. Another firewall, or rules Fadi can't read, is "unknown" — the check
 * from inside the machine (service.reachable_from_lab) is the one that decides then.
 */

export type FirewallFiles = {
  /** /etc/ufw/ufw.conf, or null when ufw isn't installed. */
  ufwConf: string | null;
  /** /etc/default/ufw */
  defaults: string | null;
  /** /etc/ufw/user.rules */
  userRules: string | null;
};

export type FirewallVerdict = { verdict: Verdict; seen: string; missing: number[] };

const ipToInt = (ip: string) =>
  ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;

/** Does `rule` (an address or CIDR) include `ip`? */
function covers(rule: string, ip: string): boolean {
  const [base, bitsText] = rule.split("/");
  const bits = bitsText === undefined ? 32 : Number(bitsText);
  if (!base || !/^\d+\.\d+\.\d+\.\d+$/.test(base) || !(bits >= 0 && bits <= 32)) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipToInt(base) & mask) === (ipToInt(ip) & mask);
}

/** Does the rule's range include the whole network `net` (so every machine on it)? */
function includesNet(rule: string, net: string): boolean {
  const ruleBits = Number(rule.split("/")[1] ?? 32);
  const netBits = Number(net.split("/")[1] ?? 32);
  return ruleBits <= netBits && covers(rule, net.split("/")[0]!);
}

function portsOf(rule: string): ((port: number) => boolean) | null {
  const spec = rule.match(/--dports?\s+(\S+)/)?.[1];
  if (!spec) return null; // no port restriction
  const parts = spec.split(",").map((part) => {
    const [from, to] = part.split(":").map(Number);
    return (port: number) => port >= from! && port <= (to ?? from!);
  });
  return (port) => parts.some((test) => test(port));
}

export function firewallVerdict(
  files: FirewallFiles,
  need: { ports: number[]; iface: string; hostIp: string | null; subnet: string | null }
): FirewallVerdict {
  const all = { missing: [] as number[] };
  if (files.ufwConf === null) {
    return {
      verdict: "unknown",
      seen: "ufw isn't installed; Fadi can't read other firewalls.",
      ...all,
    };
  }
  if (!/^\s*ENABLED\s*=\s*yes\s*$/m.test(files.ufwConf)) {
    return { verdict: "pass", seen: "ufw is installed but turned off.", ...all };
  }
  const policy = files.defaults?.match(/^\s*DEFAULT_INPUT_POLICY\s*=\s*"?(\w+)"?/m)?.[1];
  if (policy === "ACCEPT") {
    return {
      verdict: "pass",
      seen: "ufw is on and accepts incoming connections by default.",
      ...all,
    };
  }
  if (files.userRules === null) {
    return { verdict: "unknown", seen: "ufw is on, but Fadi can't read its rules.", ...all };
  }

  const rules = files.userRules
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^-A ufw6?-user-input\b/.test(line) && /-j ACCEPT\b/.test(line));
  const allows = (port: number) =>
    rules.some((rule) => {
      const iface = rule.match(/-i\s+(\S+)/)?.[1];
      if (iface && iface !== need.iface) return false;
      const proto = rule.match(/-p\s+(\S+)/)?.[1];
      if (proto && proto !== "tcp") return false;
      const source = rule.match(/-s\s+(\S+)/)?.[1];
      if (source && !(need.subnet && includesNet(source, need.subnet))) return false;
      const dest = rule.match(/-d\s+(\S+)/)?.[1];
      if (dest && !(need.hostIp && covers(dest, need.hostIp))) return false;
      const ports = portsOf(rule);
      return ports === null || ports(port);
    });
  const missing = need.ports.filter((port) => !allows(port));
  return missing.length
    ? {
        verdict: "fail",
        seen: `ufw is on, drops incoming connections, and no rule lets ${need.iface} in on ${missing.join(" and ")}.`,
        missing,
      }
    : {
        verdict: "pass",
        seen: `ufw allows ${need.iface} in on ${need.ports.join(" and ")}.`,
        missing,
      };
}
