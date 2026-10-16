/**
 * WHAT COUNTS AS HAVING DONE SOMETHING.
 *
 * A person clicked Done six times having done nothing, and the platform answered
 * "finishing this will fold what you produced into your evidence". That is Fadi inventing
 * a claim about someone's life, which is the exact failure the whole doctrine exists to
 * prevent — and it happened because "done" was one flag with no room for the difference
 * between a tick and a result.
 *
 * Three kinds, and the gap between the first two is the point:
 *
 *   attested  — you said so. Allowed, and sometimes true: not everything leaves a file.
 *               It is never evidence, because nobody else can see it.
 *   evidenced — you recorded what it produced. Still your claim, but there is something
 *               to point at, which is what "showable" means.
 *   verified  — Fadi checked it against the machine itself. The only one that does not
 *               rest on anybody's word.
 *
 * Pure on purpose: this rule decides what Fadi will later tell an employer, so it should
 * be readable in one place and testable without a database.
 */

export type Completion = "attested" | "evidenced" | "verified";

export type CompletableStep = {
  status: string;
  artifact?: string | null;
  completion?: string | null;
};

/**
 * How a step was completed, deriving it for rows written before the distinction existed.
 *
 * Old rows are read as what they can be SHOWN to be — evidenced if an artefact is there,
 * attested otherwise. Backfilling anything more generous would be inventing history to
 * make the numbers look better, which is the same sin one layer down.
 */
export function completionOf(step: CompletableStep): Completion | null {
  if (step.status !== "done") return null;
  if (step.completion === "verified" || step.completion === "evidenced" || step.completion === "attested") {
    return step.completion;
  }
  return step.artifact && step.artifact.trim() ? "evidenced" : "attested";
}

/** How the broker words a check that ran and did not pass. One constant, read in both places. */
export const CHECK_DID_NOT_PASS = "Check did not pass";

export type StepCheck = {
  /** none: never checked · waiting: asked, not run yet · passed · failed */
  state: "none" | "waiting" | "passed" | "failed";
  detail: string | null;
};

/** The state of a step's latest check, from its broker request. Denied or expired counts as never run. */
export function stepCheckOf(request: { status: string; detail: string | null } | null): StepCheck {
  if (!request || request.status === "denied" || request.status === "expired") {
    return { state: "none", detail: null };
  }
  if (request.status === "pending" || request.status === "approved") {
    return { state: "waiting", detail: null };
  }
  if (request.status === "failed" || (request.detail ?? "").startsWith(CHECK_DID_NOT_PASS)) {
    return { state: "failed", detail: request.detail };
  }
  return request.status === "executed"
    ? { state: "passed", detail: request.detail }
    : { state: "none", detail: null };
}

/**
 * A step Fadi checked and saw fail stays failed (Codex review, 16 Oct 2026: a failed agent
 * install could be marked done). The person may still go on WITHOUT verification — then it is
 * their word only, never evidence, whatever they type into the result.
 */
export function completionAfterCheck(
  check: StepCheck,
  artifact: string | null,
  unverified: boolean
): { ok: true; completion: Completion } | { ok: false; reason: "check_failed" | "check_waiting" } {
  if (check.state === "waiting" && !unverified) return { ok: false, reason: "check_waiting" };
  if (check.state === "failed") {
    return unverified
      ? { ok: true, completion: "attested" }
      : { ok: false, reason: "check_failed" };
  }
  return { ok: true, completion: unverified ? "attested" : completionFor(artifact) };
}

/** What a step becomes when it is completed with (or without) something recorded. */
export function completionFor(artifact: string | null | undefined): Completion {
  return artifact && artifact.trim() ? "evidenced" : "attested";
}

/** Steps that could be shown to somebody else. Attested ones are excluded, by definition. */
export function evidencedSteps<T extends CompletableStep>(steps: T[]): T[] {
  return steps.filter((s) => {
    const kind = completionOf(s);
    return kind === "evidenced" || kind === "verified";
  });
}

export type RunHonesty = {
  total: number;
  done: number;
  evidenced: number;
  /** True when every step is ticked. Says nothing about whether anything was produced. */
  complete: boolean;
  /**
   * Whether finishing this run may produce evidence at all.
   *
   * The single question the finishing copy has to answer, and the reason it exists as a
   * field rather than an inline expression: a call site that forgets it would go back to
   * promising achievement for an empty run.
   */
  canBecomeEvidence: boolean;
};

export function runHonesty(steps: CompletableStep[]): RunHonesty {
  const done = steps.filter((s) => s.status === "done").length;
  const evidenced = evidencedSteps(steps).length;
  return {
    total: steps.length,
    done,
    evidenced,
    complete: steps.length > 0 && done === steps.length,
    canBecomeEvidence: evidenced > 0,
  };
}
