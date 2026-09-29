import "server-only";

import {
  createWorkItemsRepository,
  type DbOrTx,
  type WorkItem,
  type WorkRef,
} from "@careeros/database";

const LIVE = new Set(["open", "active", "blocked"]);

export type InterviewWorkInput = {
  sessionId: string;
  role: string;
  company?: string | null;
  stage: string;
  jobId?: string | null;
  applicationId?: string | null;
  careerProfileId?: string | null;
};

function refsFor(input: InterviewWorkInput): WorkRef[] {
  return [
    { type: "interview_session", id: input.sessionId },
    ...(input.jobId ? [{ type: "job", id: input.jobId }] : []),
    ...(input.applicationId ? [{ type: "application", id: input.applicationId }] : []),
  ];
}

function preferredPlan(items: WorkItem[]): WorkItem | undefined {
  return items.find((item) => item.kind === "plan" && LIVE.has(item.status));
}

/**
 * Tie an interview to the goal it serves. The kernel keeps ids and intent only; the session
 * remains authoritative in interview_sessions.
 */
export async function linkInterviewSessionToWork(
  db: DbOrTx,
  userId: string,
  input: InterviewWorkInput
): Promise<WorkItem | null> {
  const work = createWorkItemsRepository(db);
  const sessionRef = { type: "interview_session", id: input.sessionId };
  const existing = (await work.listForRef(userId, sessionRef))[0];
  if (existing) return existing;

  const [forApplication, forJob] = await Promise.all([
    input.applicationId
      ? work.listForRef(userId, { type: "application", id: input.applicationId })
      : [],
    input.jobId ? work.listForRef(userId, { type: "job", id: input.jobId }) : [],
  ]);
  const plan = preferredPlan([...forApplication, ...forJob]);
  const goal = plan ? null : await work.activeGoal(userId);
  const parent = plan ?? goal;
  if (!parent) return null;

  const label = input.company?.trim()
    ? `${input.role.trim()} at ${input.company.trim()}`
    : input.role.trim();
  const item = await work.create(userId, {
    kind: "step",
    parentId: parent.id,
    careerProfileId: input.careerProfileId ?? parent.careerProfileId,
    title: `Practise the ${label} interview`,
    reason: `Prepare for the ${input.stage.replaceAll("_", " ")} stage.`,
    status: "active",
    refs: refsFor(input),
  });
  await work.recordOutput(userId, {
    workItemId: item.id,
    kind: "interview_session",
    refId: input.sessionId,
    label,
  });
  return item;
}

/** Close only the work step attached to this session; the surrounding plan remains intact. */
export async function finishInterviewSessionWork(
  db: DbOrTx,
  userId: string,
  sessionId: string,
  outcome: "completed" | "abandoned" | "failed"
): Promise<void> {
  const work = createWorkItemsRepository(db);
  const items = await work.listForRef(userId, { type: "interview_session", id: sessionId });
  const status = outcome === "completed" ? "done" : "dropped";
  for (const item of items.filter(
    (candidate) => candidate.kind === "step" && LIVE.has(candidate.status)
  )) {
    await work.setStatus(userId, item.id, status, {
      reason:
        outcome === "completed"
          ? "Interview practice completed."
          : outcome === "failed"
            ? "Interview practice could not continue."
            : "Interview practice ended early.",
    });
  }
}
