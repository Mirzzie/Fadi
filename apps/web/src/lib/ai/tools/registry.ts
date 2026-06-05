import "server-only";

import { getRecommendedJobsForUser } from "@/lib/jobs/data";
import { parseLocation, getCountry } from "@/lib/jobs/locations";
import { getMomentumSummary } from "@/lib/resilience/service";
import { generateDocument } from "./generate-document";
import type { KaiTool, KaiToolContext, KaiToolResult } from "./types";

/**
 * Kai's tool registry. Each tool wraps a real CareerOS service so Kai can act on
 * live data and return something the chat can both speak and show. Add tools (and
 * external-source plugins) here — Kai picks them up automatically.
 */

const searchJobs: KaiTool = {
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
  async execute(args, ctx): Promise<KaiToolResult> {
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

const getPerformance: KaiTool = {
  name: "get_performance",
  description:
    "Get the user's career momentum and performance: momentum score, band, resting state, cadence adherence, and quality applications this period. Use for 'how am I doing', 'my performance', 'my progress'.",
  parameters: { type: "object", properties: {} },
  async execute(_args, ctx): Promise<KaiToolResult> {
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

const getCareerUpdates: KaiTool = {
  name: "get_career_updates",
  description:
    "Get what's new for the user: freshly matched roles. Use for 'what's new', 'any updates', 'what did you find'.",
  parameters: { type: "object", properties: {} },
  async execute(_args, ctx): Promise<KaiToolResult> {
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

const TOOLS: KaiTool[] = [searchJobs, getPerformance, getCareerUpdates, generateDocument];

export function getKaiTools(): KaiTool[] {
  return TOOLS;
}

export function getKaiTool(name: string): KaiTool | undefined {
  return TOOLS.find((t) => t.name === name);
}

export async function executeKaiTool(
  name: string,
  args: Record<string, unknown>,
  ctx: KaiToolContext,
): Promise<KaiToolResult> {
  const tool = getKaiTool(name);
  if (!tool) {
    return { summary: `Unknown tool "${name}".`, view: "none" };
  }
  return tool.execute(args, ctx);
}
