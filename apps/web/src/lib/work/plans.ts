import "server-only";

/**
 * What Fadi knows how to do, written down.
 *
 * A plan is not improvised. The journeys people repeat have a shape that does not change with
 * the role or the day — applying is always: is this real, am I a fit, tailor, write, send — and
 * a model asked to invent that shape each time will invent a different one each time, skip the
 * check that matters, and leave nothing anyone can review. So the shape is a template, and the
 * model's job is the content inside a step.
 *
 * Each step names the capability that performs it, or names nobody, which is how a step that
 * only a person can do is marked. The arguments are COMPUTED at run time from the plan's own
 * refs — never stored — so nothing on disk can be edited into a call Fadi would not have made.
 */

export type PlanContext = {
  userId: string;
  job?: { id: string; title: string; company: string; description: string } | null;
};

export type PlanStepTemplate = {
  title: string;
  /** Why this step exists, in the person's words. Shown under it on Today. */
  reason: string;
  /** The capability that performs it. Omitted for a step only the person can do. */
  capability?: string;
  args?: (context: PlanContext) => Record<string, unknown>;
};

export type PlanTemplate = {
  id: string;
  /** The plan's own title, given the context. */
  title: (context: PlanContext) => string;
  steps: PlanStepTemplate[];
};

/**
 * Apply to a role.
 *
 * The order is the point. Checking the posting is still open comes first because everything
 * after it is wasted otherwise, and the fit check comes before the tailoring because the honest
 * answer to "should I apply" is sometimes no — and a plan that has already written the cover
 * letter will never say it.
 */
const APPLY_TO_ROLE: PlanTemplate = {
  id: "apply-to-role",
  title: (context) =>
    context.job ? `Apply to ${context.job.company} — ${context.job.title}` : "Apply to a role",
  steps: [
    {
      title: "Check the posting is still open",
      reason: "Everything after this is wasted on a role that has already closed.",
      capability: "check_posting_open",
      args: (context) => ({ jobId: context.job?.id }),
    },
    {
      title: "Check whether you are a fit",
      reason: "An honest no here saves the hour. This runs before anything is written.",
      capability: "evaluate_fit",
      args: (context) => ({
        jobDescription: context.job?.description ?? "",
        jobTitle: context.job?.title,
        company: context.job?.company,
      }),
    },
    {
      title: "Tailor your CV to this role",
      reason: "Your own record, ordered for what this posting actually asks for.",
      capability: "generate_document",
      args: (context) => ({
        kind: "resume",
        jobTitle: context.job?.title,
        company: context.job?.company,
      }),
    },
    {
      title: "Draft the message that goes with it",
      reason: "A short letter in your voice, pointing at the evidence you already have.",
      capability: "generate_document",
      args: (context) => ({
        kind: "cover_letter",
        jobTitle: context.job?.title,
        company: context.job?.company,
      }),
    },
    {
      title: "Read it, then send it",
      reason: "Fadi does not submit applications. You read what goes out in your name.",
    },
    {
      title: "Record that you applied",
      reason: "This is what later turns into follow-ups and what you learn from an outcome.",
      capability: "track_application",
      args: (context) => ({
        company: context.job?.company,
        title: context.job?.title,
        jobDescription: context.job?.description,
      }),
    },
  ],
};

export const PLAN_TEMPLATES: Record<string, PlanTemplate> = {
  [APPLY_TO_ROLE.id]: APPLY_TO_ROLE,
};

export function planTemplate(id: string): PlanTemplate | undefined {
  return PLAN_TEMPLATES[id];
}
