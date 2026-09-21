import "server-only";
import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  applications,
  careerProfiles,
  careerSelections,
  careerContextSnapshots,
  evidenceItems,
  jobs,
  profiles,
  type DbOrTx,
} from "@careeros/database";
import { getDatabase } from "@/lib/database/client";
import { formatCareerRecords, selectCareerRecords, type Selection } from "./selection";

export type CareerScope = {
  directionId?: string | null;
  applicationId?: string | null;
  jobId?: string | null;
  all?: boolean;
};
export async function buildCareerContext(
  userId: string,
  scope: CareerScope = {},
  options: {
    db?: DbOrTx;
    persist?: boolean;
    target?: { title?: string; company?: string; description?: string | null };
  } = {}
) {
  const read = async (tx: DbOrTx) => {
    const application = scope.applicationId
      ? (
          await tx
            .select()
            .from(applications)
            .where(and(eq(applications.userId, userId), eq(applications.id, scope.applicationId)))
            .limit(1)
        )[0]
      : null;
    if (scope.applicationId && !application) throw new Error("Application unavailable.");
    if (
      application?.careerProfileId &&
      scope.directionId &&
      application.careerProfileId !== scope.directionId
    )
      throw new Error("This application belongs to another direction.");
    if (application?.jobId && scope.jobId && application.jobId !== scope.jobId)
      throw new Error("Job does not match the application.");
    const directionId = application?.careerProfileId ?? scope.directionId;
    const direction =
      (
        await tx
          .select()
          .from(careerProfiles)
          .where(
            and(
              eq(careerProfiles.userId, userId),
              directionId ? eq(careerProfiles.id, directionId) : eq(careerProfiles.isActive, true)
            )
          )
          .limit(1)
      )[0] ?? null;
    if (directionId && !direction) throw new Error("Direction unavailable.");
    const jobId = application?.jobId ?? scope.jobId;
    const job = jobId ? (await tx.select().from(jobs).where(eq(jobs.id, jobId)).limit(1))[0] : null;
    if (jobId && (!job || (job.ownerUserId && job.ownerUserId !== userId)))
      throw new Error("Job unavailable.");
    const profile =
      (await tx.select().from(profiles).where(eq(profiles.userId, userId)).limit(1))[0] ?? null;
    const directionScope = direction ? `direction:${direction.id}` : null;
    const applicationScope = application ? `application:${application.id}` : null;
    const scopes = [directionScope, applicationScope].filter((s): s is string => Boolean(s));
    const preferences =
      scopes.length && !scope.all
        ? await tx
            .select()
            .from(careerSelections)
            .where(
              and(eq(careerSelections.userId, userId), inArray(careerSelections.scope, scopes))
            )
        : [];
    const rows = await tx.select().from(evidenceItems).where(eq(evidenceItems.userId, userId));
    const { available, selected, held } = selectCareerRecords(
      rows,
      preferences.filter((p) => p.scope === directionScope) as Selection[],
      preferences.filter((p) => p.scope === applicationScope) as Selection[],
      {
        role: job?.title ?? direction?.targetRole ?? "",
        domain: direction?.domain,
        synonyms: [
          ...(direction?.roleSynonyms ?? []),
          ...(job?.description?.split(/\s+/).slice(0, 600) ?? []),
        ],
      },
      scope.all ? Number.MAX_SAFE_INTEGER : 8
    );
    const payload = {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      directionId: direction?.id ?? null,
      applicationId: application?.id ?? null,
      jobId: job?.id ?? null,
      target: {
        title:
          job?.title ?? application?.title ?? options.target?.title ?? direction?.targetRole ?? "",
        company: job?.company ?? application?.company ?? options.target?.company ?? "",
        description:
          job?.description ?? application?.jobDescription ?? options.target?.description ?? "",
      },
      job: job
        ? {
            title: job.title,
            company: job.company,
            description: job.description,
            location: job.location,
          }
        : null,
      direction: direction
        ? {
            role: direction.targetRole,
            location: direction.location,
            domain: direction.domain,
            goal: direction.careerGoal,
            intent: direction.intent,
            experienceLevel: direction.experienceLevel,
          }
        : null,
      person: { name: profile?.fullName ?? "", email: profile?.email ?? "" },
      records: selected,
      provenance:
        "Captured current accepted evidence. Historical fact-version coverage is not yet complete. Acceptance is not independent verification.",
    };
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ ...payload, capturedAt: undefined }))
      .digest("hex");
    const snapshot = options.persist
      ? (
          await tx
            .insert(careerContextSnapshots)
            .values({ userId, fingerprint, payload })
            .returning()
        )[0]
      : null;
    return {
      snapshotId: snapshot?.id ?? null,
      fingerprint,
      payload,
      available,
      held,
      block: formatCareerRecords(selected),
      directionScope,
      applicationScope,
      preferences,
    };
  };
  return options.db
    ? read(options.db)
    : getDatabase().transaction((tx) => read(tx), { isolationLevel: "repeatable read" });
}

/** Raw imported prose is intake material, never fallback authority for this generation route. */
export async function approvedCareerEvidence(userId: string, scope: CareerScope = {}) {
  const context = await buildCareerContext(userId, scope);
  return {
    ...context,
    historySource: context.payload.records.length ? ("evidence" as const) : ("none" as const),
  };
}

export async function saveCareerSelection(
  userId: string,
  scope: CareerScope,
  input: Selection | (Omit<Selection, "mode"> & { mode: "inherit" })
) {
  return getDatabase().transaction(async (tx) => {
    const context = await buildCareerContext(userId, scope, { db: tx });
    const target = context.applicationScope ?? context.directionScope;
    if (!target) throw new Error("Choose a direction first.");
    if (!context.available.some((r) => r.factId === input.factId))
      throw new Error("Only accepted, classified records can be selected.");
    if (input.mode === "inherit") {
      await tx
        .delete(careerSelections)
        .where(
          and(
            eq(careerSelections.userId, userId),
            eq(careerSelections.scope, target),
            eq(careerSelections.factId, input.factId)
          )
        );
      return;
    }
    await tx
      .insert(careerSelections)
      .values({ userId, scope: target, ...input })
      .onConflictDoUpdate({
        target: [careerSelections.userId, careerSelections.scope, careerSelections.factId],
        set: {
          mode: input.mode,
          keepWording: input.keepWording,
          sortOrder: input.sortOrder,
          updatedAt: new Date(),
        },
      });
  });
}
