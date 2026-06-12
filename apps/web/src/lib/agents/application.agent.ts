import type { AIProvider } from "@/lib/ai/providers/types";
import { formatScoutContextAsPrompt } from "@/lib/ai/context/builder";
import { HUMANIZE_CORE, HUMANIZE_PROSE, HUMANIZE_RESUME } from "@/lib/documents/humanize";

import type {
  AgentArtifact,
  AgentContext,
  AgentTask,
  AgentTool,
  AgentToolResult,
  ScoutAgent,
} from "./types";

// ─── Tools ────────────────────────────────────────────────────────────────────

const generateCVTool: AgentTool = {
  name: "generate_cv",
  description: "Generate a tailored CV/resume for this specific job role",
  params: [
    { name: "focus", type: "string", description: "What to emphasise for this role", required: false },
  ],
  async execute(_params, context): Promise<AgentToolResult> {
    return {
      success: true,
      output: "Tailored CV generated and added to your workspace.",
      artifact: {
        type: "cv",
        title: `Tailored CV — ${context.jobTitle ?? "Role"} at ${context.jobCompany ?? "Company"}`,
        content: "CV generation requires AI provider. Trigger via chat.",
        format: "markdown",
        jobId: context.jobId,
        version: 1,
      },
    };
  },
};

const generateCoverLetterTool: AgentTool = {
  name: "generate_cover_letter",
  description: "Generate a tailored cover letter for this specific job",
  params: [
    { name: "tone", type: "string", description: "Tone: formal | conversational | direct", required: false },
  ],
  async execute(_params, context): Promise<AgentToolResult> {
    return {
      success: true,
      output: "Cover letter generated and added to your workspace.",
      artifact: {
        type: "cover_letter",
        title: `Cover Letter — ${context.jobTitle ?? "Role"} at ${context.jobCompany ?? "Company"}`,
        content: "Cover letter generation requires AI provider. Trigger via chat.",
        format: "markdown",
        jobId: context.jobId,
        version: 1,
      },
    };
  },
};

const generateColdEmailTool: AgentTool = {
  name: "generate_cold_email",
  description: "Generate cold email templates for recruiter, hiring manager, or referral outreach",
  params: [
    { name: "target", type: "string", description: "Target: recruiter | hiring_manager | referral", required: true },
  ],
  async execute(params, context): Promise<AgentToolResult> {
    const target = (params.target as string) ?? "recruiter";
    return {
      success: true,
      output: `Cold email template for ${target} generated.`,
      artifact: {
        type: "cold_email",
        title: `Cold Email (${target}) — ${context.jobCompany ?? "Company"}`,
        content: "Cold email generation requires AI provider. Trigger via chat.",
        format: "markdown",
        jobId: context.jobId,
        version: 1,
        metadata: { target },
      },
    };
  },
};

const generateValuePropTool: AgentTool = {
  name: "generate_value_proposition",
  description: "Generate a value proposition document positioning you for this specific role",
  params: [],
  async execute(_params, context): Promise<AgentToolResult> {
    return {
      success: true,
      output: "Value proposition document generated.",
      artifact: {
        type: "value_proposition",
        title: `Value Proposition — ${context.jobTitle ?? "Role"}`,
        content: "Value proposition generation requires AI provider. Trigger via chat.",
        format: "markdown",
        jobId: context.jobId,
        version: 1,
      },
    };
  },
};

const generateInterviewPlanTool: AgentTool = {
  name: "generate_interview_plan",
  description: "Generate an interview preparation plan for this specific role and company",
  params: [
    { name: "rounds", type: "number", description: "Expected number of interview rounds", required: false },
  ],
  async execute(_params, context): Promise<AgentToolResult> {
    return {
      success: true,
      output: "Interview preparation plan generated.",
      artifact: {
        type: "interview_plan",
        title: `Interview Plan — ${context.jobTitle ?? "Role"} at ${context.jobCompany ?? "Company"}`,
        content: "Interview plan generation requires AI provider. Trigger via chat.",
        format: "markdown",
        jobId: context.jobId,
        version: 1,
      },
    };
  },
};

const researchCompanyTool: AgentTool = {
  name: "research_company",
  description: "Research the company, culture, recent news, and what they look for in candidates",
  params: [],
  async execute(_params, context): Promise<AgentToolResult> {
    return {
      success: true,
      output: `Company research for ${context.jobCompany ?? "the company"} initiated.`,
      artifact: {
        type: "company_research",
        title: `Company Research — ${context.jobCompany ?? "Company"}`,
        content: "Company research requires live data integration. Coming in Phase 3.",
        format: "markdown",
        jobId: context.jobId,
        version: 1,
      },
    };
  },
};

// ─── Agent ────────────────────────────────────────────────────────────────────

export class ApplicationAgent implements ScoutAgent {
  readonly type = "application" as const;
  readonly name = "Application Agent";
  readonly description =
    "Scoped to a single job application. Generates tailored CVs, cover letters, cold emails, value propositions, and interview plans. Each tool produces a reviewable document before anything is sent.";

  readonly tools: AgentTool[] = [
    generateCVTool,
    generateCoverLetterTool,
    generateColdEmailTool,
    generateValuePropTool,
    generateInterviewPlanTool,
    researchCompanyTool,
  ];

  buildSystemPrompt(context: AgentContext): string {
    const userContextBlock = formatScoutContextAsPrompt(context.userContext);

    return `You are Scout's Application Agent — a specialized sub-agent activated for a specific job application.

Your sole focus is helping the user prepare the strongest possible application for this role:

**Target role**: ${context.jobTitle ?? "Not specified"}
**Company**: ${context.jobCompany ?? "Not specified"}
**Job description**:
${context.jobDescription ?? "Not provided — ask the user to paste it."}

---

**User career context**:
${userContextBlock}

---

## Your capabilities
You can generate and iterate on:
- Tailored CV (highlighting what matters most for this specific role)
- Cover letter (matching the company tone and role requirements)
- Cold email templates (recruiter outreach, hiring manager, referral contact)
- Value proposition document (why you, why now, why this company)
- Interview preparation plan (likely questions, answers, STAR stories)
- Company research brief

## How you work
- Be specific to this role and company — no generic content
- Identify the gaps between the user's profile and the job requirements and address them
- Every document is a draft for the user's review — never claim it was sent
- If you need the job description to do better work, ask for it
- If salary, culture, or company data is unknown, say so — do not invent
- Be direct: if the user is underqualified for this role, say so constructively and help them anyway

## Tools
When the user asks to generate a document, call the appropriate tool and then produce the full document content in your response. The user reviews and approves before anything leaves CareerOS.

---

## How everything you write must read
${HUMANIZE_CORE}

For any prose document (cover letter, cold email, value proposition, outreach):
${HUMANIZE_PROSE}

For a CV/résumé:
${HUMANIZE_RESUME}`;
  }

  async *stream(
    task: AgentTask,
    provider: AIProvider,
  ): AsyncGenerator<{ delta: string; artifact?: AgentArtifact }> {
    const messages = [
      { role: "system" as const, content: this.buildSystemPrompt(task.context) },
      ...(task.conversationHistory ?? []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: task.input },
    ];

    const stream = provider.streamChat(messages, { temperature: 0.55 });
    const reader = stream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield { delta: value };
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export const applicationAgent = new ApplicationAgent();
