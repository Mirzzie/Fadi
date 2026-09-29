import "server-only";

import {
  createWorkItemsRepository,
  type Application,
  type DbOrTx,
  type ProjectRun,
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

const APPLICATION_FINISHED = new Set(["applied", "interviewing", "offer", "rejected"]);
const APPLICATION_DROPPED = new Set(["withdrawn"]);

function applicationRefs(application: Application): WorkRef[] {
  return [
    ...(application.jobId ? [{ type: "application_workspace", id: application.jobId }] : []),
    { type: "application", id: application.id },
    ...(application.jobId ? [{ type: "job", id: application.jobId }] : []),
  ];
}

async function settleApplicationWork(
  db: DbOrTx,
  userId: string,
  item: WorkItem,
  application: Application
): Promise<WorkItem> {
  const work = createWorkItemsRepository(db);
  if (APPLICATION_DROPPED.has(application.status) && LIVE.has(item.status)) {
    return work.setStatus(userId, item.id, "dropped", {
      reason: "The application was withdrawn.",
    });
  }
  if (APPLICATION_FINISHED.has(application.status) && LIVE.has(item.status)) {
    return work.setStatus(userId, item.id, "done", {
      reason:
        application.status === "applied"
          ? "The application was sent."
          : "The application moved beyond preparation.",
    });
  }
  return item;
}

/**
 * Attach the application record to its apply plan, or create one honest next action under the
 * active goal when it was tracked outside a plan.
 */
export async function linkApplicationToWork(
  db: DbOrTx,
  userId: string,
  application: Application
): Promise<WorkItem | null> {
  const work = createWorkItemsRepository(db);
  const appRef = { type: "application", id: application.id };
  const existing = (await work.listForRef(userId, appRef))[0];
  if (existing) return settleApplicationWork(db, userId, existing, application);

  const jobWork = application.jobId
    ? await work.listForRef(userId, { type: "job", id: application.jobId })
    : [];
  const plan = preferredPlan(jobWork);
  if (plan) {
    const refs = [
      ...applicationRefs(application),
      ...plan.refs.filter(
        (held) =>
          held.type !== "application_workspace" &&
          held.type !== "application" &&
          held.type !== "job"
      ),
    ];
    const linked = await work.update(userId, plan.id, { refs });
    await work.recordOutput(userId, {
      workItemId: linked.id,
      kind: "application",
      refId: application.id,
      label: `${application.title} at ${application.company}`,
    });
    return settleApplicationWork(db, userId, linked, application);
  }

  const goal = await work.activeGoal(userId);
  if (!goal) return null;
  let item = await work.create(userId, {
    kind: "step",
    parentId: goal.id,
    careerProfileId: application.careerProfileId ?? goal.careerProfileId,
    title: `Prepare ${application.title} at ${application.company}`,
    reason: "Prepare and send this application.",
    refs: applicationRefs(application),
  });
  await work.recordOutput(userId, {
    workItemId: item.id,
    kind: "application",
    refId: application.id,
    label: `${application.title} at ${application.company}`,
  });
  item = await settleApplicationWork(db, userId, item, application);
  return item;
}

/** Give every new hands-on project one place in Today, regardless of which screen planned it. */
export async function linkProjectRunToWork(
  db: DbOrTx,
  userId: string,
  run: ProjectRun
): Promise<WorkItem | null> {
  const work = createWorkItemsRepository(db);
  const ref = { type: "project_run", id: run.id };
  const existing = (await work.listForRef(userId, ref))[0];
  if (existing) return existing;

  const goal = await work.activeGoal(userId);
  if (!goal) return null;
  const item = await work.create(userId, {
    kind: "step",
    parentId: goal.id,
    careerProfileId: run.careerProfileId ?? goal.careerProfileId,
    title: `Build ${run.title}`,
    reason: "Complete the project steps and keep what proves the work.",
    status: run.status === "done" ? "done" : "active",
    refs: [
      ref,
      ...(run.commitmentId ? [{ type: "learning_commitment", id: run.commitmentId }] : []),
    ],
  });
  await work.recordOutput(userId, {
    workItemId: item.id,
    kind: "project_run",
    refId: run.id,
    label: run.title,
  });
  return item;
}
