import "server-only";

import { createApplicationsRepository, createDocumentsRepository, createJobsRepository, createProjectRunsRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { describeWhere, placeOf, routeTarget } from "@/lib/ai/context/where";
import { logger } from "@/lib/observability/logger";

/**
 * Turn the path the client sent into one true sentence for Fadi's context.
 *
 * The label always comes from the person's OWN row, never from the request: the client says
 * "/dashboard/documents/<id>" and the server decides whether that document is theirs and what it
 * is called. A path pointing at someone else's record therefore describes nothing.
 */
export async function describeCurrentPlace(
  userId: string,
  pathname?: string | null
): Promise<string> {
  if (!pathname) return "";
  const place = placeOf(pathname);
  if (!place) return "";

  const target = routeTarget(pathname);
  if (!target) return describeWhere({ place });

  try {
    const db = getDatabase();
    let label: string | null = null;
    if (target.kind === "document") {
      label = (await createDocumentsRepository(db).getForUser(userId, target.id))?.title ?? null;
    } else if (target.kind === "application") {
      const application = await createApplicationsRepository(db).getForUser(userId, target.id);
      label = application ? [application.title, application.company].filter(Boolean).join(" at ") : null;
    } else if (target.kind === "project") {
      label = (await createProjectRunsRepository(db).getWithSteps(userId, target.id))?.run.title ?? null;
    } else if (target.kind === "job") {
      const job = await createJobsRepository(db).findByIdForUser(userId, target.id);
      label = job ? [job.title, job.company].filter(Boolean).join(" at ") : null;
    }
    // Not theirs, or gone: describe the place and claim nothing about the record.
    if (!label) return describeWhere({ place });
    return describeWhere({ place, entity: { kind: target.kind, id: target.id, label } });
  } catch (error) {
    logger.warn("fadi.context.place_failed", {
      userId,
      error: error instanceof Error ? error.message.slice(0, 120) : "unknown",
    });
    return describeWhere({ place });
  }
}
