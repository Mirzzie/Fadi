import type { PracticeActivity } from "../contract";
import type { PracticePack } from "../pack";
import type { Criterion } from "../rubric";
import {
  CHURN_REVIEW_ASSETS,
  CUSTOMER_SUCCESS_PACK,
  churnBrief,
  churnCaseFor,
} from "./customer-success";

/**
 * The Practice activities this Fadi has installed, with the runtime each needs: how its case is
 * made from a run's seed, the brief a person sees, and the rubric adapter's assets per step.
 * One entry today; the shape is what a second pack plugs into. No browsing UI (Codex, Gate 3).
 */
export type ActivityRuntime = {
  pack: PracticePack;
  activity: PracticeActivity;
  /** The brief for a run, generated from its seed. */
  brief: (seed: string) => string;
  /** The case behind it, for the fact criteria. Opaque outside the pack. */
  caseFor: (seed: string) => unknown;
  assets: Record<
    string,
    { criteria: Criterion<unknown>[]; exampleAnswer: (theCase: unknown) => string }
  >;
};

const RUNTIMES: ActivityRuntime[] = [
  {
    pack: CUSTOMER_SUCCESS_PACK,
    activity: CUSTOMER_SUCCESS_PACK.activities.find((a) => a.id === "churn-review")!,
    brief: (seed) => churnBrief(churnCaseFor(seed)),
    caseFor: (seed) => churnCaseFor(seed),
    assets: CHURN_REVIEW_ASSETS as ActivityRuntime["assets"],
  },
];

export function activityRuntime(
  packId: string,
  activityId: string,
  packVersion?: string
): ActivityRuntime | null {
  return (
    RUNTIMES.find(
      (r) =>
        r.pack.id === packId &&
        r.activity.id === activityId &&
        (packVersion === undefined || r.pack.version === packVersion)
    ) ?? null
  );
}

export function installedActivities(): ActivityRuntime[] {
  return RUNTIMES;
}
