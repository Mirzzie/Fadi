import type { AIProvider } from "@/lib/ai/providers/types";
import type { FadiUserContext } from "@/lib/ai/context/types";

// ─── Agent types ──────────────────────────────────────────────────────────────

export type AgentType =
  | "career_analysis"
  | "job_discovery"
  | "application"
  | "learning"
  | "market_intelligence"
  | "linkedin_profile"
  | "networking_events"
  | "document_generation"
  | "interview_prep"
  | "niche_discovery"
  | "hype_check";

// ─── Agent context ────────────────────────────────────────────────────────────

export interface AgentContext {
  userId: string;
  userContext: FadiUserContext;
  jobId?: string;
  jobTitle?: string;
  jobCompany?: string;
  jobDescription?: string;
  additionalContext?: Record<string, unknown>;
}

// ─── Tool contract ────────────────────────────────────────────────────────────

export interface AgentToolParam {
  name: string;
  type: "string" | "number" | "boolean";
  description: string;
  required?: boolean;
}

export interface AgentTool {
  name: string;
  description: string;
  params: AgentToolParam[];
  execute(params: Record<string, unknown>, context: AgentContext): Promise<AgentToolResult>;
}

export interface AgentToolResult {
  success: boolean;
  output: string;
  artifact?: AgentArtifact;
  error?: string;
}

// ─── Artifacts ────────────────────────────────────────────────────────────────

export type ArtifactType =
  | "cv"
  | "cover_letter"
  | "cold_email"
  | "value_proposition"
  | "interview_plan"
  | "company_research"
  | "market_report"
  | "learning_plan"
  | "niche_analysis"
  | "action_plan";

export interface AgentArtifact {
  type: ArtifactType;
  title: string;
  content: string;
  format: "markdown" | "plain";
  jobId?: string;
  version?: number;
  metadata?: Record<string, unknown>;
}

// ─── Task / Result ────────────────────────────────────────────────────────────

export interface AgentTask {
  id: string;
  type: AgentType;
  context: AgentContext;
  input: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface AgentResult {
  agentType: AgentType;
  content: string;
  artifacts: AgentArtifact[];
  pendingApprovals: PendingApproval[];
  suggestedNextActions: string[];
}

// ─── Approval gates ───────────────────────────────────────────────────────────

export type ApprovalActionType =
  | "send_application"
  | "send_email"
  | "update_linkedin"
  | "submit_form"
  | "share_document"
  | "schedule_meeting";

export interface PendingApproval {
  id: string;
  actionType: ApprovalActionType;
  description: string;
  previewContent?: string;
  targetPlatform?: string;
  isReversible: boolean;
}

// ─── Agent interface ──────────────────────────────────────────────────────────

export interface FadiAgent {
  readonly type: AgentType;
  readonly name: string;
  readonly description: string;
  readonly tools: AgentTool[];

  buildSystemPrompt(context: AgentContext): string;
  stream(
    task: AgentTask,
    provider: AIProvider,
  ): AsyncGenerator<{ delta: string; artifact?: AgentArtifact }>;
}

// ─── Orchestrator task (what Fadi decides to spawn) ────────────────────────────

export interface OrchestratorDecision {
  agentType: AgentType;
  reason: string;
  priority: "immediate" | "background" | "deferred";
  context: Partial<AgentContext>;
}
