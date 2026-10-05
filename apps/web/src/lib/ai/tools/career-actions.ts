import "server-only";

import {
  createApplicationsRepository,
  createCareerProfilesRepository,
  createDocumentsRepository,
  createJobsRepository,
  createLearningCommitmentsRepository,
  createResumesRepository,
  createSavedJobsRepository,
  type ApplicationStatus,
} from "@careeros/database";

import { syncApplicationWork } from "@/lib/applications/sync-work";
import { getDashboardProfileSummary } from "@/lib/career-report/data";
import { getDatabase } from "@/lib/database/client";
import { normKind } from "@/lib/evidence/pool";
import { publish } from "@/lib/events/bus";
import { evaluateApply } from "@/lib/guardian/guardian";
import { scoreJobForUser } from "@/lib/jobs/job-matching";
import { commitToProject } from "@/lib/learning/commit";
import { flagshipDetail } from "@/lib/learning/flagship-rules";
import { getFlagships } from "@/lib/learning/flagships";
import { narrateNext, narrateToday } from "@/lib/voice/narrate";
import { clearWinner, closest } from "@/lib/voice/targets";

import type {
  ConsequentialResult,
  ConsequentialTool,
  FadiTool,
  FadiToolContext,
  FadiToolResult,
} from "./types";

/**
 * THE EVERYDAY THINGS, AS TOOLS.
 *
 * The app's buttons could save a role, move an application, start a flagship or add an
 * experience; Fadi's agent could not, so none of it was reachable by voice (Buddy) or by an MCP
 * client. Each tool here calls the SAME code the button does, so a change made by voice is the
 * change the screen would have made — scored, synced to the plan and receipted the same way.
 *
 * Things are named, not pointed at: "save the Deerfoot role". `prepare` turns the name into one
 * record (or a question) before anything is held, and `execute` takes the id it found, so a
 * confirmation acts on exactly what was read back. Every lookup is scoped to the caller.
 */

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const missing = (value: string) =>
  !value || ["null", "undefined", "none"].includes(value.toLowerCase());

type Named = { id: string; label: string };

/** One record the words name, or the question to ask instead. */
async function pick(
  said: string,
  candidates: Named[],
  what: string
): Promise<{ ok: true; target: Named } | { ok: false; summary: string }> {
  if (missing(said)) return { ok: false, summary: `Which ${what}? Say its name.` };
  if (candidates.length === 0) return { ok: false, summary: `You have no ${what}s yet.` };
  const target = clearWinner(said, candidates, { refuseExactTies: true });
  if (target) return { ok: true, target };
  const near = closest(said, candidates).map((c) => c.label);
  return {
    ok: false,
    summary: near.length
      ? `I couldn't tell which ${what} you meant by "${said}". Did you mean ${near.join(", or ")}?`
      : `I couldn't find a ${what} called "${said}".`,
  };
}

const needsInput = (summary: string): ConsequentialResult => ({
  summary,
  view: "none",
  outcome: "needs_input",
});

// ── Jobs ─────────────────────────────────────────────────────────────────────

async function jobCandidates(userId: string): Promise<Named[]> {
  return (await createJobsRepository(getDatabase()).listActiveForUser(userId)).map((job) => ({
    id: job.id,
    label: `${job.title} at ${job.company}`,
  }));
}

async function savedCandidates(userId: string): Promise<Named[]> {
  const db = getDatabase();
  const saved = await createSavedJobsRepository(db).listForUser(userId);
  const jobs = createJobsRepository(db);
  const out: Named[] = [];
  for (const row of saved.slice(0, 50)) {
    const job = await jobs.findByIdForUser(userId, row.jobId);
    if (job) out.push({ id: job.id, label: `${job.title} at ${job.company}` });
  }
  return out;
}

export const saveJobTool: ConsequentialTool = {
  name: "save_job",
  risk: "write",
  effect: "Save a role",
  description:
    "Save a role from the user's Opportunities to their saved roles, scored against their direction. Use when they say 'save the Deerfoot role', 'keep that one', 'shortlist the SOC analyst job'. Name the role by its title and/or company.",
  parameters: {
    type: "object",
    properties: {
      job: { type: "string", description: "The role as the user named it: title and/or company." },
    },
    required: ["job"],
  },
  async prepare(args, ctx) {
    const found = await pick(text(args.job), await jobCandidates(ctx.userId), "role");
    if (!found.ok) return found;
    return {
      ok: true,
      readBack: `save ${found.target.label} to your saved roles`,
      args: { jobId: found.target.id, job: found.target.label },
    };
  },
  async execute(args, ctx): Promise<ConsequentialResult> {
    let jobId = text(args.jobId);
    if (!jobId) {
      const found = await pick(text(args.job), await jobCandidates(ctx.userId), "role");
      if (!found.ok) return needsInput(found.summary);
      jobId = found.target.id;
    }
    const db = getDatabase();
    const [job, careerProfile] = await Promise.all([
      createJobsRepository(db).findByIdForUser(ctx.userId, jobId),
      createCareerProfilesRepository(db).getActiveForUser(ctx.userId),
    ]);
    if (!job || job.status !== "active") return needsInput("That role is no longer open.");
    const resume = await createResumesRepository(db).getLatestForTrack(
      ctx.userId,
      careerProfile?.id ?? null
    );
    const match = scoreJobForUser({ careerProfile, resume, job });
    await createSavedJobsRepository(db).saveForUser(ctx.userId, job.id, {
      careerProfileId: careerProfile?.id ?? null,
      matchScore: match.matchScore,
      matchSummary: match.matchReason,
      matchedSkills: match.matchedKeywords,
    });
    // The same guard the Save button has: saved either way, said out loud when it's off-direction.
    const guardian = evaluateApply({
      onRole: match.onRole,
      fieldRelated: match.fieldRelated,
      overLevel: match.overLevel,
      targetRole: careerProfile?.targetRole ?? null,
      jobTitle: job.title,
    });
    return {
      outcome: "performed",
      summary:
        `Saved ${job.title} at ${job.company}.` +
        (guardian.level !== "ok" && guardian.headline ? ` ${guardian.headline}.` : ""),
      view: "none",
      data: { jobId: job.id },
    };
  },
};

export const unsaveJobTool: ConsequentialTool = {
  name: "unsave_job",
  risk: "write",
  effect: "Remove a saved role",
  description:
    "Remove a role from the user's saved roles. Use when they say 'drop the Deerfoot role', 'unsave that', 'I'm not interested in the Acme job any more'.",
  parameters: {
    type: "object",
    properties: {
      job: { type: "string", description: "The saved role as the user named it." },
    },
    required: ["job"],
  },
  async prepare(args, ctx) {
    const found = await pick(text(args.job), await savedCandidates(ctx.userId), "saved role");
    if (!found.ok) return found;
    return {
      ok: true,
      readBack: `remove ${found.target.label} from your saved roles`,
      args: { jobId: found.target.id, job: found.target.label },
    };
  },
  async execute(args, ctx): Promise<ConsequentialResult> {
    let target: Named | undefined;
    const candidates = await savedCandidates(ctx.userId);
    const jobId = text(args.jobId);
    if (jobId) target = candidates.find((c) => c.id === jobId);
    else {
      const found = await pick(text(args.job), candidates, "saved role");
      if (!found.ok) return needsInput(found.summary);
      target = found.target;
    }
    if (!target) return needsInput("That role isn't in your saved roles.");
    await createSavedJobsRepository(getDatabase()).unsaveForUser(ctx.userId, target.id);
    return {
      outcome: "performed",
      summary: `Removed ${target.label} from your saved roles.`,
      view: "none",
    };
  },
};

// ── Applications ─────────────────────────────────────────────────────────────

const STATUSES: ApplicationStatus[] = [
  "interested",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
];

async function applicationCandidates(userId: string): Promise<Named[]> {
  return (await createApplicationsRepository(getDatabase()).listForUser(userId)).map((a) => ({
    id: a.id,
    label: `${a.title} at ${a.company}`,
  }));
}

function statusOf(value: unknown): ApplicationStatus | null {
  const said = text(value).toLowerCase();
  if ((STATUSES as string[]).includes(said)) return said as ApplicationStatus;
  if (/interview/.test(said)) return "interviewing";
  if (/reject|turned down|declined/.test(said)) return "rejected";
  if (/withdr|pulled out/.test(said)) return "withdrawn";
  if (/offer/.test(said)) return "offer";
  if (/appl/.test(said)) return "applied";
  return null;
}

export const setApplicationStatusTool: ConsequentialTool = {
  name: "set_application_status",
  risk: "write",
  effect: "Change an application's status",
  description:
    "Move one of the user's tracked applications to a new status: interested, applied, interviewing, offer, rejected or withdrawn. Use when they say 'I got an interview with Stripe', 'Acme rejected me', 'mark the Deerfoot application as applied'. Use track_application instead for a role that is not tracked yet.",
  parameters: {
    type: "object",
    properties: {
      application: {
        type: "string",
        description: "The application as the user named it: company and/or role.",
      },
      status: { type: "string", enum: STATUSES },
    },
    required: ["application", "status"],
  },
  async prepare(args, ctx) {
    const status = statusOf(args.status);
    if (!status) {
      return {
        ok: false,
        summary: "Which status: applied, interviewing, offer, rejected or withdrawn?",
      };
    }
    const found = await pick(
      text(args.application),
      await applicationCandidates(ctx.userId),
      "application"
    );
    if (!found.ok) return found;
    return {
      ok: true,
      readBack: `mark ${found.target.label} as ${status}`,
      args: { applicationId: found.target.id, application: found.target.label, status },
    };
  },
  async execute(args, ctx): Promise<ConsequentialResult> {
    const status = statusOf(args.status);
    if (!status)
      return needsInput("Which status: applied, interviewing, offer, rejected or withdrawn?");
    let id = text(args.applicationId);
    if (!id) {
      const found = await pick(
        text(args.application),
        await applicationCandidates(ctx.userId),
        "application"
      );
      if (!found.ok) return needsInput(found.summary);
      id = found.target.id;
    }
    const repo = createApplicationsRepository(getDatabase());
    const current = await repo.getForUser(ctx.userId, id);
    if (!current) return needsInput("I can't find that application.");
    if (current.status === status) {
      return {
        outcome: "refused",
        summary: `${current.title} at ${current.company} is already ${status}.`,
        view: "none",
      };
    }
    const updated = await repo.updateForUser(ctx.userId, id, { status });
    if (!updated) return needsInput("I can't find that application.");
    // As the board does it: the plan follows the application.
    await syncApplicationWork(ctx.userId, updated);
    return {
      outcome: "performed",
      summary: `Marked ${updated.title} at ${updated.company} as ${status}.`,
      view: "application",
      data: { id: updated.id, company: updated.company, title: updated.title },
    };
  },
};

// ── Today ────────────────────────────────────────────────────────────────────

export const todayBriefTool: FadiTool = {
  name: "today_brief",
  risk: "read",
  description:
    "What the user should do today: the goal they are working towards, the plan in flight and its next step, and anything waiting for their decision. Use for 'what should I do today', 'brief me', 'what's waiting for me', 'what's on'.",
  parameters: { type: "object", properties: {} },
  async execute(_args, ctx): Promise<FadiToolResult> {
    const summary = await getDashboardProfileSummary(ctx.userId).catch(() => null);
    const firstName = summary?.fullName?.trim().split(/\s+/)[0] || "there";
    // Lazily: Today reads the running plan, whose runner calls back into the tool registry.
    const { getToday } = await import("@/lib/work/today");
    const today = await getToday(ctx.userId, firstName, "apply");
    // The same narration the dashboard's voice uses, so what is said and what is shown agree.
    const brief = narrateToday(today);
    const next = today.plan || today.proposal || today.action ? "" : ` ${narrateNext(today)}`;
    return { summary: `${brief}${next}`.trim(), view: "none" };
  },
};

// ── Documents ────────────────────────────────────────────────────────────────

const KIND_LABEL: Record<string, string> = {
  resume: "CV",
  cover_letter: "cover letter",
  email: "email",
  value_proposition: "value proposition",
  note: "note",
};

/** Rich text to the words in it. */
function plainText(content: string): string {
  return (
    content
      .replace(/<\/(p|h\d|li|div)>/gi, ". ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .replace(/(\.\s*){2,}/g, ". ")
      // A paragraph that already ended in punctuation keeps it: "Dear team,." → "Dear team,".
      .replace(/([,;:!?])\s*\./g, "$1")
      .trim()
  );
}

async function documentsInDirection(userId: string) {
  const db = getDatabase();
  const track = await createCareerProfilesRepository(db).getActiveForUser(userId);
  return createDocumentsRepository(db).listForUser(userId, track?.id ?? null);
}

export const listDocumentsTool: FadiTool = {
  name: "list_documents",
  risk: "read",
  description:
    "List the user's documents in their current direction — CVs, cover letters, emails — newest first. Use for 'what documents do I have', 'which CVs have I made'.",
  parameters: { type: "object", properties: {} },
  async execute(_args, ctx): Promise<FadiToolResult> {
    const docs = await documentsInDirection(ctx.userId);
    if (docs.length === 0) {
      return {
        summary: "You have no documents yet. Ask me to draft a CV for a role.",
        view: "none",
      };
    }
    const named = docs
      .slice(0, 5)
      .map((d) => `${d.title} (${KIND_LABEL[d.kind] ?? d.kind})`)
      .join("; ");
    return {
      summary: `You have ${docs.length} document${docs.length === 1 ? "" : "s"}. Newest: ${named}.`,
      view: "none",
      data: {
        documents: docs.slice(0, 10).map((d) => ({ id: d.id, title: d.title, kind: d.kind })),
      },
    };
  },
};

export const readDocumentTool: FadiTool = {
  name: "read_document",
  risk: "read",
  description:
    "Read out the opening of one of the user's documents, found by name. Use for 'what does my Deerfoot cover letter say', 'read me my CV'.",
  parameters: {
    type: "object",
    properties: {
      document: { type: "string", description: "The document as the user named it." },
    },
    required: ["document"],
  },
  async execute(args, ctx): Promise<FadiToolResult> {
    const docs = await documentsInDirection(ctx.userId);
    const found = await pick(
      text(args.document),
      docs.map((d) => ({ id: d.id, label: d.title })),
      "document"
    );
    if (!found.ok) return { summary: found.summary, view: "none" };
    const doc = docs.find((d) => d.id === found.target.id)!;
    const body = plainText(doc.content);
    if (!body) return { summary: `${doc.title} is empty.`, view: "none" };
    const opening = body.split(" ").slice(0, 70).join(" ");
    return {
      summary: `${doc.title}, your ${KIND_LABEL[doc.kind] ?? doc.kind}. It opens: ${opening}`,
      view: "none",
      data: { id: doc.id, href: `/dashboard/documents/${doc.id}` },
    };
  },
};

// ── Career record ────────────────────────────────────────────────────────────

export const addExperienceTool: ConsequentialTool = {
  name: "add_experience",
  risk: "write",
  effect: "Add to the career record",
  description:
    "Add something the user did to their career record: a job, a project, an achievement, a certification, a course. Use when they tell you about it and want it kept — 'add that I passed Security+', 'I led the migration at Acme last year, add it'. Use only what they said; never invent metrics, dates or employers.",
  parameters: {
    type: "object",
    properties: {
      kind: {
        type: "string",
        enum: ["experience", "project", "achievement", "certification", "education", "skill"],
      },
      title: { type: "string", description: "What it was, in a few words." },
      organization: { type: "string", description: "Where, if they said." },
      period: { type: "string", description: "When, if they said." },
      detail: { type: "string", description: "What they did, in their words." },
      metrics: { type: "string", description: "A result they stated, with its number." },
    },
    required: ["kind", "title"],
  },
  async prepare(args) {
    const title = text(args.title);
    if (missing(title)) return { ok: false, summary: "What should I call it?" };
    const kind = normKind(text(args.kind));
    const facts = [kind === "unclassified" ? "" : kind, text(args.organization), text(args.period)]
      .filter((value) => !missing(value))
      .join(", ");
    return {
      ok: true,
      readBack: `add ${title}${facts ? ` (${facts})` : ""} to your career record`,
      args,
    };
  },
  async execute(args, ctx): Promise<ConsequentialResult> {
    const title = text(args.title);
    if (missing(title)) return needsInput("What should I call it?");
    const optional = (value: unknown) => (missing(text(value)) ? null : text(value));
    const { admitEvidence } = await import("@/lib/identity/admit");
    // Through the same gate as every other way in, so saying it twice does not record it twice.
    const { row, admission } = await admitEvidence(ctx.userId, {
      kind: normKind(text(args.kind)),
      title,
      organization: optional(args.organization),
      period: optional(args.period),
      detail: optional(args.detail) ?? "",
      metrics: optional(args.metrics),
      tags: [],
      origin: "manual",
    });
    if (admission.decision === "absorb") {
      return {
        outcome: "refused",
        summary: `That's already in your record as ${row.title}.`,
        view: "none",
      };
    }
    await publish("evidence.changed", {
      userId: ctx.userId,
      reason: "created",
      evidenceItemId: row.id,
    });
    return {
      outcome: "performed",
      summary:
        admission.decision === "review"
          ? `Added ${title}. It looks close to something already there, so it's waiting for you to compare them in My Career.`
          : `Added ${title} to your career record.`,
      view: "none",
      data: { id: row.id },
    };
  },
};

// ── Flagship projects ────────────────────────────────────────────────────────

export const listFlagshipsTool: FadiTool = {
  name: "list_flagships",
  risk: "read",
  description:
    "The two or three big projects proposed for the user's direction, each built around a business problem researched this week. Use for 'what big projects should I do', 'what are my flagships', 'what should I build'.",
  parameters: { type: "object", properties: {} },
  async execute(_args, ctx): Promise<FadiToolResult> {
    const { flagships, stale } = await getFlagships(ctx.userId);
    if (flagships.length === 0) {
      return {
        summary: "No flagship projects yet. Open Learning to research them for your direction.",
        view: "none",
      };
    }
    const named = flagships.map((f) => `${f.title}: ${firstSentence(f.problem)}`).join(" ");
    return {
      summary:
        `${flagships.length} flagship project${flagships.length === 1 ? "" : "s"}. ${named}` +
        (stale ? " They're over a week old; refresh them in Learning." : ""),
      view: "none",
      data: { flagships: flagships.map((f) => ({ title: f.title, scope: f.scope })) },
    };
  },
};

function firstSentence(value: string): string {
  const match = value.match(/^.*?[.!?](\s|$)/);
  return (match ? match[0] : value).trim();
}

async function flagshipCandidates(userId: string) {
  const { flagships } = await getFlagships(userId);
  return flagships.map((f) => ({ id: f.title, label: f.title, flagship: f }));
}

export const takeOnFlagshipTool: ConsequentialTool = {
  name: "take_on_flagship",
  risk: "write",
  effect: "Take on a flagship project",
  description:
    "Commit the user to one of their flagship projects (from list_flagships): it becomes a project with planned steps and a workspace. Use when they say 'take on the detection one', 'start the first flagship'.",
  parameters: {
    type: "object",
    properties: {
      flagship: { type: "string", description: "The flagship's title as the user named it." },
    },
    required: ["flagship"],
  },
  async prepare(args, ctx) {
    const found = await pick(
      text(args.flagship),
      await flagshipCandidates(ctx.userId),
      "flagship project"
    );
    if (!found.ok) return found;
    if (await alreadyTaken(ctx.userId, found.target.label)) {
      return { ok: false, summary: `You've already taken on ${found.target.label}.` };
    }
    return {
      ok: true,
      readBack: `take on ${found.target.label} and plan its steps`,
      args: { flagship: found.target.label, exact: true },
    };
  },
  async execute(args, ctx: FadiToolContext): Promise<ConsequentialResult> {
    const candidates = await flagshipCandidates(ctx.userId);
    // From what was stored, by title — as the Learning page does: the caller names which one,
    // never what it says.
    const chosen =
      args.exact === true
        ? candidates.find((c) => c.label === text(args.flagship))
        : await pick(text(args.flagship), candidates, "flagship project").then((r) =>
            r.ok ? candidates.find((c) => c.id === r.target.id) : undefined
          );
    if (!chosen)
      return needsInput("That project is no longer on your flagship list. Refresh it in Learning.");
    if (await alreadyTaken(ctx.userId, chosen.label)) {
      return {
        outcome: "refused",
        summary: `You've already taken on ${chosen.label}.`,
        view: "none",
      };
    }
    const result = await commitToProject(ctx.userId, {
      gap: "Flagship project",
      title: chosen.flagship.title,
      detail: flagshipDetail(chosen.flagship),
      kind: "project",
      searchQuery: chosen.flagship.title,
    });
    if (!result.ok) {
      return {
        outcome: "failed",
        summary: result.message ?? "Couldn't start it.",
        view: "none",
        isError: true,
      };
    }
    return {
      outcome: "performed",
      summary: result.runId
        ? `Took on ${chosen.label}. Its steps are planned; open it in Learning to start.`
        : `Took on ${chosen.label}. Planning the steps didn't finish; open it in Learning to plan them.`,
      view: "none",
      data: { runId: result.runId ?? null },
    };
  },
};

async function alreadyTaken(userId: string, title: string): Promise<boolean> {
  const rows = await createLearningCommitmentsRepository(getDatabase()).listForUser(userId, 100);
  return rows.some((row) => row.title.trim().toLowerCase() === title.trim().toLowerCase());
}

export const CAREER_ACTION_TOOLS: FadiTool[] = [
  todayBriefTool,
  saveJobTool,
  unsaveJobTool,
  setApplicationStatusTool,
  listDocumentsTool,
  readDocumentTool,
  addExperienceTool,
  listFlagshipsTool,
  takeOnFlagshipTool,
];
