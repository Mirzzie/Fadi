import "server-only";

import { getRecommendedJobsForUser } from "@/lib/jobs/data";
import { parseLocation, getCountry } from "@/lib/jobs/locations";
import { getMomentumReflection, getMomentumSummary, summarizeRejectionPatterns } from "@/lib/resilience/service";
import { answerBehavioral } from "@/lib/interview/story-bank";
import { fetchCompanyAtsJobs } from "@/lib/data-sources/ats-boards";
import { getCareerWeather } from "@/lib/intelligence/career-weather";
import { evaluateFit } from "@/lib/jobs/fit";
import { createTrackTool } from "./create-track";
import { generateDocument } from "./generate-document";
import { getLaborMarket } from "./labor-market";
import { getWorldShifts } from "./world-shifts";
import { trackApplication } from "./track-application";
import type { FadiTool, FadiToolContext, FadiToolResult } from "./types";

/**
 * Fadi's tool registry. Each tool wraps a real FadiOS service so Fadi can act on
 * live data and return something the chat can both speak and show. Add tools (and
 * external-source plugins) here — Fadi picks them up automatically.
 */

const searchJobs: FadiTool = {
  name: "search_jobs",
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
      limit: { type: "number", description: "How many roles to return (default 6, max 12)." },
    },
  },
  async execute(args, ctx): Promise<FadiToolResult> {
    const parsed = parseLocation(typeof args.location === "string" ? args.location : undefined);
    const limit = Math.min(Math.max(Number(args.limit) || 6, 1), 12);

    const jobs = await getRecommendedJobsForUser(ctx.userId, limit, {
      country: parsed.country,
      city: parsed.city,
    });

    const where = parsed.city
      ? `${parsed.city}${getCountry(parsed.country) ? `, ${getCountry(parsed.country)!.name}` : ""}`
      : getCountry(parsed.country)?.name ?? "your target market";

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
  description:
    "Add a referral target at a company and draft a short, sendable outreach message asking for a referral or warm intro. Use for 'help me get a referral at X', 'draft my message to someone at X', 'who should I ask at X'. A referral is worth ~40 cold applications. Company is required; role/contact are optional.",
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
  async execute(args, ctx): Promise<FadiToolResult> {
    const company = typeof args.company === "string" ? args.company.trim() : "";
    if (!company) {
      return { summary: "Which company do you want a referral into? Tell me and I'll set it up and draft the message.", view: "none" };
    }
    const opt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
    const rel = typeof args.relationship === "string" && (REFERRAL_RELATIONSHIPS as readonly string[]).includes(args.relationship)
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
      return { summary: "What behavioral question do you want to practice? Give me the prompt and I'll answer it from your real stories.", view: "none" };
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

const getCareerWeatherTool: FadiTool = {
  name: "get_career_weather",
  description:
    "Give the user a personalized 'career weather' read: what's moving in the world (structural shifts, the economy/inflation/rates, current affairs) and what it means for THEIR specific path — each with a controllable next move. Use for 'what's the outlook for my field', 'should I worry about the economy', 'what's happening in the world that affects my career'.",
  parameters: { type: "object", properties: {} },
  async execute(_args, ctx): Promise<FadiToolResult> {
    const w = await getCareerWeather(ctx.userId);
    const all = [...w.forces, ...w.macro, ...w.currentAffairs];
    if (all.length === 0) {
      return { summary: "Set a career direction and I'll read the world's signals against your path.", view: "none" };
    }
    const top = all
      .slice(0, 5)
      .map((c) => `• ${c.title} → your move: ${c.move}`)
      .join("\n");
    const macroNote = w.macroAvailable ? "" : " (live inflation/rates aren't connected — add a free FRED key to light up the money axis.)";
    return {
      summary: `Career weather for ${w.track.targetRole ?? "your path"}:\n${top}\n\nThat's positioning information, not doom — each one has a move you control.${macroNote}`,
      view: "none",
      data: { track: w.track, forces: w.forces.length, macro: w.macro.length, news: w.currentAffairs.length },
    };
  },
};

const evaluateFitTool: FadiTool = {
  name: "evaluate_fit",
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
    const reasons = e.topReasons.slice(0, 3).map((r) => `• ${r}`).join("\n");
    const gaps = e.gapsToClose.length > 0 ? `\nTo close the gap: ${e.gapsToClose.slice(0, 3).join("; ")}.` : "";
    return {
      summary: `Fit: ${e.overall.toFixed(1)}/5 — ${e.verdict.toUpperCase()}.\n${e.verdictReason}\n${reasons}${gaps}`,
      view: "none",
      data: { overall: e.overall, verdict: e.verdict, dimensions: e.dimensions },
    };
  },
};

const getMomentumReflectionTool: FadiTool = {
  name: "get_momentum_reflection",
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

const TOOLS: FadiTool[] = [
  searchJobs,
  getPerformance,
  getMomentumReflectionTool,
  getRejectionPatterns,
  draftReferralOutreachTool,
  answerBehavioralTool,
  scanCompanyJobsTool,
  getCareerWeatherTool,
  evaluateFitTool,
  getCareerUpdates,
  generateDocument,
  trackApplication,
  getLaborMarket,
  getWorldShifts,
  createTrackTool,
];

export function getFadiTools(): FadiTool[] {
  return TOOLS;
}

export function getFadiTool(name: string): FadiTool | undefined {
  return TOOLS.find((t) => t.name === name);
}

export async function executeFadiTool(
  name: string,
  args: Record<string, unknown>,
  ctx: FadiToolContext,
): Promise<FadiToolResult> {
  const tool = getFadiTool(name);
  if (!tool) {
    return { summary: `Unknown tool "${name}".`, view: "none" };
  }
  return tool.execute(args, ctx);
}
