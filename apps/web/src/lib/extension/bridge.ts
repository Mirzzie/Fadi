// Client-side bridge to the Fadi browser extension. The extension injects a content script
// (bridge.js) into the Fadi origin; that script relays window.postMessage <-> the extension's
// background service worker. This lets a Fadi search ask the extension to open a job portal in
// the user's OWN logged-in session, scrape the results (past the Cloudflare wall a server
// can't cross), and hand them back — the "search in Fadi, see the live web" path.
//
// Protocol (both sides agree on these shapes):
//   page → content script: { __fadiReq: true, kind: "ping" | "scrape", requestId, query? }
//   content script → page: { __fadiRes: true, kind: "ready" | "scrape-result", requestId?, ok?, jobs?, error? }

export type LiveScrapeQuery = {
  keywords: string;
  location?: string;
  remote?: boolean;
  portals?: ("linkedin" | "indeed")[];
};

export type LiveJob = {
  title: string;
  company?: string;
  location?: string;
  url?: string;
};

function newId(): string {
  return `fadi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Is the Fadi extension installed and bridging this page? Resolves within `timeoutMs`. */
export function detectExtension(timeoutMs = 1200): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: boolean) => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMsg);
      resolve(v);
    };
    const onMsg = (e: MessageEvent) => {
      if (e.source !== window) return;
      const d = e.data as { __fadiRes?: boolean; kind?: string } | null;
      if (d && d.__fadiRes && d.kind === "ready") finish(true);
    };
    window.addEventListener("message", onMsg);
    window.postMessage({ __fadiReq: true, kind: "ping", requestId: newId() }, window.location.origin);
    setTimeout(() => finish(false), timeoutMs);
  });
}

/**
 * Ask the extension to scrape live job portals for this query. Opens portal tabs in the user's
 * session, scrapes, closes them, returns the jobs. Can take several seconds (real page loads).
 */
export function requestLiveScrape(
  query: LiveScrapeQuery,
  timeoutMs = 45000,
): Promise<{ ok: boolean; jobs: LiveJob[]; error?: string }> {
  if (typeof window === "undefined") return Promise.resolve({ ok: false, jobs: [], error: "no_window" });
  const requestId = newId();
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: { ok: boolean; jobs: LiveJob[]; error?: string }) => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMsg);
      resolve(v);
    };
    const onMsg = (e: MessageEvent) => {
      if (e.source !== window) return;
      const d = e.data as
        | { __fadiRes?: boolean; kind?: string; requestId?: string; ok?: boolean; jobs?: LiveJob[]; error?: string }
        | null;
      if (!d || !d.__fadiRes || d.kind !== "scrape-result" || d.requestId !== requestId) return;
      finish({ ok: Boolean(d.ok), jobs: Array.isArray(d.jobs) ? d.jobs : [], error: d.error });
    };
    window.addEventListener("message", onMsg);
    window.postMessage({ __fadiReq: true, kind: "scrape", requestId, query }, window.location.origin);
    setTimeout(() => finish({ ok: false, jobs: [], error: "timeout" }), timeoutMs);
  });
}
