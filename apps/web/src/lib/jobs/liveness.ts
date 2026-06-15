import "server-only";

import { logger } from "@/lib/observability/logger";
import { detectClosedSignal, type PostingLiveness } from "./liveness-detect";

export type { LivenessState, PostingLiveness } from "./liveness-detect";
export { detectClosedSignal } from "./liveness-detect";

// Network checks are slow and rate-limit-prone, so cache per URL for a while.
const LIVENESS_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 4000;
const MAX_BODY_BYTES = 24 * 1024; // enough to catch a banner/headline, not the whole page
const livenessCache = new Map<string, { at: number; result: PostingLiveness }>();

/**
 * Best-effort liveness probe for a posting URL. Never throws — any failure
 * resolves to "unknown" so a flaky source can't break the workspace.
 */
export async function checkPostingLiveness(url: string): Promise<PostingLiveness> {
  const cached = livenessCache.get(url);
  if (cached && Date.now() - cached.at < LIVENESS_TTL_MS) return cached.result;

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
          "Mozilla/5.0 (compatible; FadiOS/1.0; +https://careeros.app) freshness-check",
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

  livenessCache.set(url, { at: Date.now(), result });
  logger.info("jobs.liveness.checked", { state: result.state, reason: result.reason });
  return result;
}
