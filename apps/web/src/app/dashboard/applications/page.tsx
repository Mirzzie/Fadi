import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { ApplicationsBoard } from "@/components/applications/applications-board";
import { ApplicationsTabs } from "@/components/applications/applications-tabs";
import { BatchPrep } from "@/components/applications/batch-prep";
import { DocumentsShell } from "@/components/documents/documents-shell";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import {
  createApplicationsRepository,
  createCareerProfilesRepository,
  createDocumentsRepository,
  createProfilesRepository,
  type TrackScope,
} from "@careeros/database";
import { onboardingStatusOf } from "@/lib/onboarding/status";
import { analyseChannelMix, channelInsight } from "@/lib/applications/channel";
import { isProseKind, letterSnippet } from "@/lib/documents/letter";
import { parseResume } from "@/lib/documents/resume";

/** A readable card snippet — content is JSON for structured kinds, so unpack it. */
function previewFor(kind: string, content: string): string {
  if (isProseKind(kind)) return letterSnippet(content, kind).slice(0, 140);
  if (kind === "resume") {
    const r = parseResume(content);
    return (r.summary || r.personal.headline || r.personal.name || "").slice(0, 140);
  }
  return content.slice(0, 140);
}

export const metadata: Metadata = { title: "Applications" };
export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in?next=/dashboard/applications");

  const db = getDatabase();
  const [docs, profile, activeTrack, tracks] = await Promise.all([
    createDocumentsRepository(db).listForUser(user.id),
    createProfilesRepository(db).getByUserId(user.id),
    createCareerProfilesRepository(db).getActiveForUser(user.id),
    createCareerProfilesRepository(db).listForUser(user.id),
  ]);

  // Gate on the profile we loaded in-batch — parallelized, not a serial round-trip.
  if (onboardingStatusOf(profile) !== "completed") redirect("/onboarding");

  // The active direction drives the pipeline by default; "all" is opt-in for
  // people deliberately running several directions at once. Their choice.
  const scope: TrackScope =
    profile?.pipelineScope === "all"
      ? { scope: "all" }
      : { scope: "active", careerProfileId: activeTrack?.id ?? null };
  const appsRepo = createApplicationsRepository(db);
  const apps = await appsRepo.listForUser(user.id, scope);
  const trackNames = new Map(tracks.map((t) => [t.id, t.label ?? t.targetRole]));

  // Monoculture check (PLATFORM_IDEOLOGY Principle 1): rejections through one vendor
  // are correlated, so a concentrated pipeline is one draw repeated — not progress.
  // Returns null unless there's genuine evidence of concentration.
  //
  // Reads channel signals (app url + linked JOB url), not `apps`: the application's own
  // url is null on the primary creation path, so attributing off it alone left this
  // insight permanently silent. The linked discovered job carries the real URL.
  const insight = channelInsight(
    analyseChannelMix(await appsRepo.listChannelSignalsForUser(user.id, scope)),
  );

  // Batch-prep candidates: active-pipeline roles with a JD but NO documents yet.
  // Rejected/withdrawn are excluded — never spend the user's AI budget on closed doors.
  const docKeys = new Set(docs.flatMap((d) => [d.applicationId, d.jobId].filter(Boolean) as string[]));
  const batchCandidates = apps
    .filter(
      (a) =>
        a.jobId &&
        (a.jobDescription ?? "").trim().length > 0 &&
        (a.status === "interested" || a.status === "applied" || a.status === "interviewing") &&
        !docKeys.has(a.id) &&
        !docKeys.has(a.jobId),
    )
    .map((a) => ({ jobId: a.jobId as string, title: a.title, company: a.company }));

  // The full documents library — the folded-in Documents tab. Scoped to the active
  // track (each direction owns its documents), same as the old standalone page.
  const libraryDocs = docs
    .filter((d) => !activeTrack || d.careerProfileId === activeTrack.id || d.careerProfileId === null)
    .map((d) => ({
      id: d.id,
      kind: d.kind,
      title: d.title,
      updatedAt: d.updatedAt.toISOString(),
      preview: previewFor(d.kind, d.content),
    }));

  const board = (
    <>
      <div className="mx-auto max-w-shell">
        <BatchPrep candidates={batchCandidates} />
      </div>
      <ApplicationsBoard
        scope={profile?.pipelineScope === "all" ? "all" : "active"}
        activeTrackName={activeTrack?.label ?? activeTrack?.targetRole ?? null}
        channelInsight={insight}
        applications={apps.map((a) => ({
          id: a.id,
          jobId: a.jobId,
          company: a.company,
          title: a.title,
          status: a.status,
          url: a.url,
          jobDescription: a.jobDescription,
          appliedAt: a.appliedAt ? a.appliedAt.toISOString() : null,
          // Which direction this belongs to — so a mixed pipeline stays legible.
          trackName: a.careerProfileId ? (trackNames.get(a.careerProfileId) ?? null) : null,
        }))}
        documents={docs
          .filter((d) => d.applicationId || d.jobId)
          .map((d) => ({
            id: d.id,
            kind: d.kind,
            title: d.title,
            applicationId: d.applicationId,
            jobId: d.jobId,
          }))}
      />
    </>
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-shell">
        <ApplicationsTabs board={board} library={<DocumentsShell documents={libraryDocs} />} />
      </div>
    </AppShell>
  );
}
