import "server-only";

import { generateCareerDocument, type DocKind } from "@/lib/documents/generate";
import type { ScoutTool, ScoutToolContext, ScoutToolResult } from "./types";

/**
 * Scout drafts a tailored career document and saves it — opening in the editor.
 * Delegates to the shared `generateCareerDocument` (same core the per-job
 * workspace buttons use). Honesty rule lives in those prompts.
 */
export const generateDocument: ScoutTool = {
  name: "generate_document",
  description:
    "Draft and save a tailored career document (resume/CV, cover letter, cold email, or value proposition) for a specific role/company, then open it in the editor. Use when the user asks to create, draft, write, generate, build or tailor any of these.",
  parameters: {
    type: "object",
    properties: {
      kind: {
        type: "string",
        enum: ["resume", "cover_letter", "email", "value_proposition"],
        description: "Which document to create.",
      },
      jobTitle: { type: "string", description: "Target role / job title." },
      company: { type: "string", description: "Target company, if known." },
    },
    required: ["kind"],
  },

  async execute(args, ctx: ScoutToolContext): Promise<ScoutToolResult> {
    if (!ctx.generate) {
      return { summary: "Document drafting isn't available this turn.", view: "none" };
    }
    const kind = (["resume", "cover_letter", "email", "value_proposition"].includes(String(args.kind))
      ? String(args.kind)
      : "resume") as DocKind;

    const doc = await generateCareerDocument(
      ctx.userId,
      {
        kind,
        jobTitle: typeof args.jobTitle === "string" ? args.jobTitle : undefined,
        company: typeof args.company === "string" ? args.company : undefined,
      },
      ctx.generate,
    );

    const label = kind === "resume" ? "tailored resume" : doc.title.split(" — ")[0].toLowerCase();
    return {
      summary: `I've drafted a ${label} grounded in your real experience. Open it to review and edit.`,
      view: "document",
      data: doc,
    };
  },
};
