import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FadiToolContext } from "./types";

vi.mock("@/lib/interview/practice-session", async (actual) => ({
  // The real stop-phrase matcher; the session store itself is stubbed.
  isEndCommand: (await actual<typeof import("@/lib/interview/practice-session")>()).isEndCommand,
  getPracticeSession: vi.fn(),
  startPracticeSession: vi.fn(),
  answerPracticeSession: vi.fn(),
  endPracticeSession: vi.fn(),
}));
vi.mock("@/lib/career-report/data", () => ({
  getDashboardProfileSummary: vi.fn(async () => ({
    targetRole: "SRE",
    locationPreference: "Dublin",
    experienceLevel: "mid",
  })),
}));

import {
  answerPracticeSession,
  endPracticeSession,
  getPracticeSession,
  startPracticeSession,
} from "@/lib/interview/practice-session";

import { getFadiTool } from "./registry";

const live = vi.mocked(getPracticeSession);
const start = vi.mocked(startPracticeSession);
const answer = vi.mocked(answerPracticeSession);
const end = vi.mocked(endPracticeSession);

const tool = getFadiTool("interview_practice")!;
const ctx = (over: Partial<FadiToolContext> = {}): FadiToolContext => ({
  userId: "u1",
  surface: "agent",
  contextId: "c1",
  ...over,
});

describe("interview_practice tool", () => {
  beforeEach(() => {
    live.mockReset();
    start.mockReset();
    answer.mockReset();
    end.mockReset();
  });

  it("is registered as a read tool", () => {
    expect(tool.name).toBe("interview_practice");
    expect(tool.risk).toBe("read");
  });

  it("refuses without a conversation context", async () => {
    const r = await tool.execute({ role: "SRE" }, ctx({ contextId: null }));
    expect(r.summary).toMatch(/live conversation/i);
    expect(start).not.toHaveBeenCalled();
  });

  it("starts a session when none is live", async () => {
    live.mockResolvedValue(null);
    start.mockResolvedValue({ ok: true, question: "Tell me about yourself.", index: 0, total: 4 });
    const r = await tool.execute({ role: "Backend Engineer" }, ctx());
    expect(start).toHaveBeenCalledWith("u1", expect.objectContaining({ contextId: "c1", role: "Backend Engineer" }));
    expect(r.spoken).toContain("First question");
    expect((r.data as { interview: { state: string } }).interview.state).toBe("awaiting_answer");
  });

  it("treats input as an answer when a session is live", async () => {
    live.mockResolvedValue({ role: "SRE" } as never);
    answer.mockResolvedValue({
      ok: true,
      coaching: "Nice — concrete result.",
      nextQuestion: "Describe a hard incident.",
      done: false,
      index: 1,
      total: 4,
    });
    const r = await tool.execute({ answer: "I led the migration and cut costs 30%." }, ctx());
    expect(answer).toHaveBeenCalledWith("u1", { contextId: "c1", answer: "I led the migration and cut costs 30%." });
    expect(r.spoken).toContain("Next question");
    expect(start).not.toHaveBeenCalled();
  });

  it("ends on action=end", async () => {
    live.mockResolvedValue({ role: "SRE" } as never);
    end.mockResolvedValue({ ok: true, summary: "That's 3 answers for the SRE role. Nice work." });
    const r = await tool.execute({ action: "end" }, ctx());
    expect(end).toHaveBeenCalledWith("u1", "c1");
    expect((r.data as { interview: { state: string } }).interview.state).toBe("done");
  });

  it.each(["stop", "Done.", "back to buddy", "exit Fadi"])("ends a live session on exactly %j", async (said) => {
    live.mockResolvedValue({ role: "SRE" } as never);
    end.mockResolvedValue({ ok: true, summary: "That's 1 answer for the SRE role." });
    const r = await tool.execute({ answer: said }, ctx());
    expect(end).toHaveBeenCalledWith("u1", "c1");
    expect(answer).not.toHaveBeenCalled();
    expect((r.data as { interview: { state: string } }).interview.state).toBe("done");
  });

  it.each(["I'm done with that project now", "stop the bleed first", "finished it early"])(
    "answers %j instead of ending (a stop word inside an answer)",
    async (said) => {
      live.mockResolvedValue({ role: "SRE" } as never);
      answer.mockResolvedValue({
        ok: true,
        coaching: "Solid answer.",
        nextQuestion: "Why this role?",
        done: false,
        index: 1,
        total: 4,
      });
      await tool.execute({ answer: said }, ctx());
      expect(answer).toHaveBeenCalledWith("u1", { contextId: "c1", answer: said });
      expect(end).not.toHaveBeenCalled();
    }
  );
});
