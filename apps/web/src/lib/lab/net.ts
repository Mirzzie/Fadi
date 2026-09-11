/**
 * WHAT FADI IS ALLOWED TO POINT AT.
 *
 * A network sweep is the one capability so far that reaches devices the user may not own.
 * On their own LAN that is unremarkable; pointed anywhere else it is reconnaissance, and
 * it is exactly what an injected instruction would ask for — "scan 8.8.8.0/24" costs the
 * model nothing to attempt and could cost the person a great deal.
 *
 * So the range is validated here, deterministically, before anything is sent:
 *
 *   1. PRIVATE SPACE ONLY. RFC1918 and nothing else — no public addresses, no loopback,
 *      no link-local, no multicast, no carrier-grade NAT. There is no flag, setting or
 *      parameter that widens this.
 *   2. BOUNDED SIZE. A /22 at most, so the largest legal sweep is about a thousand hosts
 *      rather than sixteen million. A limit that only exists in a comment is not a limit.
 *
 * Pure, so the rule is readable in one place and testable without a network.
 */

export type CidrCheck =
  | { ok: true; base: number; prefix: number; hosts: number }
  | { ok: false; reason: string };

const PRIVATE_RANGES: Array<{ base: string; prefix: number; label: string }> = [
  { base: "10.0.0.0", prefix: 8, label: "10.0.0.0/8" },
  { base: "172.16.0.0", prefix: 12, label: "172.16.0.0/12" },
  { base: "192.168.0.0", prefix: 16, label: "192.168.0.0/16" },
];

/** Smallest prefix (largest network) Fadi will sweep. /22 is ~1022 hosts. */
export const MIN_PREFIX = 22;

export function ipToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    // Reject "1e2", "+1", " 1" — and "01", which matters more than it looks.
    //
    // A leading zero is read as OCTAL by some parsers and decimal by others, which is the
    // classic address-confusion trick: "0177.0.0.1" is 127.0.0.1 to anything using octal
    // and a harmless-looking public address to anything that isn't. Fadi generates the
    // host list itself from the integer, so the exposure is small — but an address whose
    // meaning depends on who is reading it has no business getting past a range check.
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value >>> 0;
}

export function intToIp(value: number): string {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join(".");
}

function inRange(addr: number, base: string, prefix: number): boolean {
  const baseInt = ipToInt(base);
  if (baseInt === null) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (addr & mask) >>> 0 === (baseInt & mask) >>> 0;
}

export function parsePrivateCidr(input: string): CidrCheck {
  const raw = (input ?? "").trim();
  const match = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(raw);
  if (!match) return { ok: false, reason: "Give a range like 192.168.0.0/24." };

  const addr = ipToInt(match[1]);
  const prefix = Number(match[2]);
  if (addr === null) return { ok: false, reason: "That isn't a valid IPv4 address." };
  if (prefix < 0 || prefix > 32) return { ok: false, reason: "That isn't a valid prefix." };

  if (prefix < MIN_PREFIX) {
    return {
      ok: false,
      reason:
        "That range is too large to sweep — /" +
        MIN_PREFIX +
        " is the widest Fadi will do. Narrow it to the subnet you actually mean.",
    };
  }

  const isPrivate = PRIVATE_RANGES.some((r) => inRange(addr, r.base, r.prefix));
  if (!isPrivate) {
    return {
      ok: false,
      reason:
        "Fadi only scans private networks (" +
        PRIVATE_RANGES.map((r) => r.label).join(", ") +
        "). " +
        match[1] +
        " isn't one, so nothing was sent.",
    };
  }

  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  const base = (addr & mask) >>> 0;
  // Network and broadcast addresses are not hosts; a /31 or /32 has none to speak of.
  const total = 2 ** (32 - prefix);
  const hosts = total > 2 ? total - 2 : 0;
  return { ok: true, base, prefix, hosts };
}

/** Every host address in the range, in order. Generated here, never taken from input. */
export function hostsOf(base: number, prefix: number): string[] {
  const total = 2 ** (32 - prefix);
  const out: string[] = [];
  for (let i = 1; i < total - 1; i++) out.push(intToIp((base + i) >>> 0));
  return out;
}

export type HostCheck = { ok: true; ip: string } | { ok: false; reason: string };

/**
 * A single private address Fadi may probe.
 *
 * Same rule as the range, applied to one host: private space only. A sweep that has
 * already run tells you an address is alive; identifying it means opening connections to
 * it, and the range check must not be skipped just because the address came from Fadi's
 * own earlier result rather than from a person.
 */
export function parsePrivateHost(input: string): HostCheck {
  const raw = (input ?? "").trim();
  const addr = ipToInt(raw);
  if (addr === null) return { ok: false, reason: "That isn't a valid IPv4 address." };

  const isPrivate = PRIVATE_RANGES.some((r) => inRange(addr, r.base, r.prefix));
  if (!isPrivate) {
    return {
      ok: false,
      reason: "Fadi only connects to private addresses. " + raw + " isn't one, so nothing was sent.",
    };
  }
  // Normalised through the integer, so "192.168.000.056" cannot reach anything a plain
  // string comparison would have treated as a different host.
  return { ok: true, ip: intToIp(addr) };
}

/**
 * The ports Fadi checks when identifying a machine, and what each one suggests.
 *
 * FIXED. A port list taken from input is a port scanner with extra steps, and the
 * difference between "is this the Proxmox box?" and "map everything this host is running"
 * is exactly this list being short and written down here.
 *
 * Chosen to answer one question — what KIND of machine is this — rather than to find a way
 * in. There is nothing here that is interesting to an attacker and uninteresting to
 * someone cataloguing their own lab.
 */
export const IDENTIFY_PORTS: Array<{ port: number; means: string }> = [
  { port: 8006, means: "Proxmox VE" },
  { port: 22, means: "SSH" },
  { port: 3389, means: "Windows Remote Desktop" },
  { port: 445, means: "Windows file sharing" },
  { port: 80, means: "a web server" },
  { port: 443, means: "a web server (TLS)" },
  { port: 2375, means: "Docker's API" },
  { port: 9090, means: "Cockpit" },
];

/**
 * What the open ports suggest this machine is.
 *
 * A guess, and labelled as one everywhere it surfaces. Port 8006 is Proxmox's web UI by
 * convention, not by law, and a registry entry that says "hypervisor" because of a
 * convention should not later be treated as though someone had confirmed it.
 */
export function guessKind(openPorts: number[]): { kind: string; virtualization: string; why: string } | null {
  if (openPorts.includes(8006)) {
    return { kind: "hypervisor", virtualization: "vms", why: "port 8006 is Proxmox's web interface" };
  }
  if (openPorts.includes(2375)) {
    return { kind: "server", virtualization: "containers", why: "port 2375 is Docker's API" };
  }
  if (openPorts.includes(3389) || openPorts.includes(445)) {
    return { kind: "server", virtualization: "none", why: "it answers on Windows ports" };
  }
  if (openPorts.includes(22)) {
    return { kind: "server", virtualization: "none", why: "it answers on SSH" };
  }
  return null;
}

/** Canonical text for the range, so what is shown and what is swept cannot differ. */
export function cidrLabel(base: number, prefix: number): string {
  return intToIp(base) + "/" + prefix;
}


export type Sweepable =
  | { ok: true; cidr: string; narrowedFrom?: string }
  | { ok: false; reason: string };

/**
 * Turn an interface address into a range Fadi will actually sweep.
 *
 * The bug this fixes: the panel listed every interface CIDR as a "Scan this" button,
 * including the Docker bridges at /16. The validator refuses anything wider than /22, so
 * those buttons could only ever fail — and the failure was then displayed as a blocked
 * attempt, which made a UI mistake look like a security event.
 *
 * A /16 bridge does not need refusing, it needs NARROWING. The interesting part of
 * 172.19.0.1/16 is the /24 the host actually sits on; sweeping the other 65,000 addresses
 * would take an hour to discover nothing. So the range is narrowed around the host address
 * and the narrowing is disclosed, because silently scanning something other than what the
 * button said would be worse than refusing.
 */
export function sweepableRange(interfaceCidr: string): Sweepable {
  const direct = parsePrivateCidr(interfaceCidr);
  if (direct.ok) return { ok: true, cidr: cidrLabel(direct.base, direct.prefix) };

  const match = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec((interfaceCidr ?? "").trim());
  if (!match) return { ok: false, reason: direct.reason };

  const addr = ipToInt(match[1]);
  const prefix = Number(match[2]);
  if (addr === null) return { ok: false, reason: direct.reason };

  // Only width is negotiable. A public range stays refused however it is sliced.
  if (prefix >= MIN_PREFIX) return { ok: false, reason: direct.reason };

  const narrowed = parsePrivateCidr(intToIp(addr) + "/24");
  if (!narrowed.ok) return { ok: false, reason: narrowed.reason };

  return {
    ok: true,
    cidr: cidrLabel(narrowed.base, narrowed.prefix),
    narrowedFrom: interfaceCidr,
  };
}
