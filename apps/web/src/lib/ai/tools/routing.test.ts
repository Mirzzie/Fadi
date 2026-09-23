import { describe, expect, it } from "vitest";

import { MAX_TOOLS_PER_TURN, toolsForTurn } from "./routing";

const all = [
  "search_jobs", "get_performance", "get_career_updates", "get_rejection_patterns",
  "draft_referral_outreach", "answer_behavioral_question", "scan_company_jobs", "evaluate_fit",
  "plan_project", "inspect_machine", "propose_lab_action", "lab_capacity", "start_lab_machine",
  "build_lab_image", "project_status", "complete_project_step", "get_momentum_reflection",
  "prep_interview", "mock_interview_questions", "score_interview_answer", "get_relevant_evidence",
  "company_interview_brief",
].map((name) => ({ name }));

const names = (turn: { pathname?: string; message?: string }) =>
  toolsForTurn(all, turn).map((t) => t.name);

describe("toolsForTurn", () => {
  it("sends the lab tools to someone standing in the lab", () => {
    const picked = names({ pathname: "/dashboard/learning/projects/abc", message: "what now?" });
    expect(picked).toContain("propose_lab_action");
    expect(picked).toContain("project_status");
    expect(picked).not.toContain("search_jobs");
  });

  it("does not offer lab machinery to someone editing their CV", () => {
    const picked = names({ pathname: "/dashboard/documents/abc", message: "tighten this" });
    expect(picked).not.toContain("start_lab_machine");
    expect(picked).not.toContain("build_lab_image");
    expect(picked).toContain("get_relevant_evidence");
  });

  it("follows what they typed, wherever they are", () => {
    const picked = names({ pathname: "/dashboard/portfolio", message: "any new jobs in Dublin?" });
    expect(picked).toContain("search_jobs");
  });

  it("always keeps the questions a person asks anywhere", () => {
    const picked = names({ pathname: "/dashboard/settings", message: "how am I doing?" });
    expect(picked).toContain("get_career_updates");
    expect(picked).toContain("get_performance");
  });

  it("never exceeds the per-turn ceiling", () => {
    const picked = names({
      pathname: "/dashboard/learning",
      message: "jobs interview cv lab project rejection referral company",
    });
    expect(picked.length).toBeLessThanOrEqual(MAX_TOOLS_PER_TURN);
  });

  it("falls back to everything when it knows nothing — better wide than stranded", () => {
    expect(names({}).length).toBe(all.length);
  });

  it("is a real reduction on an ordinary turn", () => {
    const picked = names({ pathname: "/dashboard/jobs", message: "show me something for Dublin" });
    expect(picked.length).toBeLessThan(all.length / 2);
  });
});
