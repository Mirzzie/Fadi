/**
 * REHEARSING A PLAN ON A THROWAWAY COPY OF THE LAB (verified-labs V-3), the pure half: what each
 * step's rehearsal proved. A step is VERIFIED only when its own check fails before it runs,
 * its script succeeds, and the same check passes after. Anything else names what's wrong, so a
 * plan can be fixed before a person meets the problem.
 *
 * The owner met every one of these in one evening (15–16 Oct 2026): a step that left the
 * service stopped (check-failed-after), a script that couldn't parse (run-failed), a check that
 * proved nothing (check-passes-before), and downloads in a lab without DNS (needs-network).
 */

export type StepVerdict =
  /** Check failed before, script ran, check passed after. */
  | "verified"
  /** Its check passed before the step did anything: the check proves nothing. */
  | "check-passes-before"
  /** The script itself failed. */
  | "run-failed"
  /** The script ran, but the step's own check still fails. */
  | "check-failed-after"
  /** It needs the internet, and the rehearsal has none (V-3a is offline). Not a plan fault. */
  | "needs-network"
  /** No check, so a rehearsal can't tell whether it worked. */
  | "no-check"
  /** Nothing to run (a browser step), or an earlier step failed, so this one wasn't tried. */
  | "skipped";

export type StepRehearsal = {
  ordinal: number;
  verdict: StepVerdict;
  /** The tail of what the run printed, for the person or the planner. */
  output: string;
};

export type Observed = { exit: number | null; output: string };

/** Did a check pass: exit 0 AND the expected text in its output (as in the broker). */
export function checkPassed(check: Observed, expect: string): boolean {
  return check.exit === 0 && check.output.toLowerCase().includes(expect.toLowerCase());
}

/** The tell-tales of a command that reached for the network and found none. */
const NO_NETWORK =
  /Temporary failure (?:in name resolution|resolving)|Could not resolve host|Name or service not known|Network is unreachable|getaddrinfo|Failed to establish a new connection|No address associated with hostname|could not resolve|The remote name could not be resolved/i;

export function lackedNetwork(output: string): boolean {
  return NO_NETWORK.test(output);
}

export function judgeStep(input: {
  ordinal: number;
  expect: string | null;
  before: Observed | null;
  run: Observed;
  after: Observed | null;
}): StepRehearsal {
  const tail = input.run.output.slice(-2_000);
  const verdict = ((): StepVerdict => {
    // Some tools only WARN when offline and still exit 0 (`apt-get update`): a missing network
    // in the output explains whatever failure follows, not only a non-zero exit.
    const offline = lackedNetwork(input.run.output);
    if (input.run.exit !== 0) return offline ? "needs-network" : "run-failed";
    if (!input.expect || !input.before || !input.after)
      return offline ? "needs-network" : "no-check";
    if (checkPassed(input.before, input.expect)) return "check-passes-before";
    if (checkPassed(input.after, input.expect)) return "verified";
    return offline ? "needs-network" : "check-failed-after";
  })();
  return { ordinal: input.ordinal, verdict, output: tail };
}

/** A failure that stops the steps after it: they build on it. needs-network does too. */
export function stopsTheRest(verdict: StepVerdict): boolean {
  return (
    verdict === "run-failed" || verdict === "check-failed-after" || verdict === "needs-network"
  );
}

/** One line for the planner or the person: which steps are fine, which aren't, and why. */
export function rehearsalSummary(results: StepRehearsal[]): {
  verified: number;
  problems: StepRehearsal[];
} {
  return {
    verified: results.filter((r) => r.verdict === "verified").length,
    problems: results.filter((r) =>
      ["check-passes-before", "run-failed", "check-failed-after"].includes(r.verdict)
    ),
  };
}
