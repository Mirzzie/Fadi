import type { RecommendedJob } from "@/lib/jobs/types";

type PresentableJob = Pick<RecommendedJob, "fieldRelated" | "matchReason" | "matchScore" | "onRole" | "overLevel">;

export type FitPresentation = {
  label: "Strong evidence" | "Possible fit" | "Needs review" | "Experience gap" | "Outside direction";
  tone: "strong" | "possible" | "caution" | "muted";
  reason: string;
};

/**
 * Convert the ranking signal into a decision aid. The internal score is useful for
 * ordering roles; displaying it as a percentage would claim a precision the matcher
 * cannot support.
 */
export function presentOpportunityFit(job: PresentableJob): FitPresentation {
  if (!job.onRole && !job.fieldRelated) {
    return { label: "Outside direction", tone: "muted", reason: job.matchReason };
  }
  if (job.overLevel) {
    return { label: "Experience gap", tone: "caution", reason: job.matchReason };
  }
  if (job.matchScore >= 70) {
    return { label: "Strong evidence", tone: "strong", reason: job.matchReason };
  }
  if (job.matchScore >= 45) {
    return { label: "Possible fit", tone: "possible", reason: job.matchReason };
  }
  return { label: "Needs review", tone: "muted", reason: job.matchReason };
}
