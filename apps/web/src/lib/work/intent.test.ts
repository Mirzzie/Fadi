import { describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({ jobs: [] as Array<Record<string, unknown>> }));
vi.mock("@/lib/database/client", () => ({ getDatabase: () => ({}) }));
vi.mock("@careeros/database", () => ({
  createJobsRepository: () => ({ listActiveForUser: async () => holder.jobs }),
}));

const { resolveIntent } = await import("./intent");

const JOBS = [
  { id: "job-1", title: "Contract IS Technical Support Analyst", company: "Deerfoot", location: "Dublin" },
  { id: "job-2", title: "Application Security Engineer", company: "Intercom", location: "Dublin" },
];

describe("turning a line into work", () => {
  it("starts an apply plan when it can name the role", async () => {
    holder.jobs = JOBS;
    const intent = await resolveIntent("u", "apply to the Deerfoot role");

    expect(intent.kind).toBe("plan");
    expect(intent.kind === "plan" && intent.refs).toEqual([{ type: "job", id: "job-1" }]);
    expect(intent.kind === "plan" && intent.label).toBe(
      "Apply to Deerfoot — Contract IS Technical Support Analyst"
    );
  });

  it("picks the role the words actually point at", async () => {
    holder.jobs = JOBS;
    const intent = await resolveIntent("u", "apply for the Intercom security engineer job");
    expect(intent.kind === "plan" && intent.refs[0]!.id).toBe("job-2");
  });

  /**
   * The failure that matters: guessing. An intent bar that starts tailoring a CV for the wrong
   * posting has spent the person's AI allowance and their trust in one press.
   */
  it("offers nothing rather than guessing", async () => {
    holder.jobs = JOBS;
    expect((await resolveIntent("u", "apply to the Google role")).kind).toBe("none");
    expect((await resolveIntent("u", "apply to something")).kind).toBe("none");

    holder.jobs = [];
    expect((await resolveIntent("u", "apply to Deerfoot")).kind).toBe("none");
  });

  it("leaves questions alone", async () => {
    holder.jobs = JOBS;
    for (const question of [
      "how am I doing?",
      "what should I learn next",
      "show me Deerfoot",
      "is the Deerfoot role still open",
    ]) {
      expect((await resolveIntent("u", question)).kind, question).toBe("none");
    }
  });
});
