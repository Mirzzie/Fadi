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
  if (h === "localhost" || h.endsWith(".localhost") || h === "metadata.google.internal")
    return true;
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

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

export class UnsafeFetchUrlError extends Error {
  constructor(message = "The URL is not safe to fetch.") {
    super(message);
    this.name = "UnsafeFetchUrlError";
  }
}

export class ResponseBodyTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`The response exceeded the ${maxBytes}-byte limit.`);
    this.name = "ResponseBodyTooLargeError";
  }
}

/**
 * Read an untrusted response without allowing it to consume unbounded memory.
 *
 * Truncating JSON or HTML can create misleading partial data, so exceeding the limit fails
 * closed. Callers can then skip that source or report it as unreadable.
 */
export async function readTextBodyLimited(response: Response, maxBytes: number): Promise<string> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new RangeError("maxBytes must be a positive integer.");
  }

  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new ResponseBodyTooLargeError(maxBytes);
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new ResponseBodyTooLargeError(maxBytes);
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

type SafeFetchDependencies = {
  fetch?: typeof fetch;
  isSafe?: (url: string) => Promise<boolean>;
};

/**
 * Fetch an external URL while applying the SSRF decision to EVERY redirect hop.
 *
 * `fetch(..., { redirect: "follow" })` validates only the first address. A public URL can
 * answer with `Location: http://127.0.0.1/...` (or cloud metadata), after which the runtime
 * follows the redirect behind the guard. Keeping redirect handling here also prevents bearer
 * tokens and cookies being forwarded when a redirect changes origin.
 *
 * DNS rebinding between validation and connection still requires an egress proxy or a fetch
 * dispatcher pinned to the validated address. This function closes the redirect and credential
 * leak paths; deployment egress policy remains the second boundary.
 */
export async function fetchSafeUrl(
  raw: string,
  init: RequestInit = {},
  dependencies: SafeFetchDependencies = {}
): Promise<Response> {
  const fetchImpl = dependencies.fetch ?? fetch;
  const safe = dependencies.isSafe ?? isSafeFetchUrl;
  let current = new URL(raw).toString();
  let method = (init.method ?? "GET").toUpperCase();
  let body = init.body;
  let headers = new Headers(init.headers);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (!(await safe(current))) throw new UnsafeFetchUrlError();
    const response = await fetchImpl(current, {
      ...init,
      method,
      body,
      headers,
      redirect: "manual",
    });
    if (!REDIRECT_STATUSES.has(response.status)) return response;

    const location = response.headers.get("location");
    if (!location) return response;
    if (redirects === MAX_REDIRECTS) {
      await response.body?.cancel().catch(() => undefined);
      throw new UnsafeFetchUrlError("The URL redirected too many times.");
    }

    const next = new URL(location, current).toString();
    if (!(await safe(next))) {
      await response.body?.cancel().catch(() => undefined);
      throw new UnsafeFetchUrlError("The URL redirected to a private or unsafe address.");
    }

    if (new URL(next).origin !== new URL(current).origin) {
      headers = new Headers(headers);
      headers.delete("authorization");
      headers.delete("cookie");
      headers.delete("proxy-authorization");
    }
    if (
      response.status === 303 ||
      ((response.status === 301 || response.status === 302) && method === "POST")
    ) {
      method = "GET";
      body = undefined;
      headers = new Headers(headers);
      headers.delete("content-length");
      headers.delete("content-type");
    }
    await response.body?.cancel().catch(() => undefined);
    current = next;
  }

  throw new UnsafeFetchUrlError("The URL redirected too many times.");
}
