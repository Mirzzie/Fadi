import { lookup } from "node:dns/promises";

/**
 * SSRF guard for server-side fetches of EXTERNAL, user/source-influenced URLs (e.g.
 * job-posting liveness checks). Job URLs come from aggregators/scrapers, so the
 * server must never be tricked into fetching internal targets (cloud metadata,
 * localhost, private ranges). Pure helpers are unit-tested; isSafeFetchUrl also
 * resolves DNS so a public hostname that points at a private IP is still blocked.
 */

const PRIVATE_V4: RegExp[] = [
  /^0\./, // "this network"
  /^10\./, // private
  /^127\./, // loopback
  /^169\.254\./, // link-local incl. 169.254.169.254 cloud metadata
  /^192\.168\./, // private
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16/12 private
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // 100.64/10 CGNAT
];

function isPrivateV4(ip: string): boolean {
  return PRIVATE_V4.some((re) => re.test(ip));
}

function isPrivateV6(ip: string): boolean {
  const x = ip.toLowerCase();
  if (x === "::1" || x === "::") return true;
  if (x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80")) return true; // ULA + link-local
  // IPv4-mapped (::ffff:a.b.c.d) — check the embedded v4.
  const mapped = x.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateV4(mapped[1]);
  return false;
}

/** Pure: is this an obviously-internal host literal (no DNS needed)? */
export function isBlockedHostLiteral(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h === "metadata.google.internal") return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return isPrivateV4(h);
  if (h.includes(":")) return isPrivateV6(h);
  return false;
}

/** Pure: parse + protocol/host-literal checks. Returns the URL or null if unsafe. */
export function parseSafeUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (isBlockedHostLiteral(url.hostname)) return null;
  return url;
}

/**
 * Full SSRF check: protocol + host-literal + DNS resolution (so a public hostname
 * that resolves to a private/link-local IP is rejected). Fails closed.
 */
export async function isSafeFetchUrl(raw: string): Promise<boolean> {
  const url = parseSafeUrl(raw);
  if (!url) return false;
  try {
    const addrs = await lookup(url.hostname, { all: true });
    if (addrs.length === 0) return false;
    return addrs.every((a) => (a.family === 6 ? !isPrivateV6(a.address) : !isPrivateV4(a.address)));
  } catch {
    return false; // can't resolve → don't fetch
  }
}
