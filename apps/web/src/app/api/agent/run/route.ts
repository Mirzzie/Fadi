import { NextResponse, type NextRequest } from "next/server";

import { createCareerProfilesRepository } from "@careeros/database";

import { runAgentForUser } from "@/lib/agents/background";
import { getDatabase } from "@/lib/database/client";
import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/observability/logger";

/**
 * Scheduled trigger for Fadi's background agency. Protected by CRON_SECRET —
 * Vercel Cron sends it as `Authorization: Bearer <CRON_SECRET>` automatically;
 * any other scheduler (docker cron, systemd timer, GitHub Action) can do the
 * same. Without the secret configured the route refuses to run.
 *
 * Per-user throttling lives in runAgentForUser (6h TTL), so overlapping
 * schedules are safe.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Stay under the route budget even with many users — the TTL means skipped
 *  users cost one query, so a large batch is fine. */
const MAX_USERS_PER_INVOCATION = 100;
const TIME_BUDGET_MS = 4 * 60 * 1000;

async function handle(request: NextRequest): Promise<NextResponse> {
  const secret = serverEnv.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured; refusing to run." },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const userIds = await createCareerProfilesRepository(getDatabase()).listUserIdsWithTracks(
    MAX_USERS_PER_INVOCATION,
  );

  let ran = 0;
  let skipped = 0;
  let failed = 0;

  for (const userId of userIds) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    const outcome = await runAgentForUser(userId);
    if (outcome.ran) ran += 1;
    else if (outcome.reason === "error") failed += 1;
    else skipped += 1;
  }

  logger.info("agent.cron_completed", { users: userIds.length, ran, skipped, failed });
  return NextResponse.json({ users: userIds.length, ran, skipped, failed });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
