import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MOMENTUM_DELTAS, type ForwardMotionKind } from "./engine";

/**
 * The test that would have caught F1 (docs/DATA_FLOW_AUDIT.md).
 *
 * `getMomentumSummary` COUNTS `quality_application` events to compute cadence
 * adherence — but nothing in the codebase ever WROTE one. Momentum was a reader with
 * no writer, so every user sat at momentum 0 and 0% adherence forever, no matter how
 * much work they did. `skill_closed` (+15) was dead the same way. Both bugs were
 * invisible to ordinary unit tests: every module was individually correct, and the
 * defect lived in the space BETWEEN them — nobody called anybody.
 *
 * So this is a wiring test. It reads the actual source and asserts that every reward
 * the engine defines is genuinely emitted by application code. It is deliberately
 * crude (a source scan, not a type check) because the thing being protected is a
 * cross-module fact that no type can express: a defined constant is not a feature.
 *
 * If you add a ForwardMotionKind, you must also emit it — or this fails.
 */

const SRC = join(__dirname, "..", "..");

function appSources(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      appSources(path, acc);
      continue;
    }
    if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue;
    acc.push(path);
  }
  return acc;
}

const sources = appSources(SRC).map((p) => readFileSync(p, "utf8"));

/**
 * Is this reward actually handed out — i.e. passed to a `recordForwardMotion(...)`
 * CALL?
 *
 * This must match the call, not merely co-occurrence of the two strings in a file.
 * `service.ts` both defines `recordForwardMotion` AND reads `"quality_application"`
 * (via `countEventsSince`, to compute cadence adherence). A naive
 * `includes(kind) && includes("recordForwardMotion")` therefore returns true for a
 * reward with zero writers — it would have passed cheerfully throughout the entire
 * period F1 was live, which is worse than no test at all.
 *
 * `[^)]*?` cannot cross a closing paren, so the function's own signature
 * (`recordForwardMotion(userId, kind: ForwardMotionKind, opts)`) never matches.
 */
function isEmitted(kind: ForwardMotionKind): boolean {
  const call = new RegExp(String.raw`recordForwardMotion\(\s*[^)]*?"${kind}"`, "s");
  return sources.some((text) => call.test(text));
}

describe("momentum wiring — every defined reward must have a writer", () => {
  const kinds = Object.keys(MOMENTUM_DELTAS) as ForwardMotionKind[];

  // These two are awarded by the engine itself, not by a caller, so they are exempt:
  // `comeback` is granted inside applyForwardMotion, `rest_day` via applyRest.
  const ENGINE_AWARDED: ForwardMotionKind[] = ["comeback", "rest_day"];

  it.each(kinds.filter((k) => !ENGINE_AWARDED.includes(k)))(
    "%s is emitted by real application code",
    (kind) => {
      expect(isEmitted(kind), `${kind} is defined with a delta but never awarded`).toBe(true);
    },
  );

  it("specifically pins quality_application — the one the dashboard reads", () => {
    // getMomentumSummary counts these to compute cadence adherence. If this ever goes
    // back to zero writers, the user's dashboard silently reads 0% forever.
    expect(isEmitted("quality_application")).toBe(true);
  });
});

describe("momentum deltas — the doctrine's shape", () => {
  it("never rewards an outcome more than the process that earned it", () => {
    // Principle 4: score the process, never the outcome. Facing a rejection earns a
    // token +2; LEARNING from it earns +10.
    expect(MOMENTUM_DELTAS.rejection_logged).toBeLessThan(MOMENTUM_DELTAS.rejection_autopsy);
    expect(MOMENTUM_DELTAS.rejection_logged).toBeLessThan(MOMENTUM_DELTAS.quality_application);
  });

  it("prices the actions a person can take ALONE above merely applying", () => {
    // The primary user has no network and no callbacks. Closing a skill gap and
    // securing a referral are the two things that don't depend on an employer
    // answering — and a referral is an independent draw under monoculture.
    expect(MOMENTUM_DELTAS.skill_closed).toBeGreaterThan(MOMENTUM_DELTAS.quality_application);
    expect(MOMENTUM_DELTAS.referral_added).toBeGreaterThan(MOMENTUM_DELTAS.skill_closed);
  });

  it("gives rest zero reward but never a penalty", () => {
    expect(MOMENTUM_DELTAS.rest_day).toBe(0);
    expect(Math.min(...Object.values(MOMENTUM_DELTAS))).toBeGreaterThanOrEqual(0);
  });
});
