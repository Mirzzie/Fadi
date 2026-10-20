import "server-only";

import {
  createApplicationsRepository,
  createInterviewSessionsRepository,
  createWorkItemsRepository,
  type DbOrTx,
  type OutboxEvent,
  type WorkRef,
} from "@careeros/database";

import { publish } from "@/lib/events/bus";
import { linkApplicationToWork } from "@/lib/work/domain-links";
import {
  practiceFromInterview,
  practiceFromRejection,
  type PracticeProposal,
} from "@/lib/work/outcome-learning";

import type { OutboxTopic, OutboxTopics } from "./topics";
import type { OutboxHandler } from "./worker";

const LIVE = new Set(["open", "active", "blocked"]);

/**
 * Each handler reads the records as they are now and is safe to run twice: it looks for what a
 * previous delivery left before creating anything, and kernel outputs are upserts.
 */
export function outboxHandlers(db: DbOrTx): Record<OutboxTopic, OutboxHandler> {
  const work = createWorkItemsRepository(db);

  /** One suggested task under the active goal, unless an earlier delivery already made it. */
  async function propose(userId: string, ref: WorkRef, proposal: PracticeProposal) {
    if ((await work.listForRef(userId, ref)).length > 0) return;
    const goal = await work.activeGoal(userId);
    if (!goal) return; // no goal to hang it on; Today would have nowhere to show it
    await work.create(userId, {
      kind: "step",
      parentId: goal.id,
      careerProfileId: goal.careerProfileId,
      title: proposal.title.slice(0, 200),
      reason: proposal.reason,
      status: "open",
      refs: [ref],
    });
  }

  const handlers: {
    [T in OutboxTopic]: (userId: string, payload: OutboxTopics[T]) => Promise<void>;
  } = {
    async "learning.completed"(userId, payload) {
      const refs: WorkRef[] = [
        ...(payload.runId ? [{ type: "project_run", id: payload.runId }] : []),
        ...(payload.commitmentId
          ? [{ type: "learning_commitment", id: payload.commitmentId }]
          : []),
      ];
      const seen = new Set<string>();
      for (const ref of refs) {
        for (const item of await work.listForRef(userId, ref)) {
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          await work.recordOutput(userId, {
            workItemId: item.id,
            kind: "evidence",
            refId: payload.evidenceItemId,
            label: "Saved to your career record",
          });
          if (item.kind === "step" && LIVE.has(item.status)) {
            await work.setStatus(userId, item.id, "done", {
              reason: "Finished and saved to your career record.",
            });
          }
        }
      }
      // Portfolio and report staleness listen for this; they only revalidate, so a repeat is
      // harmless.
      await publish("evidence.changed", {
        userId,
        reason: "learning_completed",
        evidenceItemId: payload.evidenceItemId,
      });
    },

    async "application.changed"(userId, payload) {
      const application = await createApplicationsRepository(db).getForUser(
        userId,
        payload.applicationId
      );
      if (!application) return; // deleted since; nothing to reflect
      await linkApplicationToWork(db, userId, application);
    },

    async "application.outcome"(userId, payload) {
      const application = await createApplicationsRepository(db).getForUser(
        userId,
        payload.applicationId
      );
      if (!application) return;
      await propose(
        userId,
        { type: "application_outcome", id: application.id },
        practiceFromRejection({
          title: application.title,
          company: application.company,
          stage: payload.stage,
          nextAction: payload.nextAction,
          sharperNext: payload.sharperNext,
        })
      );
    },

    async "interview.completed"(userId, payload) {
      const session = await createInterviewSessionsRepository(db).getForUser(
        userId,
        payload.sessionId
      );
      if (!session || session.status !== "completed") return;
      const proposal = practiceFromInterview(session.role, session.questions);
      if (!proposal) return;
      await propose(userId, { type: "interview_followup", id: session.id }, proposal);
    },
  };

  const wrap =
    <T extends OutboxTopic>(topic: T): OutboxHandler =>
    (event: OutboxEvent) =>
      handlers[topic](event.userId, event.payload as OutboxTopics[T]);

  return {
    "learning.completed": wrap("learning.completed"),
    "application.changed": wrap("application.changed"),
    "application.outcome": wrap("application.outcome"),
    "interview.completed": wrap("interview.completed"),
  };
}
