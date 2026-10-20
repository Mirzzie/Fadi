import "server-only";

import { getKv } from "@/lib/kv/store";
import { logger } from "@/lib/observability/logger";
import { isSafeFetchUrl } from "@/lib/security/url-guard";
import { detectClosedSignal, type PostingLiveness } from "./liveness-detect";

export type { LivenessState, PostingLiveness } from "./liveness-detect";
export { detectClosedSignal } from "./liveness-detect";

// Network checks are slow and rate-limit-prone, so cache per URL for a while.
// Shared KV (not a process Map) so multiple instances don't re-probe the same URL.
const LIVENESS_TTL_SECONDS = 10 * 60;
const FETCH_TIMEOUT_MS = 4000;
const MAX_BODY_BYTES = 24 * 1024; // enough to catch a banner/headline, not the whole page

async function readCache(url: string): Promise<PostingLiveness | null> {
  try {
    const raw = await getKv().get(`liveness:${url}`);
    return raw ? (JSON.parse(raw) as PostingLiveness) : null;
  } catch {
    return null;
  }
}

async function writeCache(url: string, result: PostingLiveness): Promise<void> {
  try {
    await getKv().set(`liveness:${url}`, JSON.stringify(result), LIVENESS_TTL_SECONDS);
  } catch {
    // best-effort cache
  }
}

/**
 * Best-effort liveness probe for a posting URL. Never throws — any failure
 * resolves to "unknown" so a flaky source can't break the workspace.
 */
export async function checkPostingLiveness(url: string): Promise<PostingLiveness> {
  const cached = await readCache(url);
  if (cached) return cached;

  // SSRF guard: job URLs come from external aggregators/scrapers, so never let the
  // server fetch an internal target (cloud metadata, localhost, private ranges).
  if (!(await isSafeFetchUrl(url))) {
    logger.warn("jobs.liveness.blocked_url", { reason: "ssrf_guard" });
    const result: PostingLiveness = {
      state: "unknown",
      reason: "Couldn't safely verify this link",
      checkedAt: new Date().toISOString(),
    };
    await writeCache(url, result);
    return result;
  }

  let result: PostingLiveness;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // A plausible UA — many boards 403 a bare fetch, which we treat as unknown.
        "User-Agent":
          "Mozilla/5.0 (compatible; Fadi/1.0; +https://careeros.app) freshness-check",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    let snippet = "";
    try {
      const buf = await res.arrayBuffer();
      snippet = new TextDecoder("utf-8", { fatal: false }).decode(buf.slice(0, MAX_BODY_BYTES));
    } catch {
      snippet = "";
    }

    result = detectClosedSignal(res.status, snippet);
  } catch (err) {
    result = {
      state: "unknown",
      reason:
        err instanceof Error && err.name === "AbortError"
          ? "Check timed out"
          : "Couldn't reach the source",
      checkedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }

  await writeCache(url, result);
  logger.info("jobs.liveness.checked", { state: result.state, reason: result.reason });
  return result;
}
