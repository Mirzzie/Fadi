import { createOutboxRepository, type DbOrTx } from "@careeros/database";

/**
 * The consequences that must survive a crash, and what each carries.
 *
 * Ids only — the event says WHICH record changed, and the handler reads that record as it is
 * when it runs. A payload that copied fields would deliver a stale version on a retry.
 */
export type OutboxTopics = {
  /** A project or course was saved to the career record. */
  "learning.completed": {
    evidenceItemId: string;
    runId?: string | null;
    commitmentId?: string | null;
  };
  /** An application was created or changed; its place in the work kernel follows it. */
  "application.changed": { applicationId: string };
  /**
   * An application reached an outcome worth learning from. The reflection is carried because it
   * exists nowhere else as a record — it is the fact itself, not a copy of one.
   */
  "application.outcome": {
    applicationId: string;
    outcome: "rejected";
    stage?: string | null;
    nextAction?: string | null;
    sharperNext?: string | null;
  };
  /** A practice interview finished, with or without a summary. */
  "interview.completed": { sessionId: string };
};

export type OutboxTopic = keyof OutboxTopics;

/**
 * Queue one consequence in the caller's transaction. `key` names the fact, not the attempt:
 * the same fact queued twice is one event, which is what makes a retried producer safe.
 */
export async function enqueueOutbox<T extends OutboxTopic>(
  db: DbOrTx,
  userId: string,
  topic: T,
  payload: OutboxTopics[T],
  key: string
): Promise<void> {
  await createOutboxRepository(db).enqueue(userId, {
    topic,
    payload: payload as Record<string, unknown>,
    dedupeKey: `${topic}:${key}`,
  });
}
