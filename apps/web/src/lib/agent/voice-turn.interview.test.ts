import { beforeEach, describe, expect, it, vi } from "vitest";

import { getKv } from "@/lib/kv/store";
import type { AnswerScore, MockQuestion } from "@/lib/interview/mock";

// No provider, model or database: scoring and question drafting are stubbed, and anything that
// would reach a provider is a spy the tests assert on.
vi.mock("@/lib/interview/mock", () => ({
  generateMockQuestions: vi.fn(),
  scoreInterviewAnswer: vi.fn(),
}));
vi.mock("@/lib/ai/context/builder", () => ({ buildFadiContext: vi.fn(async () => null) }));
vi.mock("@/lib/ai/registry", () => ({ buildProviderChain: vi.fn(() => []) }));
vi.mock("@/lib/ai/user-generate", () => ({ getUserDocGenerate: vi.fn(async () => null) }));
vi.mock("@/lib/ai/user-settings", () => ({ getUserProviderConfigs: vi.fn(async () => []) }));

import { buildFadiContext } from "@/lib/ai/context/builder";
import { buildProviderChain } from "@/lib/ai/registry";
import { getUserDocGenerate } from "@/lib/ai/user-generate";
import { generateMockQuestions, scoreInterviewAnswer } from "@/lib/interview/mock";
import { getPracticeSession, startPracticeSession } from "@/lib/interview/practice-session";

import { runVoiceTurn } from "./voice-turn";

const gen = vi.mocked(generateMockQuestions);
const score = vi.mocked(scoreInterviewAnswer);
const context = vi.mocked(buildFadiContext);
const chain = vi.mocked(buildProviderChain);
const docGenerate = vi.mocked(getUserDocGenerate);

const QUESTIONS: MockQuestion[] = [
  { question: "Tell me about yourself.", kind: "opener" },
  { question: "Describe a time you owned a hard project.", kind: "behavioral" },
  { question: "Why this role?", kind: "role" },
];

function answerScore(over: Partial<AnswerScore> = {}): AnswerScore {
  return {
    transcript: { wordCount: 60, fillerCount: 0, fillerWords: [] },
    transcriptNote: "60 words",
    scores: { structure: 3, specificity: 3, relevance: 4, concision: 3 },
    overall: 3.3,
    strengths: ["You gave a concrete result"],
    improvements: ["Open with the situation"],
    strongerVersion: "…",
    ...over,
  };
}

let n = 0;
/** A fresh owner + conversation with an interview already on question one. */
async function live(questions = QUESTIONS) {
  n += 1;
  const userId = `user-${n}`;
  const contextId = `ctx-${n}`;
  gen.mockResolvedValueOnce({ ok: true, questions });
  await startPracticeSession(userId, { contextId, role: "Backend Engineer" });
  return { userId, contextId };
}

describe("runVoiceTurn — live interview", () => {
  beforeEach(() => {
    gen.mockReset();
    score.mockReset();
    score.mockResolvedValue({ ok: true, score: answerScore() });
    context.mockClear();
    chain.mockClear();
    docGenerate.mockClear();
  });

  it("coaches the answer and asks the next question, without writing the answer to history", async () => {
    const { userId, contextId } = await live();
    const secret = "At Acme I handled the payroll breach for employee 4471 quietly";
    const turn = await runVoiceTurn(userId, { text: secret, contextId });

    expect(turn.interview).toMatchObject({ state: "awaiting_answer", index: 1, total: 3 });
    expect(turn.speech).toContain("concrete result");
    expect(turn.speech).toContain(QUESTIONS[1].question);
    expect(score).toHaveBeenCalledWith(userId, expect.objectContaining({ answer: secret }));
    // Neither the 30-minute conversation history nor the session holds the answer.
    const history = await getKv().get(`voice:ctx:${userId}:${contextId}`);
    expect(history ?? "").not.toContain(secret);
    expect(history ?? "").not.toContain("payroll");
    expect(await getKv().get(`interview:${userId}:${contextId}`)).not.toContain(secret);
    // No general agent turn ran for it.
    expect(context).not.toHaveBeenCalled();
    expect(chain).not.toHaveBeenCalled();
  });

  it("takes a long answer whole, up to 4096 characters", async () => {
    const { userId, contextId } = await live();
    const answer = "I led the migration of our billing system. ".repeat(100).slice(0, 4095) + "!";
    expect(answer.length).toBe(4096);
    const turn = await runVoiceTurn(userId, { text: answer, contextId });
    expect(score).toHaveBeenCalledWith(userId, expect.objectContaining({ answer }));
    expect(turn.interview?.index).toBe(1);
  });

  it("rejects an answer over 4096 characters clearly, without scoring or advancing", async () => {
    const { userId, contextId } = await live();
    const turn = await runVoiceTurn(userId, { text: "a".repeat(4097), contextId });
    expect(turn.speech).toMatch(/longer than I can take/);
    expect(turn.interview).toMatchObject({ state: "awaiting_answer", index: 0, total: 3 });
    expect(score).not.toHaveBeenCalled();
    expect((await getPracticeSession(userId, contextId))?.index).toBe(0);
  });

  it("accepts answers in any script, and re-asks on noise", async () => {
    const { userId, contextId } = await live();
    await runVoiceTurn(userId, { text: "Lideré la migración y reduje costes un 30 %.", contextId });
    await runVoiceTurn(userId, { text: "請求システムの移行を主導しました。", contextId });
    expect(score).toHaveBeenCalledTimes(2);

    const noise = await runVoiceTurn(userId, { text: " … 🙂 ", contextId });
    expect(noise.speech).toMatch(/didn't catch an answer/);
    expect(noise.interview).toMatchObject({ state: "awaiting_answer", index: 2 });
    expect(score).toHaveBeenCalledTimes(2);
  });

  it.each(["stop", "Stop.", "done", "exit", "I'm done", "back to Buddy", "Exit Fadi!"])(
    "%j ends the interview, clears it and reaches no provider",
    async (said) => {
      const { userId, contextId } = await live();
      const turn = await runVoiceTurn(userId, { text: said, contextId });
      expect(turn.interview).toEqual({ state: "done" });
      expect(await getKv().get(`interview:${userId}:${contextId}`)).toBeNull();
      expect(score).not.toHaveBeenCalled();
      expect(docGenerate).not.toHaveBeenCalled();
      expect(chain).not.toHaveBeenCalled();
      expect(context).not.toHaveBeenCalled();
    }
  );

  it.each([
    "I was done with the migration by Friday and we stopped the outage",
    "We finished the rollout and I had to stop the release twice",
    "yes",
    "no",
    "confirm",
  ])("%j is an answer, not an exit", async (said) => {
    const { userId, contextId } = await live();
    const turn = await runVoiceTurn(userId, { text: said, contextId });
    expect(score).toHaveBeenCalledWith(userId, expect.objectContaining({ answer: said }));
    expect(turn.interview).toMatchObject({ state: "awaiting_answer", index: 1 });
    expect(turn.pending).toBeNull();
  });

  it("speaks the whole coaching and the whole next question, past the general 60-word cut", async () => {
    const nextQuestion =
      "Walk me through a time you had to change a plan halfway through because the data told you something new, and tell me what you did with the people who had already committed to the old plan.";
    const { userId, contextId } = await live([
      QUESTIONS[0],
      { question: nextQuestion, kind: "behavioral" },
    ]);
    score.mockResolvedValueOnce({
      ok: true,
      score: answerScore({
        strengths: [
          "You named the system, the scale and the result, which made the story easy to follow and believable for an interviewer.",
        ],
        improvements: [
          "Open with the situation in one sentence before you get into the technical detail of the migration itself.",
          "Say what you personally decided rather than what the team did, so your ownership is clear.",
        ],
      }),
    });
    const turn = await runVoiceTurn(userId, { text: "My answer.", contextId });
    expect(turn.speech.split(" ").length).toBeGreaterThan(60);
    expect(turn.speech).toContain(nextQuestion);
    expect(turn.speech).toContain("ownership is clear");
    expect(turn.speech).not.toMatch(/\d(\.\d)?\s*(\/|out of)\s*5/);
  });

  it("says a valid question over 200 words whole, tail included, with the advanced marker", async () => {
    const tail = "and finally, what would you do differently if you ran it again tomorrow?";
    const longQuestion = `${"Tell me about the system you owned, the people around it, and the trade-offs you made. ".repeat(14)}${tail}`;
    expect(longQuestion.split(" ").length).toBeGreaterThan(200);
    const { userId, contextId } = await live([
      QUESTIONS[0],
      { question: longQuestion, kind: "behavioral" },
    ]);
    const turn = await runVoiceTurn(userId, { text: "My answer.", contextId });
    expect(turn.speech).toContain(tail);
    expect(turn.speech).toContain(longQuestion);
    expect(turn.speech.length).toBeLessThanOrEqual(6000);
    expect(turn.interview).toEqual({ state: "awaiting_answer", index: 1, total: 2 });
  });

  it("ends safely when a reply exceeds 6000 characters instead of awaiting an unheard answer", async () => {
    const huge = `${"Walk me through every decision you made on that project. ".repeat(120)}Why?`;
    const { userId, contextId } = await live([
      QUESTIONS[0],
      { question: huge, kind: "behavioral" },
    ]);
    const turn = await runVoiceTurn(userId, { text: "My answer.", contextId });
    expect(turn.speech).toMatch(/too long to say aloud/);
    expect(turn.speech).not.toContain("Walk me through");
    // The user never heard the question; do not collect or score a blind next answer.
    expect(turn.interview).toEqual({ state: "done" });
    expect(await getPracticeSession(userId, contextId)).toBeNull();
  });

  it("a failed score keeps Buddy on the same question and does not advance", async () => {
    const { userId, contextId } = await live();
    score.mockResolvedValueOnce({ ok: false, message: "Scoring is unavailable just now." });
    const turn = await runVoiceTurn(userId, {
      text: "My real answer about the migration.",
      contextId,
    });
    expect(turn.speech).toMatch(/unavailable/);
    expect(turn.interview).toEqual({ state: "awaiting_answer", index: 0, total: 3 });
    expect((await getPracticeSession(userId, contextId))?.index).toBe(0);

    // The retry is scored against the same question and only then moves on.
    const retry = await runVoiceTurn(userId, {
      text: "My real answer about the migration.",
      contextId,
    });
    expect(retry.interview).toMatchObject({ state: "awaiting_answer", index: 1 });
    expect(score).toHaveBeenLastCalledWith(
      userId,
      expect.objectContaining({ question: QUESTIONS[0].question })
    );
  });

  it("a scorer that throws is a failed answer too, not a dropped session", async () => {
    const { userId, contextId } = await live();
    score.mockRejectedValueOnce(new Error("provider down"));
    const turn = await runVoiceTurn(userId, { text: "My answer.", contextId });
    expect(turn.interview).toEqual({ state: "awaiting_answer", index: 0, total: 3 });
    expect((await getPracticeSession(userId, contextId))?.index).toBe(0);
  });

  it("a session belongs to its owner and conversation only", async () => {
    const { userId, contextId } = await live();
    // Someone else's "stop" in the same conversation id, and the owner in another conversation,
    // are ordinary turns: they neither end nor answer the session.
    await runVoiceTurn("intruder", { text: "stop", contextId });
    await runVoiceTurn(userId, { text: "stop", contextId: "another-conversation" });
    expect(score).not.toHaveBeenCalled();
    expect((await getPracticeSession(userId, contextId))?.index).toBe(0);
  });
});

describe("runVoiceTurn — ordinary turns", () => {
  beforeEach(() => {
    context.mockClear();
    chain.mockClear();
  });

  it("still refuses over 500 characters when no interview is live, and says so", async () => {
    const turn = await runVoiceTurn("plain-user", { text: "x".repeat(501), contextId: "plain" });
    expect(turn.speech).toMatch(/too long/);
    expect(turn.interview).toBeNull();
    expect(context).not.toHaveBeenCalled();
    expect(chain).not.toHaveBeenCalled();
  });

  it("takes 500 characters as before", async () => {
    await runVoiceTurn("plain-user", { text: "x".repeat(500), contextId: "plain" });
    expect(context).toHaveBeenCalledTimes(1);
  });

  it("fails closed when it cannot tell whether an interview is live", async () => {
    const kv = getKv();
    const get = vi.spyOn(kv, "get").mockRejectedValueOnce(new Error("store unavailable"));
    const turn = await runVoiceTurn("plain-user", {
      text: "apply to the role I just mentioned",
      contextId: "maybe-live",
    });
    get.mockRestore();

    expect(turn.speech).toMatch(/haven't used those words for anything/);
    expect(turn.interview).toEqual({ state: "unavailable" });
    expect(context).not.toHaveBeenCalled();
    expect(chain).not.toHaveBeenCalled();
  });
});
