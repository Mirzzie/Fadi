import "server-only";

import { getRecommendedJobsForUser } from "@/lib/jobs/data";
import { parseLocation, getCountry } from "@/lib/jobs/locations";
import {
  getMomentumReflection,
  getMomentumSummary,
  summarizeRejectionPatterns,
} from "@/lib/resilience/service";
import { answerBehavioral } from "@/lib/interview/story-bank";
import { prepareInterviewForJob } from "@/lib/interview/jd-prep";
import { formatPrepQuestion } from "@/lib/interview/jd-prep";
import { prepareCompanyBrief, formatBrief } from "@/lib/interview/company-brief";
import { generateMockQuestions, scoreInterviewAnswer } from "@/lib/interview/mock";
import { getDashboardProfileSummary } from "@/lib/career-report/data";
import { rankedEvidenceForActiveTrack } from "@/lib/evidence/pool";
import { fetchCompanyAtsJobs } from "@/lib/data-sources/ats-boards";
import { evaluateFit } from "@/lib/jobs/fit";
import { createTrackTool } from "./create-track";
import { generateDocument } from "./generate-document";
import { getLaborMarket } from "./labor-market";
import { getWorldShifts } from "./world-shifts";
import { trackApplication } from "./track-application";
import { runWithReceipt } from "./receipts";
import type { ConsequentialResult, FadiTool, FadiToolContext, FadiToolResult } from "./types";

/**
 * Fadi's tool registry. Each tool wraps a real Fadi service so Fadi can act on
 * live data and return something the chat can both speak and show. Add tools (and
 * external-source plugins) here — Fadi picks them up automatically.
 */

const searchJobs: FadiTool = {
  name: "search_jobs",
  risk: "read",
  description:
    "Search live job postings for the user, optionally scoped to a country/city and keywords. Use when the user asks to see, list, or find jobs — anywhere in the world, any employment type.",
  parameters: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: 'Country and/or city, e.g. "Dublin, Ireland", "Berlin", "United States".',
      },
      keywords: { type: "string", description: "Role or skill keywords to focus the search." },
      work_mode: {
        type: "string",
        enum: ["remote", "hybrid", "onsite"],
        description: "Only roles with this way of working, when the user says so.",
      },
      employment_type: {
        type: "string",
        enum: ["full-time", "part-time", "contract", "freelance"],
        description: "Only this kind of contract, when the user says so.",
      },
      visa_sponsorship: {
        type: "boolean",
        description: "True when the user needs visa sponsorship.",
      },
      limit: { type: "number", description: "How many roles to return (default 6, max 12)." },
    },
  },
  async execute(args, ctx): Promise<FadiToolResult> {
    const parsed = parseLocation(typeof args.location === "string" ? args.location : undefined);
    const limit = Math.min(Math.max(Number(args.limit) || 6, 1), 12);
    // Every detail the person said narrows the search. `keywords` was declared and then never
    // passed on, so "data engineer jobs in Dublin" searched only Dublin (found 5 Oct 2026).
    const keywords =
      typeof args.keywords === "string"
        ? args.keywords
            .split(/[,;]|\s+and\s+/i)
            .map((word) => word.trim())
            .filter(Boolean)
            .slice(0, 6)
        : [];
    const mode = ["remote", "hybrid", "onsite"].includes(String(args.work_mode))
      ? [args.work_mode as "remote" | "hybrid" | "onsite"]
      : [];
    const type = ["full-time", "part-time", "contract", "freelance"].includes(
      String(args.employment_type)
    )
      ? [args.employment_type as "full-time" | "part-time" | "contract" | "freelance"]
      : [];

    const jobs = await getRecommendedJobsForUser(ctx.userId, limit, {
      country: parsed.country,
      city: parsed.city,
      keywords,
      modes: mode,
      types: type,
      visa: args.visa_sponsorship === true ? "sponsored" : "any",
    });

    const where = parsed.city
      ? `${parsed.city}${getCountry(parsed.country) ? `, ${getCountry(parsed.country)!.name}` : ""}`
      : (getCountry(parsed.country)?.name ?? "your target market");

    if (jobs.length === 0) {
      return {
        summary: `No live roles came back for ${where} right now. Suggest a broader location or different keywords.`,
        view: "jobs",
        data: { where, jobs: [] },
      };
    }

    const top = jobs.slice(0, limit).map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location,
      salaryText: j.salaryText,
      matchScore: j.matchScore,
      url: j.url,
    }));

    return {
      summary: `Found ${top.length} live role(s) for ${where}. Top: ${top
        .slice(0, 3)
        .map((j) => `${j.title} at ${j.company}`)
        .join("; ")}.`,
      view: "jobs",
      data: { where, jobs: top },
    };
  },
};

const getPerformance: FadiTool = {
  name: "get_performance",
  risk: "read",
  description:
    "Get the user's career momentum and performance: momentum score, band, resting state, cadence adherence, and quality applications this period. Use for 'how am I doing', 'my performance', 'my progress'.",
  parameters: { type: "object", properties: {} },
  async execute(_args, ctx): Promise<FadiToolResult> {
    const m = await getMomentumSummary(ctx.userId);
    return {
      summary: `Momentum ${m.momentum} (peak ${m.peakMomentum}), band "${m.band}". ${m.bandMessage} Cadence: ${m.cadenceMessage} ${m.qualityApplicationsThisPeriod} quality application(s) this period.${m.isResting ? " Currently resting — that's allowed." : ""}`,
      view: "performance",
      data: {
        momentum: m.momentum,
        peakMomentum: m.peakMomentum,
        band: m.band,
        bandMessage: m.bandMessage,
        isResting: m.isResting,
        cadenceAdherence: m.cadenceAdherence,
        cadenceMessage: m.cadenceMessage,
        qualityApplicationsThisPeriod: m.qualityApplicationsThisPeriod,
      },
    };
  },
};

const getCareerUpdates: FadiTool = {
  name: "get_career_updates",
  risk: "read",
  description:
    "Get what's new for the user: freshly matched roles. Use for 'what's new', 'any updates', 'what did you find'.",
  parameters: { type: "object", properties: {} },
  async execute(_args, ctx): Promise<FadiToolResult> {
    const jobs = await getRecommendedJobsForUser(ctx.userId, 5);
    const top = jobs.slice(0, 5).map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location,
      matchScore: j.matchScore,
      url: j.url,
    }));
    return {
      summary:
        top.length > 0
          ? `${top.length} matched role(s) waiting: ${top.map((j) => `${j.title} (${j.company})`).join("; ")}.`
          : "No fresh matched roles cleared the bar yet — I'm still watching your market.",
      view: "updates",
      data: { jobs: top },
    };
  },
};

const getRejectionPatterns: FadiTool = {
  name: "get_rejection_patterns",
  risk: "read",
  description:
    "Run a rejection autopsy across the user's rejected applications: surface the named pattern (e.g. filtered before a human, or losing at the interview stage) and the sharper next move. Use for 'why do I keep getting rejected', 'run a rejection autopsy', 'what's the pattern in my no's'. Grounded only in real logged rejections.",
  parameters: { type: "object", properties: {} },
  async execute(_args, ctx): Promise<FadiToolResult> {
    const { rejectionCount, insight } = await summarizeRejectionPatterns(ctx.userId);
    if (rejectionCount === 0 || !insight) {
      return {
        summary:
          "You haven't logged any rejections yet, so there's no pattern to read. When a 'no' comes in, log it and I'll turn it into a sharper next application — I won't guess at a pattern that isn't there.",
        view: "none",
      };
    }
    const patternLine = insight.pattern
      ? `The pattern across your ${rejectionCount} rejection(s): ${insight.pattern.name}. ${insight.pattern.evidence}`
      : `Across your ${rejectionCount} rejection(s) there isn't a strong enough pattern to call one honestly yet.`;
    const steps = insight.sharperNextApplication.map((s, i) => `${i + 1}. ${s}`).join(" ");
    return {
      summary: `${patternLine} Sharper next application: ${steps} ${insight.reframe}`.trim(),
      view: "none",
      data: { rejectionCount, insight },
    };
  },
};

const REFERRAL_RELATIONSHIPS = [
  "alumni",
  "former_colleague",
  "second_degree",
  "friend",
  "recruiter",
  "cold",
] as const;

const draftReferralOutreachTool: FadiTool = {
  name: "draft_referral_outreach",
  risk: "write",
  effect: "Add a referral target and draft the message",
  description:
    "Add a referral target at a company and draft a short, sendable outreach message asking for a referral or warm intro. Use for 'help me get a referral at X', 'draft my message to someone at X', 'who should I ask at X'. A referral is an independent draw that routes around the correlated screening software — the highest-leverage move. Company is required; role/contact are optional.",
  parameters: {
    type: "object",
    properties: {
      company: { type: "string", description: "The company to get a referral into." },
      role: { type: "string", description: "The role the user is targeting there, if known." },
      contactName: { type: "string", description: "Name of a specific person to reach, if any." },
      contactRole: { type: "string", description: "That person's job/title, if known." },
      relationship: {
        type: "string",
        enum: [...REFERRAL_RELATIONSHIPS],
        description: "How the user knows or could reach them.",
      },
    },
    required: ["company"],
  },
  async execute(args, ctx): Promise<ConsequentialResult> {
    const company = typeof args.company === "string" ? args.company.trim() : "";
    if (!company) {
      return {
        outcome: "needs_input",
        summary:
          "Which company do you want a referral into? Tell me and I'll set it up and draft the message.",
        view: "none",
      };
    }
    const opt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
    const rel =
      typeof args.relationship === "string" &&
      (REFERRAL_RELATIONSHIPS as readonly string[]).includes(args.relationship)
        ? (args.relationship as (typeof REFERRAL_RELATIONSHIPS)[number])
        : "cold";

    const { addReferralTarget, draftOutreachFor } = await import("@/lib/network/referrals");
    const target = await addReferralTarget(ctx.userId, {
      company,
      roleTitle: opt(args.role),
      contactName: opt(args.contactName),
      contactRole: opt(args.contactRole),
      relationship: rel,
    });
    const res = await draftOutreachFor(ctx.userId, target.id);

    return {
      outcome: "performed",
      summary: res.draft
        ? `I added ${company} as a referral target and drafted a message you can send:\n\n${res.draft}\n\nWhen you actually reach out, mark "I reached out" on the Network page — that ask is your highest-leverage move.`
        : `I added ${company} as a referral target. Open the Network page to draft and send your outreach.`,
      view: "none",
      data: { id: target.id, company, draft: res.draft ?? null },
    };
  },
};

const answerBehavioralTool: FadiTool = {
  name: "answer_behavioral_question",
  risk: "read",
  description:
    "Answer a behavioral interview question ('tell me about a time you…', 'describe a situation where…') using the candidate's OWN interview story bank — their real STAR+Reflection stories. Use when the user is practicing interviews or asks how to answer a behavioral question. Grounded only in their real stories; never invents experience.",
  parameters: {
    type: "object",
    properties: {
      question: { type: "string", description: "The behavioral interview question to answer." },
    },
    required: ["question"],
  },
  async execute(args, ctx): Promise<FadiToolResult> {
    const question = typeof args.question === "string" ? args.question.trim() : "";
    if (!question) {
      return {
        summary:
          "What behavioral question do you want to practice? Give me the prompt and I'll answer it from your real stories.",
        view: "none",
      };
    }
    const res = await answerBehavioral(ctx.userId, question);
    if (!res.ok) return { summary: res.message ?? "Build your story bank first.", view: "none" };
    return {
      summary: `Best story for "${question}" — "${res.storyTitle}":\n\n${res.answer}\n\nDeliver it in your own words; don't recite. Want me to tighten any part?`,
      view: "none",
      data: { storyTitle: res.storyTitle, answer: res.answer },
    };
  },
};

const scanCompanyJobsTool: FadiTool = {
  name: "scan_company_jobs",
  risk: "read",
  description:
    "Pull a company's CURRENTLY OPEN roles straight from its applicant-tracking board (Greenhouse / Lever / Ashby) — fresher and far less ghost-prone than aggregators. Use for 'what's open at <company>', 'show me roles at <company>', or to check companies the user is targeting. Provide the company name; optionally a role to filter by.",
  parameters: {
    type: "object",
    properties: {
      company: { type: "string", description: "The company whose open roles to pull." },
      role: { type: "string", description: "Optional role/title keyword to filter by." },
    },
    required: ["company"],
  },
  async execute(args, ctx): Promise<FadiToolResult> {
    void ctx;
    const company = typeof args.company === "string" ? args.company.trim() : "";
    if (!company) {
      return { summary: "Which company's open roles do you want me to pull?", view: "none" };
    }
    const role = typeof args.role === "string" ? args.role.trim() : "";
    const res = await fetchCompanyAtsJobs(company, { keywords: role ? [role] : [], limit: 15 });
    if (res.jobs.length === 0) {
      return {
        summary: `I couldn't find a public Greenhouse, Lever, or Ashby board for ${company}${role ? ` with "${role}" roles` : ""}. Not every company uses those (or the name might be spelled differently on their board). Want me to search the job aggregators instead?`,
        view: "none",
      };
    }
    const lines = res.jobs
      .slice(0, 10)
      .map((j) => `• ${j.title}${j.location ? ` — ${j.location}` : ""}`)
      .join("\n");
    return {
      summary: `${res.jobs.length} open role(s) at ${company}, live from its ${res.provider} board:\n${lines}\n\nThese come straight from the employer's ATS, so they're current — a referral here is your highest-leverage next move.`,
      view: "none",
      data: { company, provider: res.provider, jobs: res.jobs },
    };
  },
};

const evaluateFitTool: FadiTool = {
  name: "evaluate_fit",
  risk: "read",
  description:
    "Run an honest FIT CHECK before the user applies: is this specific job worth their limited time? Use when they paste a job description and ask 'should I apply', 'is this worth it', 'am I a fit'. Returns a 0–5 verdict (apply / stretch / skip) graded against their real experience — anti-spray, not résumé scoring.",
  parameters: {
    type: "object",
    properties: {
      jobDescription: { type: "string", description: "The full job description text to evaluate." },
      jobTitle: { type: "string", description: "The role title, if known." },
      company: { type: "string", description: "The company, if known." },
    },
    required: ["jobDescription"],
  },
  async execute(args, ctx): Promise<FadiToolResult> {
    const jd = typeof args.jobDescription === "string" ? args.jobDescription : "";
    const res = await evaluateFit(ctx.userId, {
      jobDescription: jd,
      jobTitle: typeof args.jobTitle === "string" ? args.jobTitle : undefined,
      company: typeof args.company === "string" ? args.company : undefined,
    });
    if (!res.ok) return { summary: res.message, view: "none" };
    const e = res.evaluation;
    const reasons = e.topReasons
      .slice(0, 3)
      .map((r) => `• ${r}`)
      .join("\n");
    const gaps =
      e.gapsToClose.length > 0
        ? `\nTo close the gap: ${e.gapsToClose.slice(0, 3).join("; ")}.`
        : "";
    return {
      summary: `Fit: ${e.overall.toFixed(1)}/5 — ${e.verdict.toUpperCase()}.\n${e.verdictReason}\n${reasons}${gaps}`,
      view: "none",
      data: { overall: e.overall, verdict: e.verdict, dimensions: e.dimensions },
    };
  },
};

/* ---------------------------------------------------------------------------
 * PROJECT RUNS — the tools that let Fadi DO a project rather than link to one.
 *
 * The learning section's output was a suggestion and a tutorial link. The user's
 * verdict: "all these efforts to give me a youtube watch link is not great. I want real
 * agentic tool actions and guide me in each step on it until I complete the project."
 *
 * These give a model the verbs it needs to run alongside someone: plan against the
 * hardware they own, read where they are, mark a step done with what it produced, and
 * finish. Nothing here does the work for them — it removes the part where they have to
 * hold the whole plan in their head and decide alone what "done" looks like.
 * ------------------------------------------------------------------------- */

const planProjectTool: FadiTool = {
  name: "plan_project",
  risk: "write",
  effect: "Plan a project and save its steps",
  description:
    "Turn a project idea into concrete steps the user can execute TONIGHT on hardware they actually own. Use when they commit to a project, ask how to start one, or say a suggestion is too vague. Each step gets a way to verify it worked and names what it produces. Never answer a 'how do I build X' question with links when this can produce a real plan.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "The project title." },
      detail: { type: "string", description: "What the project involves, if known." },
    },
    required: ["title"],
  },
  async execute(args, ctx): Promise<ConsequentialResult> {
    const title = typeof args.title === "string" ? args.title.trim() : "";
    if (!title)
      return {
        summary: "I need the project title to plan it.",
        view: "none",
        outcome: "needs_input",
      };
    const { planProjectRun } = await import("@/lib/lab/plan-run");
    const res = await planProjectRun(ctx.userId, {
      title,
      detail: typeof args.detail === "string" ? args.detail : null,
    });
    if (!res.ok) return { summary: res.message, view: "none", outcome: "failed" };
    return {
      outcome: "performed",
      summary: `Planned "${title}" as ${res.plan.steps} steps against your own hardware. Open Learning to work through them — each one says how to tell it worked.`,
      view: "none",
      data: { runId: res.plan.runId, steps: res.plan.steps },
    };
  },
};

/**
 * THE MODEL ASKS THE MACHINE — through the same door as everyone else.
 *
 * This is the tool the user was after: "AI model calling, skills calling, tool calling"
 * against their real hardware, not a link to a tutorial. What makes it safe to hand a
 * model is that it cannot say WHAT to run. It names a capability from a fixed catalogue
 * and the broker decides, checking a grant the user gave and writing an audit row either
 * way — with actor "model", so the log distinguishes "the model asked for this" from
 * "the user did this".
 *
 * When permission is missing the tool does not fail silently or invent a machine. It
 * returns the request, so the model can say what it wants to look at and why, and the
 * person can answer.
 */
const inspectMachineTool: FadiTool = {
  name: "inspect_machine",
  risk: "external",
  effect: "Look at the machine",
  description:
    "Look at what is actually installed on the user's own machine — container runtimes, hypervisors, memory and CPU — before planning a project or claiming something will run. Use when hardware matters to the answer. Requires the user's permission; if they have not granted it, this returns what to ask them for. Never guess the user's hardware when this tool can read it.",
  parameters: { type: "object", properties: {} },
  async execute(_args, ctx): Promise<ConsequentialResult> {
    const { scanLocalMachine } = await import("@/lib/lab/local-probe");
    // The audit row says which surface asked. "An MCP client wanted to see my hypervisor"
    // and "the assistant I am talking to wanted to" are different facts, and the log is
    // only useful if it can tell them apart.
    const surface = ctx.surface ?? "chat";
    const scan = await scanLocalMachine({
      userId: ctx.userId,
      actor: surface === "mcp" ? "mcp" : surface === "agent" ? "agent" : "model",
      origin: "tool:inspect_machine",
    });

    if (scan.needsGrant.length > 0 && scan.findings.length === 0) {
      return {
        outcome: "refused",
        // Said as a request, because that is what it is. A model that reports "I checked
        // and found nothing" when it was actually blocked has told the user something
        // false about their own computer.
        summary:
          "I can't look at this machine yet — you haven't allowed it. I'd want to: " +
          scan.needsGrant.map((g) => g.summary).join(" ") +
          " Open Learning → Machine access to allow it, and it expires on its own.",
        view: "none",
      };
    }

    const found = scan.findings.map((f) => f.detail).join(" ");
    const host = scan.host
      ? `${Math.round(scan.host.memoryMb! / 1024)}GB RAM, ${scan.host.cpus ?? "?"} CPUs, ${scan.host.arch}` +
        // Free disk decides whether a Windows lab is even possible, so it belongs in the
        // sentence rather than only in the row.
        (scan.host.freeDiskGb !== null ? `, ${scan.host.freeDiskGb}GB free.` : ".")
      : "";
    return {
      outcome: "performed",
      summary: scan.findings.length
        ? `On this machine: ${found} ${host}`.trim()
        : `Nothing detectable here${scan.absent.length ? ` — no ${scan.absent.slice(0, 3).join(", ")}` : ""}. ${host}`.trim(),
      view: "none",
      data: { findings: scan.findings, host: scan.host },
    };
  },
};

/**
 * THE MODEL PROPOSES A CHANGE — and that is the end of what it can do.
 *
 * This is the tool that turns "here is a tutorial" into "here is the container running on
 * your laptop". It is also the most dangerous surface in Fadi, so it is built the other
 * way round from a normal tool: it does not take a command, it takes a RECIPE ID and
 * typed parameters, and it finishes by writing a row that asks the user a question.
 *
 * Nothing here runs. There is no argument to this tool, and no state anywhere, that lets
 * a model skip the person. If a job description Fadi read says "run this instead", the
 * furthest that instruction travels is a prompt the user sees, with the exact command in
 * it, which they can decline.
 */
const proposeLabActionTool: FadiTool = {
  name: "propose_lab_action",
  risk: "external",
  effect: "Ask you to approve a change to the machine",
  description:
    "Propose a concrete change to the user's own machine — start, stop or remove a lab container — so they can approve it and it actually happens. Use when a project step needs a service running and the user has allowed container access. Recipes: container.run (params: image, name, optional port), container.stop (name), container.remove (name). Images are a fixed set: nginx, postgres, redis, grafana, portainer. This NEVER runs anything by itself; it puts the exact command in front of the user for approval. Tell them to check Machine access in Learning.",
  parameters: {
    type: "object",
    properties: {
      recipe: {
        type: "string",
        enum: ["container.run", "container.stop", "container.remove"],
        description: "Which catalogued action.",
      },
      image: {
        type: "string",
        enum: ["nginx", "postgres", "redis", "grafana", "portainer"],
        description: "For container.run: which image, by key.",
      },
      name: {
        type: "string",
        description:
          'Short lowercase name for the container, e.g. "web". Fadi prefixes it with fadi-.',
      },
      port: { type: "number", description: "Optional port to publish, 1024-65535." },
    },
    required: ["recipe", "name"],
  },
  async execute(args, ctx): Promise<ConsequentialResult> {
    const { proposeAction } = await import("@/lib/lab/broker");
    const surface = ctx.surface ?? "chat";
    const result = await proposeAction({
      userId: ctx.userId,
      recipe: typeof args.recipe === "string" ? args.recipe : "",
      // Passed through as-is. The broker validates; a tool that pre-cleaned parameters
      // would be a second place where "what is allowed" is decided, and the two would
      // drift.
      params: { image: args.image, name: args.name, port: args.port },
      actor: surface === "mcp" ? "mcp" : surface === "agent" ? "agent" : "model",
      origin: "tool:propose_lab_action",
    });

    if (!result.ok) return { summary: result.message, view: "none", outcome: "failed" };

    return {
      outcome: "performed",
      // Said as a request, not as an accomplishment. A model reporting "I started nginx"
      // when it has only queued a question would be lying about the user's own machine.
      summary:
        "I've asked for your approval to do this — nothing has run yet. " +
        result.summary +
        " The command is: " +
        result.argv.map((a) => a.join(" ")).join(" && ") +
        ". Approve it under Machine access in Learning" +
        (result.reversal ? ". To undo afterwards: " + result.reversal : "."),
      view: "none",
      data: { requestId: result.requestId, argv: result.argv },
    };
  },
};

/**
 * WHERE COULD THIS LAB RUN?
 *
 * Read-only, and it answers with the machines the person actually owns rather than with
 * advice. The three-way answer matters: a host that fits, a host nobody has measured, and a
 * host that is ruled out with a reason. An unmeasured machine reported as "fine" is how a
 * plan becomes a wasted evening.
 */
const labCapacityTool: FadiTool = {
  name: "lab_capacity",
  risk: "external",
  effect: "Check what the machine could host",
  description:
    "List the lab machines Fadi can build (Windows Server, Windows 11, Ubuntu, nginx, Postgres) and say which of the user's own machines could host each. Use before suggesting a lab, and whenever the user asks what they can run. Reports 'not enough recorded to tell' for machines nobody has measured rather than guessing.",
  parameters: { type: "object", properties: {} },
  async execute(_args, ctx): Promise<ConsequentialResult> {
    const { LAB_TEMPLATES, specForTemplate } = await import("@/lib/lab/templates");
    const { placeLab } = await import("@/lib/lab/capability");
    const { createLabResourcesRepository } = await import("@careeros/database");
    const { getDatabase } = await import("@/lib/database/client");

    const rows = await createLabResourcesRepository(getDatabase()).listForUser(ctx.userId);
    const resources = rows.map((r) => ({
      id: r.id,
      label: r.label,
      kind: r.kind,
      arch: r.arch as "x86_64" | "arm64" | "mcu",
      memoryMb: r.memoryMb,
      diskGb: r.diskGb,
      virtualization: r.virtualization as "none" | "containers" | "vms" | "nested",
      alwaysOn: r.alwaysOn,
    }));

    if (resources.length === 0) {
      return {
        summary:
          "Fadi doesn't know what machines you have yet, so it can't say where anything would run. Ask them to add one under Learning → the lab panel, or let Fadi detect this machine.",
        view: "none",
        outcome: "needs_input",
      };
    }

    const lines: string[] = [];
    for (const [key, template] of Object.entries(LAB_TEMPLATES)) {
      const plan = placeLab(specForTemplate(key as keyof typeof LAB_TEMPLATES), resources);
      const fits = plan.fits.map((f) => f.label);
      const maybe = plan.unverified.map((u) => u.resource.label);
      lines.push(
        key +
          " (" +
          template.label +
          "): " +
          (fits.length ? "runs on " + fits.join(", ") : "nothing you have fits it") +
          (maybe.length ? "; unmeasured: " + maybe.join(", ") : "")
      );
    }

    return {
      outcome: "performed",
      summary: lines.join("\n"),
      view: "none",
      data: { templates: Object.keys(LAB_TEMPLATES) },
    };
  },
};

/**
 * START AN OPERATING SYSTEM FOR A LAB.
 *
 * Windows here is a real VM — dockur is QEMU wearing a container — so it is slow to install
 * and heavy to run, and the tool says so rather than letting a model promise a desktop in a
 * minute. Linux templates are ordinary containers and up in seconds.
 *
 * A KEY, never an image. The model choosing the image is the model choosing what code runs
 * on someone's laptop.
 */
const startLabMachineTool: FadiTool = {
  name: "start_lab_machine",
  risk: "external",
  effect: "Ask you to approve starting a machine",
  description:
    "Propose starting a lab operating system on the user's machine: windows-server-2025 or windows-11 (real VMs via dockur — several GB to download and 20+ minutes to install before usable), or linux-ubuntu, linux-web, linux-postgres (ordinary containers, ready in seconds). Use when a project needs a whole OS rather than a service. Prefer Linux when the project allows it. This NEVER starts anything by itself; it puts the exact command in front of the user for approval.",
  parameters: {
    type: "object",
    properties: {
      template: {
        type: "string",
        enum: ["windows-server-2025", "windows-11", "linux-ubuntu", "linux-web", "linux-postgres"],
        description: "Which machine to start.",
      },
      name: {
        type: "string",
        description: 'Short lowercase name, e.g. "dc01". Fadi prefixes it with fadi-.',
      },
      runId: {
        type: "string",
        description: "Project run id when this machine supports an existing learning project.",
      },
      stepId: {
        type: "string",
        description: "Current project step id, when known.",
      },
    },
    required: ["template", "name"],
  },
  async execute(args, ctx): Promise<ConsequentialResult> {
    return proposeThrough(
      ctx,
      "lab.start",
      { template: args.template, name: args.name },
      {
        runId: typeof args.runId === "string" ? args.runId : null,
        stepId: typeof args.stepId === "string" ? args.stepId : null,
      }
    );
  },
};

/**
 * BUILD AN IMAGE FOR THIS PROJECT.
 *
 * Intent in, Dockerfile out. The model names a base and packages from a closed vocabulary;
 * deterministic code writes the file. A refused package is named, and the alternative — the
 * person writing the Dockerfile themselves — is offered rather than hidden.
 */
const buildLabImageTool: FadiTool = {
  name: "build_lab_image",
  risk: "external",
  effect: "Ask you to approve an image build",
  description:
    "Propose building a Linux lab image with specific tools installed, when no stock template fits the project. Fadi writes the Dockerfile itself from a vetted vocabulary and puts it in the user's workspace; it cannot install packages outside that list. Use when a project needs a particular combination of tools. This NEVER builds anything by itself.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: 'Short lowercase name for the image, e.g. "ad-lab".' },
      base: {
        type: "string",
        enum: ["ubuntu-24.04", "debian-12", "alpine-3.20", "python-3.12", "node-22"],
        description: "Which base to start from.",
      },
      packages: {
        type: "array",
        items: { type: "string" },
        description:
          "Packages to install, by their ordinary names (nginx, openssh-server, tcpdump, ansible, postgresql-client...). Anything outside Fadi's vetted list is refused and named.",
      },
      ports: {
        type: "array",
        items: { type: "number" },
        description: "Ports to expose, 1024-65535.",
      },
    },
    required: ["name", "base"],
  },
  async execute(args, ctx): Promise<ConsequentialResult> {
    return proposeThrough(ctx, "lab.build", {
      name: args.name,
      base: args.base,
      packages: args.packages,
      ports: args.ports,
    });
  },
};

/**
 * One proposal path for every lab tool, so none of them can drift into running something.
 *
 * Reports the request as a REQUEST. A model that says "I started Windows Server" when it has
 * only queued a question has told the user something false about their own machine.
 */
async function proposeThrough(
  ctx: FadiToolContext,
  recipe: string,
  params: Record<string, unknown>,
  project: { runId?: string | null; stepId?: string | null } = {}
): Promise<ConsequentialResult> {
  const { proposeAction } = await import("@/lib/lab/broker");
  const surface = ctx.surface ?? "chat";
  let runId: string | null = null;
  let stepId: string | null = null;
  if (project.runId) {
    const { createProjectRunsRepository } = await import("@careeros/database");
    const { getDatabase } = await import("@/lib/database/client");
    const detail = await createProjectRunsRepository(getDatabase()).getWithSteps(
      ctx.userId,
      project.runId
    );
    if (!detail) {
      return {
        summary: "That project is not available in this account. Nothing was proposed.",
        view: "none",
        outcome: "refused",
      };
    }
    const requestedStep = project.stepId
      ? detail.steps.find((candidate) => candidate.id === project.stepId)
      : detail.steps.find((candidate) => candidate.status === "pending");
    if (project.stepId && !requestedStep) {
      return {
        summary: "That step does not belong to this project. Nothing was proposed.",
        view: "none",
        outcome: "refused",
      };
    }
    runId = detail.run.id;
    stepId = requestedStep?.id ?? null;

    // A model starting a container for a project must start it where the project runs. If the
    // project is placed on a machine Fadi can't reach, or a VMware guest, a local container would
    // be the "named one machine, used another" failure (A07) — so the tool refuses instead.
    if (recipe === "lab.start" || recipe === "lab.build" || recipe === "lab.buildFile") {
      const { createLabResourcesRepository } = await import("@careeros/database");
      const { resolveTarget, unconnectedMessage } = await import("@/lib/lab/target");
      const resource = detail.run.resourceId
        ? await createLabResourcesRepository(getDatabase()).get(ctx.userId, detail.run.resourceId)
        : null;
      const target = resolveTarget(
        detail.run,
        resource ? { id: resource.id, label: resource.label, endpoint: resource.endpoint } : null
      );
      if (target.kind === "unconnected")
        return { summary: unconnectedMessage(target), view: "none", outcome: "refused" };
      if (target.kind !== "local-docker") {
        return {
          summary: `This project runs on the VMware machine ${target.label}, not in a local container. Nothing was proposed.`,
          view: "none",
          outcome: "refused",
        };
      }
    }
  }
  const result = await proposeAction({
    userId: ctx.userId,
    recipe,
    params,
    actor: surface === "mcp" ? "mcp" : surface === "agent" ? "agent" : "model",
    origin: "tool:" + recipe,
    runId,
    stepId,
  });

  if (!result.ok) return { summary: result.message, view: "none", outcome: "failed" };

  return {
    // Asking is the whole job of these tools, so asking IS the performance. What it must never
    // claim is that anything ran.
    outcome: "performed",
    summary:
      "I've asked for your approval — nothing has run yet. " +
      result.summary +
      "\n\nCommand: " +
      result.argv.map((a) => a.join(" ")).join(" && ") +
      (result.preflight.length
        ? "\n\nBefore you decide: " + result.preflight.map((n) => n.text).join(" ")
        : "") +
      "\n\nApprove it under Machine access in Learning.",
    view: "none",
    data: {
      requestId: result.requestId,
      runId,
      stepId,
      argv: result.argv,
      preflight: result.preflight,
    },
  };
}

const projectStatusTool: FadiTool = {
  name: "project_status",
  risk: "read",
  description:
    "Read where the user is in their in-progress projects: which step is next, what it asks, and how to verify it. Use when they ask 'what's next', 'where was I', 'what should I do now', or before advising on a project they have already started — so the advice continues their plan instead of restarting it.",
  parameters: { type: "object", properties: {} },
  async execute(_args, ctx): Promise<FadiToolResult> {
    const { createProjectRunsRepository } = await import("@careeros/database");
    const { getDatabase } = await import("@/lib/database/client");
    const repo = createProjectRunsRepository(getDatabase());
    // The active direction's projects only — the same scope the Learning hub shows.
    const { createCareerProfilesRepository } = await import("@careeros/database");
    const track = await createCareerProfilesRepository(getDatabase()).getActiveForUser(ctx.userId);
    const runs = (await repo.listForUser(ctx.userId)).filter(
      (r) => r.status === "running" && (r.careerProfileId ?? null) === (track?.id ?? null)
    );
    if (runs.length === 0) {
      return {
        summary: "No project is in progress. plan_project turns an idea into steps.",
        view: "none",
      };
    }
    const lines: string[] = [];
    for (const run of runs.slice(0, 3)) {
      const detail = await repo.getWithSteps(ctx.userId, run.id);
      if (!detail) continue;
      const done = detail.steps.filter((s) => s.status === "done").length;
      const next = detail.steps.find((s) => s.status === "pending");
      lines.push(
        `${run.title} — ${done}/${detail.steps.length} done${run.resourceLabel ? ` on ${run.resourceLabel}` : ""}.` +
          (next
            ? `\n  Next: ${next.title}. ${next.instruction}${next.verify ? `\n  Worked when: ${next.verify}` : ""}`
            : "\n  All steps done — it can be finished.")
      );
    }
    const projects = [];
    for (const run of runs.slice(0, 3)) {
      const detail = await repo.getWithSteps(ctx.userId, run.id);
      if (!detail) continue;
      const next = detail.steps.find((step) => step.status === "pending");
      projects.push({
        runId: run.id,
        title: run.title,
        stepId: next?.id ?? null,
        nextStep: next?.title ?? null,
      });
    }
    return { summary: lines.join("\n\n"), view: "none", data: { projects } };
  },
};

const completeProjectStepTool: FadiTool = {
  name: "complete_project_step",
  risk: "write",
  effect: "Mark a project step done",
  description:
    "Mark the user's current project step as done, recording what it produced (a file, a repo, a screenshot). Use when they say they finished a step or show you the result. Recording what was produced is what later turns the project into evidence — never mark a step done without asking what it left behind.",
  parameters: {
    type: "object",
    properties: {
      stepId: { type: "string", description: "The step's id, from project_status." },
      artifact: {
        type: "string",
        description:
          "What the step produced — a path, a repo URL, or a short description of the result.",
      },
    },
    required: ["stepId"],
  },
  async execute(args, ctx): Promise<ConsequentialResult> {
    const stepId = typeof args.stepId === "string" ? args.stepId : "";
    const { createProjectRunsRepository } = await import("@careeros/database");
    const { getDatabase } = await import("@/lib/database/client");
    const updated = await createProjectRunsRepository(getDatabase()).setStepStatus(
      ctx.userId,
      stepId,
      {
        status: "done",
        artifact: typeof args.artifact === "string" ? args.artifact : null,
      }
    );
    if (!updated)
      return { summary: "I can't find that step.", view: "none", outcome: "needs_input" };
    return {
      outcome: "performed",
      summary: `Marked "${updated.title}" done.${updated.artifact ? ` Recorded: ${updated.artifact}` : ""}`,
      view: "none",
    };
  },
};

const getMomentumReflectionTool: FadiTool = {
  name: "get_momentum_reflection",
  risk: "read",
  description:
    "Give an honest 'how am I really doing' read: how this week compares to the user's OWN past weeks (never other people), plus a morale-aware single next step. Use for 'am I improving', 'how am I really doing', or when they sound discouraged or stuck.",
  parameters: { type: "object", properties: {} },
  async execute(_args, ctx): Promise<FadiToolResult> {
    const ref = await getMomentumReflection(ctx.userId);
    return {
      summary: `${ref.pastSelf.line} ${ref.morale.line} Your one next step: ${ref.morale.nextStep}`,
      view: "none",
      data: ref,
    };
  },
};

const prepInterviewTool: FadiTool = {
  name: "prep_interview",
  risk: "read",
  description:
    "Prepare the user for a behavioral interview for a SPECIFIC job: infer the likely STAR questions from the job description and answer each from their REAL LinkedIn/career history. Use when they paste a JD and ask to 'prep me', 'interview prep', 'what will they ask', 'help me practice for this role'.",
  parameters: {
    type: "object",
    properties: {
      jobDescription: { type: "string", description: "The job description to prep against." },
      jobTitle: { type: "string", description: "Role title, if known." },
      company: { type: "string", description: "Company, if known." },
    },
    required: ["jobDescription"],
  },
  async execute(args, ctx): Promise<FadiToolResult> {
    const res = await prepareInterviewForJob(ctx.userId, {
      jobDescription: typeof args.jobDescription === "string" ? args.jobDescription : "",
      jobTitle: typeof args.jobTitle === "string" ? args.jobTitle : undefined,
      company: typeof args.company === "string" ? args.company : undefined,
    });
    if (!res.ok) return { summary: res.message, view: "none" };
    const body = res.prep.questions.slice(0, 4).map(formatPrepQuestion).join("\n\n");
    return {
      summary: `Likely questions for this role, answered from your real experience:\n\n${body}\n\nDeliver them in your own words — they're your stories, shaped to this job.`,
      view: "none",
      data: { questions: res.prep.questions },
    };
  },
};

const mockQuestionsTool: FadiTool = {
  name: "mock_interview_questions",
  risk: "read",
  description:
    "Generate a realistic mock-interview question set tailored to a role, seniority, and country's interview norms (and an optional job description). Use for 'give me mock interview questions', 'interview me for X', 'practice interview'. Defaults role/country/seniority from the user's active direction if not given.",
  parameters: {
    type: "object",
    properties: {
      role: {
        type: "string",
        description: "Role to interview for (defaults to the active direction).",
      },
      country: { type: "string", description: "Country/region for interview norms." },
      seniority: { type: "string", description: "Seniority level." },
      jobDescription: {
        type: "string",
        description: "Optional job description to tailor against.",
      },
    },
  },
  async execute(args, ctx): Promise<FadiToolResult> {
    const profile = await getDashboardProfileSummary(ctx.userId);
    const role = (typeof args.role === "string" && args.role.trim()) || profile?.targetRole || "";
    const res = await generateMockQuestions(ctx.userId, {
      role,
      country: typeof args.country === "string" ? args.country : profile?.locationPreference,
      seniority: typeof args.seniority === "string" ? args.seniority : profile?.experienceLevel,
      jobDescription: typeof args.jobDescription === "string" ? args.jobDescription : undefined,
    });
    if (!res.ok) return { summary: res.message, view: "none" };
    const list = res.questions.map((q, i) => `${i + 1}. ${q.question}`).join("\n");
    return {
      summary: `Mock interview for ${role || "your role"} — answer each out loud, then ask me to score it:\n${list}`,
      view: "none",
      data: { role, questions: res.questions },
    };
  },
};

const scoreAnswerTool: FadiTool = {
  name: "score_interview_answer",
  risk: "read",
  description:
    "Review an interview answer transcript: report transcript facts plus structure/specificity/relevance/concision when an AI provider is available, with improvements and a stronger version that reshapes ONLY what was said (never invents). Use after a practice answer.",
  parameters: {
    type: "object",
    properties: {
      question: { type: "string", description: "The interview question that was asked." },
      answer: {
        type: "string",
        description: "The user's answer (their spoken answer, transcribed, or typed).",
      },
      role: { type: "string", description: "The role, for relevance scoring." },
    },
    required: ["question", "answer"],
  },
  async execute(args, ctx): Promise<FadiToolResult> {
    const res = await scoreInterviewAnswer(ctx.userId, {
      question: typeof args.question === "string" ? args.question : "",
      answer: typeof args.answer === "string" ? args.answer : "",
      role: typeof args.role === "string" ? args.role : undefined,
    });
    if (!res.ok) return { summary: res.message, view: "none" };
    const s = res.score;
    const content =
      s.overall !== null && s.scores
        ? `Overall ${s.overall.toFixed(1)}/5 — structure ${s.scores.structure}, specifics ${s.scores.specificity}, relevance ${s.scores.relevance}, concision ${s.scores.concision}.`
        : "Content was not scored.";
    const head = `${content} ${s.transcriptNote}`;
    const fixes = s.improvements.length ? `\nTo improve: ${s.improvements.join("; ")}.` : "";
    const stronger = s.strongerVersion
      ? `\n\nStronger version (your content, tightened):\n${s.strongerVersion}`
      : "";
    return { summary: `${head}${fixes}${stronger}`, view: "none", data: { score: s } };
  },
};

const relevantEvidenceTool: FadiTool = {
  name: "get_relevant_evidence",
  risk: "read",
  description:
    "Return the user's strongest evidence (real roles, projects, achievements, skills) ranked for their ACTIVE career direction — the shared evidence pool framed for this path. Use for 'what's my best evidence for this direction', 'what should I highlight', or to ground a resume/answer. Grounded only in their real history.",
  parameters: { type: "object", properties: {} },
  async execute(_args, ctx): Promise<FadiToolResult> {
    const { track, ranked } = await rankedEvidenceForActiveTrack(ctx.userId);
    if (ranked.length === 0) {
      return {
        summary:
          "Your evidence pool is empty. Build it from your LinkedIn/résumé on the Evidence page, then I can frame it for any direction.",
        view: "none",
      };
    }
    const top = ranked
      .filter((r) => r.score > 0)
      .slice(0, 6)
      .map(
        (r) =>
          `• ${r.item.title}${r.item.organization ? ` (${r.item.organization})` : ""}${r.item.metrics ? ` — ${r.item.metrics}` : ""}`
      )
      .join("\n");
    const head = track
      ? `Your strongest evidence for ${track.role}:`
      : "Your evidence (set a direction to rank it):";
    return {
      summary: top
        ? `${head}\n${top}`
        : `${head}\nNothing in your pool maps cleanly to this direction yet — add evidence or tags that fit it.`,
      view: "none",
      data: { track, count: ranked.length },
    };
  },
};

const companyBriefTool: FadiTool = {
  name: "company_interview_brief",
  risk: "read",
  description:
    "Build an honest interview prep brief for a company: what they do, the role's focus, the industry's durable dynamics, smart questions to ASK the interviewer, and talking points connecting the user's REAL evidence to the role. Use for 'help me research <company>', 'prep me for my interview at <company>', 'what should I ask them'. Never fabricates recent news — it tells the user to verify live.",
  parameters: {
    type: "object",
    properties: {
      company: { type: "string", description: "The company the user is interviewing with." },
      role: { type: "string", description: "The role, if known." },
      jobDescription: { type: "string", description: "The job description, if available." },
    },
    required: ["company"],
  },
  async execute(args, ctx): Promise<FadiToolResult> {
    const res = await prepareCompanyBrief(ctx.userId, {
      company: typeof args.company === "string" ? args.company : "",
      role: typeof args.role === "string" ? args.role : undefined,
      jobDescription: typeof args.jobDescription === "string" ? args.jobDescription : undefined,
    });
    if (!res.ok) return { summary: res.message, view: "none" };
    return { summary: formatBrief(res.brief), view: "none", data: { brief: res.brief } };
  },
};

/**
 * The first step of applying, and the one people skip: is this posting still open?
 *
 * A read — it fetches a page Fadi was already given, changes nothing, and answers "unknown"
 * rather than guessing when the site will not say.
 */
const checkPostingOpen: FadiTool = {
  name: "check_posting_open",
  risk: "read",
  description:
    "Check whether a saved job posting is still open, by its job id. Use before tailoring anything for a role, and whenever the user asks if a posting is still live.",
  parameters: {
    type: "object",
    properties: { jobId: { type: "string", description: "The job's id in Fadi." } },
    required: ["jobId"],
  },
  async execute(args, ctx): Promise<FadiToolResult> {
    const jobId = typeof args.jobId === "string" ? args.jobId : "";
    if (!jobId) return { summary: "I need the job to check.", view: "none" };

    const { createJobsRepository } = await import("@careeros/database");
    const { getDatabase } = await import("@/lib/database/client");
    const job = await createJobsRepository(getDatabase()).findByIdForUser(ctx.userId, jobId);
    if (!job?.url) return { summary: "I can't find that posting to check.", view: "none" };

    const { checkPostingLiveness } = await import("@/lib/jobs/liveness");
    const liveness = await checkPostingLiveness(job.url);
    const said =
      liveness.state === "live"
        ? `Still open: ${job.title} at ${job.company}.`
        : liveness.state === "closed"
          ? `That one has closed — ${job.title} at ${job.company}. ${liveness.reason ?? ""}`.trim()
          : `The site won't say whether ${job.title} at ${job.company} is still open. ${liveness.reason ?? ""}`.trim();
    return { summary: said, view: "none", data: { state: liveness.state, url: job.url } };
  },
};

/**
 * Move the person to a page. The voice parser catches the common phrasings; this is for every
 * other way of asking, typed or spoken, so "can you pull the opportunities screen up" goes there
 * instead of being answered as a question. Only pages that exist can be reached.
 */
const openPageTool: FadiTool = {
  name: "open_page",
  risk: "read",
  description:
    "Take the user to a page of the app when they ask to go, navigate, open, show or switch to a place (e.g. Today, Opportunities, Practice, My career, Jobs, Applications, Learning, Interview practice, Documents, Evidence, Portfolio, Settings). Use this instead of describing the page's contents.",
  parameters: {
    type: "object",
    properties: {
      destination: { type: "string", description: "The page as the user named it." },
    },
    required: ["destination"],
  },
  async execute(args): Promise<FadiToolResult> {
    const { resolveDestination } = await import("@/lib/voice/commands");
    const spoken = typeof args.destination === "string" ? args.destination : "";
    const target = resolveDestination(spoken);
    if (!target) {
      return {
        summary: `There is no page called "${spoken}". Ask which page they meant.`,
        outcome: "needs_input",
        view: "none",
      };
    }
    return {
      summary: `Opening ${target.label}. Say only that you are opening it.`,
      data: target,
      view: "navigate",
      outcome: "performed",
    };
  },
};

const TOOLS: FadiTool[] = [
  openPageTool,
  searchJobs,
  getPerformance,
  getMomentumReflectionTool,
  getRejectionPatterns,
  prepInterviewTool,
  companyBriefTool,
  mockQuestionsTool,
  scoreAnswerTool,
  relevantEvidenceTool,
  draftReferralOutreachTool,
  answerBehavioralTool,
  scanCompanyJobsTool,
  planProjectTool,
  inspectMachineTool,
  proposeLabActionTool,
  labCapacityTool,
  startLabMachineTool,
  buildLabImageTool,
  projectStatusTool,
  completeProjectStepTool,
  evaluateFitTool,
  getCareerUpdates,
  generateDocument,
  trackApplication,
  getLaborMarket,
  getWorldShifts,
  createTrackTool,
  checkPostingOpen,
];

export function getFadiTools(): FadiTool[] {
  return TOOLS;
}

export function getFadiTool(name: string): FadiTool | undefined {
  return TOOLS.find((t) => t.name === name);
}

/**
 * Fadi's own capabilities plus the ones this person has connected.
 *
 * Built-ins are listed first and a connected tool can never take their name — it is namespaced
 * `<connection>.<tool>` — so nothing from outside can shadow `generate_document` and receive a
 * call that was meant for Fadi's own.
 */
export async function getToolsForUser(userId: string): Promise<FadiTool[]> {
  const { connectedToolsForUser } = await import("./connected");
  return [...TOOLS, ...(await connectedToolsForUser(userId))];
}

export async function executeFadiTool(
  name: string,
  args: Record<string, unknown>,
  ctx: FadiToolContext
): Promise<FadiToolResult> {
  const tool = getFadiTool(name);
  if (!tool) {
    return { summary: `Unknown tool "${name}".`, view: "none", isError: true };
  }
  // Every caller goes through here — chat, MCP, the background agent — so a capability that
  // changes something is receipted once, at the only door it can be reached through.
  return runWithReceipt(tool, args, ctx);
}
