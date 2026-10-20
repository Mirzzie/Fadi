import "server-only";

import { createApplicationsRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import type { FadiTool, FadiToolContext, FadiToolResult } from "./types";

/**
 * Fadi ACTS: add a role to the user's application tracker. Approval-gated by the
 * conversation (the user asked for it) and never sends anything externally —
 * just records it as a "interested" application they can work in the tracker.
 */
export const trackApplication: FadiTool = {
  name: "track_application",
  description:
    "Add a job to the user's application tracker (records company, role, and optionally the job description). Use when the user says things like 'track this', 'add this job', 'I'm applying to X', or 'save this application'.",
  parameters: {
    type: "object",
    properties: {
      company: { type: "string", description: "The company name." },
      title: { type: "string", description: "The role / job title." },
      jobDescription: { type: "string", description: "The full job description, if available." },
    },
    required: ["company", "title"],
  },

  async execute(args, ctx: FadiToolContext): Promise<FadiToolResult> {
    const company = typeof args.company === "string" ? args.company.trim() : "";
    const title = typeof args.title === "string" ? args.title.trim() : "";
    if (!company || !title) {
      return { summary: "I need both a company and a role to add it to your tracker.", view: "none" };
    }
    const jobDescription =
      typeof args.jobDescription === "string" ? args.jobDescription.trim() : undefined;

    const app = await createApplicationsRepository(getDatabase()).createForUser(ctx.userId, {
      company,
      title,
      jobDescription: jobDescription || null,
      status: "interested",
    });

    return {
      summary: `Added "${title}" at ${company} to your application tracker (as Interested). Open Applications to draft a tailored resume for it.`,
      view: "application",
      data: { id: app.id, company, title },
    };
  },
};
