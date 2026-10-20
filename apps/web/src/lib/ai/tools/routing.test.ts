import { describe, expect, it } from "vitest";

import { MAX_TOOLS_PER_TURN, toolsForTurn } from "./routing";

const all = [
  "search_jobs",
  "get_performance",
  "get_career_updates",
  "get_rejection_patterns",
  "draft_referral_outreach",
  "answer_behavioral_question",
  "scan_company_jobs",
  "evaluate_fit",
  "plan_project",
  "inspect_machine",
  "propose_lab_action",
  "lab_capacity",
  "start_lab_machine",
  "build_lab_image",
  "project_status",
  "complete_project_step",
  "get_momentum_reflection",
  "prep_interview",
  "mock_interview_questions",
  "score_interview_answer",
  "get_relevant_evidence",
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

describe("changes said in plain words reach their tool", () => {
  const all = [
    "track_application",
    "generate_document",
    "create_career_track",
    "search_jobs",
    "evaluate_fit",
    "get_career_updates",
  ].map((name) => ({ name }));
  const names = (message: string) =>
    toolsForTurn(all, { pathname: null, message }).map((t) => t.name);

  it("offers track_application when someone says they applied", () => {
    expect(names("log that I applied to Stripe for a Junior Security Engineer role")).toContain(
      "track_application"
    );
    expect(names("mark the Deerfoot job as applied")).toContain("track_application");
  });

  it("offers generate_document and create_career_track for their phrasings", () => {
    expect(names("draft a cover letter for the Stripe role")).toContain("generate_document");
    expect(names("create a new direction for cloud security")).toContain("create_career_track");
  });

  it("does not offer a change for a question", () => {
    expect(names("how is my job search going")).not.toContain("track_application");
  });
});

describe("the everyday asks reach their tool", () => {
  const all = [
    "save_job",
    "unsave_job",
    "set_application_status",
    "track_application",
    "today_brief",
    "project_status",
    "list_documents",
    "read_document",
    "add_experience",
    "list_flagships",
    "take_on_flagship",
    "get_career_updates",
  ].map((name) => ({ name }));
  const names = (message: string) =>
    toolsForTurn(all, { pathname: null, message }).map((t) => t.name);

  it.each([
    ["save the Deerfoot role", "save_job"],
    ["I'm not interested in the Acme job any more", "unsave_job"],
    ["I got an interview with Stripe", "set_application_status"],
    ["Acme rejected me", "set_application_status"],
    ["mark the Deerfoot application as applied", "set_application_status"],
    ["what should I do today", "today_brief"],
    ["what's my next step", "project_status"],
    ["which CVs have I made", "list_documents"],
    ["read me my Stripe cover letter", "read_document"],
    ["I passed Security+, add it to my record", "add_experience"],
    ["what are my flagships", "list_flagships"],
    ["take on the detection flagship", "take_on_flagship"],
  ])("%s → %s", (message, tool) => {
    expect(names(message)).toContain(tool);
  });

  it("does not offer changes for a plain question", () => {
    const picked = names("how am I doing?");
    expect(picked).not.toContain("save_job");
    expect(picked).not.toContain("set_application_status");
    expect(picked).not.toContain("add_experience");
  });
});
