import { after } from "next/server";

import {
  createApplicationsRepository,
  createCareerProfilesRepository,
  createJobsRepository,
  createResumesRepository,
  createSavedJobsRepository,
} from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { getUserDocGenerate } from "@/lib/ai/user-generate";
import { ensureFreshLiveJobs } from "@/lib/jobs/sync";
import { createJobScorer } from "@/lib/jobs/job-matching";
import { expandRoleSynonyms } from "@/lib/jobs/role-synonyms";
import { passesFilters, type JobFilters } from "@/lib/jobs/filters";
import { getCountry } from "@/lib/jobs/locations";
import { checkPostingLiveness } from "@/lib/jobs/liveness";
import { sweepJobsLiveness } from "@/lib/jobs/liveness-sweep";
import { cosine, embedText, embedTexts, EMBEDDING_MODEL, fuseScore, meanVector } from "@/lib/ai/embeddings";
import {
  freshTrackVector,
  isSemanticRescue,
  jobEmbeddingText,
  resolveTrackEmbedding,
} from "@/lib/jobs/semantic";
import type { ApplicationStatus, RecommendedJob } from "@/lib/jobs/types";

// Below this match score a role is noise for this user — hide it rather than
// pad the list. Saved/applied roles are always kept regardless.
const MIN_RELEVANCE = 30;

export async function getRecommendedJobsForUser(
  userId: string,
  limit?: number,
  filters?: JobFilters,
  /** skipSync: read stored jobs only (don't block render on a live external pull).
   *  Used by the dashboard preview — the full Jobs page does the live refresh. */
  opts: { skipSync?: boolean } = {}
): Promise<RecommendedJob[]> {
  const db = getDatabase();
  const jobsRepository = createJobsRepository(db);
  const careerProfilesRepository = createCareerProfilesRepository(db);
  const resumesRepository = createResumesRepository(db);
  const savedJobsRepository = createSavedJobsRepository(db);
  const applicationsRepository = createApplicationsRepository(db);

  const [careerProfile, resume] = await Promise.all([
    careerProfilesRepository.getActiveForUser(userId),
    resumesRepository.getLatestForUser(userId),
  ]);

  // First time we score this track, have Fadi generate domain-agnostic role
  // synonyms (nurse → "staff nurse", "rn"; finance → "fp&a analyst") and store
  // them, so title-variant matching is as good for any field as it is for tech.
  // Best-effort + one-time (cached on the track); no AI provider → skip and fall
  // back to the token/phrase path (still unbiased).
  if (
    careerProfile?.targetRole &&
    (!careerProfile.roleSynonyms || careerProfile.roleSynonyms.length === 0)
  ) {
    try {
      const generate = await getUserDocGenerate(userId);
      if (generate) {
        const roles = [careerProfile.targetRole, ...(careerProfile.roleCluster ?? [])];
        const synonyms = await expandRoleSynonyms(roles, generate);
        if (synonyms.length > 0) {
          await careerProfilesRepository.setRoleSynonyms(careerProfile.id, synonyms);
          careerProfile.roleSynonyms = synonyms; // use them for this request too
        }
      }
    } catch {
      // best-effort — matching falls back to tokens + whole-role phrases
    }
  }

  // Pull fresh live postings (Remotive, Arbeitnow, …) into the jobs table,
  // personalized to the user's target role, before we read+score. TTL-guarded,
  // best-effort: if every source is down we just score whatever is stored.
  if (careerProfile?.targetRole && !opts.skipSync) {
    // Bound the live pull so the page never blocks more than a few seconds on slow
    // external sources. The sync keeps running and populates for the next load; we
    // render with whatever's stored now.
    const sync = ensureFreshLiveJobs(
      {
        targetRole: careerProfile.targetRole,
        skills: [],
        skillGaps: [],
        region: careerProfile.location,
        domain: careerProfile.domain,
      },
      { country: filters?.country, city: filters?.city, worldwide: filters?.worldwide },
    );
    await Promise.race([sync, new Promise((resolve) => setTimeout(resolve, 3500))]);
  }

  const jobs = await jobsRepository.listActive();
  const jobIds = jobs.map((job) => job.id);
  const [savedJobs, applications] = await Promise.all([
    savedJobsRepository.listForUserByJobIds(userId, jobIds),
    applicationsRepository.listForUserByJobIds(userId, jobIds),
  ]);
  const savedByJobId = new Map(savedJobs.map((savedJob) => [savedJob.jobId, savedJob]));
  const applicationByJobId = new Map(
    applications.map((application) => [application.jobId, application])
  );

  // When the user actively searched a location, score against THAT location
  // rather than only their profile's home region.
  const locationOverride =
    filters?.city || filters?.country
      ? [filters?.city, getCountry(filters?.country)?.name].filter(Boolean).join(", ")
      : null;

  const byId = new Map(jobs.map((j) => [j.id, j]));
  // Build the scorer ONCE (profile-constant work incl. the full resume tokenisation)
  // then reuse it across every job — instead of rebuilding it per job in the map.
  const scoreJob = createJobScorer({ careerProfile, resume, locationOverride });
  // Carry the lexical score + the different-function flag per job for the semantic
  // layer (re-ranking + rescue gating) without bloating the public RecommendedJob.
  const metaById = new Map<string, { lex: number; differentFunction: boolean }>();
  const recommendedJobs = jobs
    .map((job) => {
      const match = scoreJob(job);
      const savedJob = savedByJobId.get(job.id);
      const application = applicationByJobId.get(job.id);
      const lex = savedJob?.matchScore ?? match.matchScore;
      metaById.set(job.id, { lex, differentFunction: match.differentFunction });

      return {
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        remoteMode: job.remoteMode,
        employmentType: job.employmentType,
        seniority: job.seniority,
        salaryText: job.salaryText,
        description: job.description,
        url: job.url,
        postedAt: job.postedAt ?? null,
        firstSeenAt: job.createdAt,
        matchScore: lex,
        matchReason: savedJob?.matchSummary ?? match.matchReason,
        matchedKeywords: savedJob?.matchedSkills ?? match.matchedKeywords,
        onRole: match.onRole,
        fieldRelated: match.fieldRelated,
        overLevel: match.overLevel,
        isSaved: Boolean(savedJob),
        applicationStatus: (application?.status as ApplicationStatus | undefined) ?? null,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  // Hard filters first — the user chose a location / type / mode / visa, so these
  // are strict (a Dublin search shows ONLY Dublin roles, never remote-worldwide).
  const hardFiltered = filters
    ? recommendedJobs.filter((j) => passesFilters(j, filters))
    : recommendedJobs;

  // Relevance gating — NEVER pad with off-role jobs. We'd rather show fewer (or
  // an honest empty state) than surface "Risk Assurance Manager" for an
  // IT-support seeker. Saved/applied roles are always kept.
  const tracked = (j: (typeof recommendedJobs)[number]) => j.isSaved || Boolean(j.applicationStatus);
  const overBar = (j: (typeof recommendedJobs)[number]) => j.matchScore >= MIN_RELEVANCE;

  // 1) Strong: on-role AND above the bar.
  const strong = hardFiltered.filter((j) => (j.onRole && overBar(j)) || tracked(j));
  // 2) Fallback: on-role at any score — the right KIND of role, just weaker —
  //    but still never off-role.
  const onRoleAny = hardFiltered.filter((j) => j.onRole || tracked(j));
  // 3) Last resort: SAME FIELD, different role (e.g. a Security Engineer for a SOC
  //    Analyst seeker). Only when there are NO exact-role matches — so an empty
  //    board becomes honest, labelled adjacent roles instead of nothing. Still
  //    never off-field noise (sales/academia in the field are excluded upstream),
  //    and never a role far above the user's experience (an 8–10-yr Staff role for
  //    an early-career profile is not a realistic "related" suggestion).
  const fieldRelated = hardFiltered.filter((j) => (j.fieldRelated && !j.overLevel) || tracked(j));
  let shown =
    strong.length > 0
      ? strong
      : onRoleAny.length > 0
        ? onRoleAny.slice(0, 10)
        : fieldRelated.slice(0, 12);

  // ── Semantic layer (hybrid search) ── re-rank the board by MEANING and, when no
  // exact role matched, rescue close-by-meaning roles the keyword pass missed
  // (e.g. "Threat Detection Analyst" for a SOC Analyst). Entirely additive AND off
  // the hot path: ranking uses ONLY already-cached vectors (zero embedding calls
  // during render); the track vector + any missing job vectors are filled in the
  // BACKGROUND so the next load is fully semantic. With no embeddings provider /
  // cold cache, the board is exactly the lexical one. Every rescue still respects
  // the seniority + function gates — the vector decides field fit, never the gates.
  if (!opts.skipSync && careerProfile) {
    const inFallback = strong.length === 0 && onRoleAny.length === 0;
    // In-area jobs the lexical pass dropped, kept realistic (right level/function);
    // the vector judges field fit. Used for both rescue and background backfill.
    const rescuePool = inFallback
      ? hardFiltered
          .filter((j) => {
            const m = metaById.get(j.id);
            return !j.onRole && !j.fieldRelated && !j.overLevel && !(m?.differentFunction ?? true);
          })
          .slice(0, 40)
      : [];

    const trackVec = freshTrackVector(careerProfile);
    // Personalization (Phase 2): a "taste" vector from the roles the user has SAVED /
    // APPLIED to, so the board leans toward what they've actually engaged with. Cold
    // start (no history, or those jobs not embedded yet) → null → zero effect.
    const engagedIds = new Set<string>(
      [...savedByJobId.keys(), ...applicationByJobId.keys()].filter((id): id is string => id != null),
    );
    const prefVec = meanVector(
      [...engagedIds]
        .map((id) => byId.get(id)?.embedding)
        .filter((v): v is number[] => Array.isArray(v) && v.length > 0),
    );

    if (trackVec || prefVec) {
      const cosTo = (vec: number[] | null, id: string): number | null => {
        if (!vec) return null;
        const v = byId.get(id)?.embedding;
        return v && v.length > 0 ? cosine(vec, v) : null;
      };
      const trackCosOf = (j: { id: string }) => cosTo(trackVec, j.id);
      // Don't let an engaged job boost itself; only NEW jobs get a taste nudge.
      const prefCosOf = (j: { id: string }) => (engagedIds.has(j.id) ? null : cosTo(prefVec, j.id));

      // Re-rank what we're showing by the fused lexical + role + taste score.
      for (const j of shown) {
        const pc = prefCosOf(j);
        j.matchScore = fuseScore(metaById.get(j.id)?.lex ?? j.matchScore, trackCosOf(j), pc);
        if (pc != null && pc >= 0.5 && !tracked(j)) {
          j.matchReason = `${j.matchReason} · Similar to roles you've saved.`;
        }
      }
      shown.sort((a, b) => b.matchScore - a.matchScore);

      // Fallback: fold in semantic rescues the lexical tiers couldn't see (needs the
      // role vector to judge field fit; taste only re-orders).
      if (inFallback && trackVec) {
        const shownIds = new Set(shown.map((j) => j.id));
        const rescues = rescuePool
          .filter((j) => {
            if (shownIds.has(j.id)) return false;
            const m = metaById.get(j.id);
            return isSemanticRescue(trackCosOf(j), {
              onRole: j.onRole,
              fieldRelated: j.fieldRelated,
              overLevel: j.overLevel,
              differentFunction: m?.differentFunction ?? true,
            });
          })
          .map((j) => {
            j.matchScore = fuseScore(metaById.get(j.id)?.lex ?? j.matchScore, trackCosOf(j), prefCosOf(j));
            j.matchReason = `Close match by meaning to your ${careerProfile.targetRole ?? "role"} — not an exact title match. Review before applying.`;
            return j;
          })
          .sort((a, b) => b.matchScore - a.matchScore);
        if (rescues.length > 0) shown = [...shown, ...rescues].slice(0, 12);
      }
    }

    // Background: refresh the track vector (if stale) and embed any candidate jobs
    // that lack a vector — including the user's engaged (saved/applied) roles, so the
    // taste vector enriches over time. So the NEXT load ranks semantically. Never
    // blocks this response. after() runs post-response in request scope.
    const engagedActive = [...engagedIds].map((id) => byId.get(id)).filter((j): j is NonNullable<typeof j> => Boolean(j));
    const needVectors = [...shown, ...rescuePool, ...engagedActive].filter((j) => {
      const v = byId.get(j.id)?.embedding;
      return !(v && v.length > 0);
    });
    if (!trackVec || needVectors.length > 0) {
      try {
        after(async () => {
          try {
            await resolveTrackEmbedding(careerProfile, {
              embed: embedText,
              persist: (vec, basis) =>
                careerProfilesRepository.setEmbedding(careerProfile.id, vec, EMBEDDING_MODEL, basis),
            });
            const batch = needVectors.slice(0, 24);
            if (batch.length > 0) {
              const vecs = await embedTexts(batch.map((j) => jobEmbeddingText(j)));
              await Promise.all(
                batch.map(async (j, i) => {
                  const v = vecs[i];
                  if (v) await jobsRepository.setEmbedding(j.id, v, EMBEDDING_MODEL);
                }),
              );
            }
          } catch {
            // best-effort background work
          }
        });
      } catch {
        // not in a request scope (e.g. a background caller) — skip the deferral
      }
    }
  }

  // Drop postings the source has already CLOSED ("no longer accepting
  // applications" / 404). Bounded, DB-cached probe of just the jobs we're about to
  // show — only on the live page (skipSync = the fast dashboard read). Confirmed-
  // closed roles are persisted (status → "closed") so they leave the board for
  // everyone and never come back on a re-sync. Tracked (saved/applied) roles are
  // never hidden — the workspace shows their liveness banner instead.
  if (!opts.skipSync && shown.length > 0) {
    try {
      const closed = await sweepJobsLiveness(
        shown
          .filter((j) => !tracked(j))
          .map((j) => ({ id: j.id, url: j.url, livenessCheckedAt: byId.get(j.id)?.livenessCheckedAt ?? null })),
        {
          check: checkPostingLiveness,
          persist: (id, state) => jobsRepository.setJobLiveness(id, state),
        },
      );
      if (closed.size > 0) shown = shown.filter((j) => !closed.has(j.id));
    } catch {
      // Best-effort — a flaky probe never blocks the board.
    }
  }

  return typeof limit === "number" ? shown.slice(0, limit) : shown;
}
