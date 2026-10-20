import { beforeEach, describe, expect, it, vi } from "vitest";

import { getKv } from "@/lib/kv/store";

import type { AnswerScore, MockQuestion } from "./mock";

vi.mock("./mock", () => ({
  generateMockQuestions: vi.fn(),
  scoreInterviewAnswer: vi.fn(),
}));

import { generateMockQuestions, scoreInterviewAnswer } from "./mock";
import {
  answerPracticeSession,
  describeCoaching,
  endPracticeSession,
  getPracticeSession,
  isEndCommand,
  isMeaningfulAnswer,
  startPracticeSession,
} from "./practice-session";

const gen = vi.mocked(generateMockQuestions);
const score = vi.mocked(scoreInterviewAnswer);

const QUESTIONS: MockQuestion[] = [
  { question: "Tell me about yourself.", kind: "opener" },
  {
    question: "Describe a time you owned a hard project.",
    kind: "behavioral",
    competency: "ownership",
  },
];

function answerScore(over: Partial<AnswerScore> = {}): AnswerScore {
  return {
    transcript: { wordCount: 60, fillerCount: 4, fillerWords: ["um", "basically"] },
    transcriptNote: "60 words",
    scores: { structure: 3, specificity: 3, relevance: 4, concision: 3 },
    overall: 3.3,
    strengths: ["You gave a concrete result"],
    improvements: ["Open with the situation", "Name the metric you mentioned"],
    strongerVersion: "…",
    ...over,
  };
}

describe("practice-session", () => {
  beforeEach(() => {
    gen.mockReset();
    score.mockReset();
  });

  it("runs a full session: start → answer → advance → done → summary (user outcome)", async () => {
    gen.mockResolvedValue({ ok: true, questions: QUESTIONS });
    score.mockResolvedValue({ ok: true, score: answerScore() });

    const started = await startPracticeSession("u1", { contextId: "c1", role: "Backend Engineer" });
    expect(started).toMatchObject({
      ok: true,
      question: QUESTIONS[0].question,
      index: 0,
      total: 2,
    });

    const live = await getPracticeSession("u1", "c1");
    expect(live?.role).toBe("Backend Engineer");

    const a1 = await answerPracticeSession("u1", {
      contextId: "c1",
      answer: "I did X and shipped Y.",
    });
    expect(a1.ok).toBe(true);
    if (a1.ok) {
      expect(a1.coaching).toContain("concrete result");
      expect(a1.nextQuestion).toBe(QUESTIONS[1].question);
      expect(a1.done).toBe(false);
      expect(a1.index).toBe(1);
    }

    const a2 = await answerPracticeSession("u1", { contextId: "c1", answer: "Another answer." });
    expect(a2.ok).toBe(true);
    if (a2.ok) {
      expect(a2.nextQuestion).toBeNull();
      expect(a2.done).toBe(true);
    }

    const ended = await endPracticeSession("u1", "c1");
    expect(ended.ok).toBe(true);
    if (ended.ok) expect(ended.summary).toContain("Backend Engineer");
    // Session cleared after end.
    expect(await getPracticeSession("u1", "c1")).toBeNull();
  });

  it("never persists the raw spoken answer (privacy)", async () => {
    gen.mockResolvedValue({ ok: true, questions: QUESTIONS });
    score.mockResolvedValue({ ok: true, score: answerScore() });
    await startPracticeSession("u2", { contextId: "c2", role: "PM" });
    const secret = "my-confidential-spoken-answer-12345";
    await answerPracticeSession("u2", { contextId: "c2", answer: secret });
    const raw = await getKv().get("interview:u2:c2");
    expect(raw).not.toBeNull();
    expect(raw).not.toContain(secret);
    expect(raw).not.toContain('"overall"');
  });

  it("accepts only one answer while the current answer is being scored", async () => {
    gen.mockResolvedValue({ ok: true, questions: QUESTIONS });
    let finishScore!: (value: { ok: true; score: AnswerScore }) => void;
    score.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishScore = resolve;
        })
    );
    await startPracticeSession("u-lock", { contextId: "c-lock", role: "SRE" });

    const first = answerPracticeSession("u-lock", {
      contextId: "c-lock",
      answer: "I diagnosed the incident and restored service.",
    });
    await vi.waitFor(() => expect(score).toHaveBeenCalledTimes(1));
    const duplicate = await answerPracticeSession("u-lock", {
      contextId: "c-lock",
      answer: "A retried copy of the same answer.",
    });
    expect(duplicate).toMatchObject({
      ok: false,
      message: expect.stringMatching(/still reviewing/i),
    });

    finishScore({ ok: true, score: answerScore() });
    expect(await first).toMatchObject({ ok: true, index: 1 });
    expect((await getPracticeSession("u-lock", "c-lock"))?.index).toBe(1);
  });

  it("enforces answer limits at the session boundary, not only in the voice caller", async () => {
    gen.mockResolvedValue({ ok: true, questions: QUESTIONS });
    await startPracticeSession("u-boundary", { contextId: "c-boundary", role: "SRE" });
    expect(
      await answerPracticeSession("u-boundary", { contextId: "c-boundary", answer: "🙂 …" })
    ).toMatchObject({ ok: false });
    expect(
      await answerPracticeSession("u-boundary", {
        contextId: "c-boundary",
        answer: "a".repeat(4097),
      })
    ).toMatchObject({ ok: false, message: expect.stringMatching(/too long/i) });
    expect(score).not.toHaveBeenCalled();
  });

  it("a session is private to its owner + context (authorization)", async () => {
    gen.mockResolvedValue({ ok: true, questions: QUESTIONS });
    score.mockResolvedValue({ ok: true, score: answerScore() });
    await startPracticeSession("owner", { contextId: "ctx", role: "SRE" });
    expect(await getPracticeSession("intruder", "ctx")).toBeNull();
    expect(await getPracticeSession("owner", "other-ctx")).toBeNull();
  });

  it("answering with no live session fails gracefully (failure path)", async () => {
    const r = await answerPracticeSession("u3", { contextId: "none", answer: "hi" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/no interview/i);
    expect(score).not.toHaveBeenCalled();
  });

  it("propagates a question-generation failure and an empty role", async () => {
    gen.mockResolvedValue({ ok: false, message: "Connect an AI provider." });
    const r = await startPracticeSession("u4", { contextId: "c4", role: "Analyst" });
    expect(r).toEqual({ ok: false, message: "Connect an AI provider." });

    const empty = await startPracticeSession("u4", { contextId: "c4", role: "   " });
    expect(empty.ok).toBe(false);
    expect(gen).toHaveBeenCalledTimes(1); // empty role never reaches generation
  });

  it("describeCoaching is descriptive, not a numeric grade", () => {
    const text = describeCoaching(answerScore());
    expect(text).toContain("concrete result");
    expect(text).toContain("filler");
    expect(text).not.toMatch(/\b\d(\.\d)?\s*\/\s*5\b/); // no "3.3/5"
  });

  it("ends only on a whole short stop phrase, not a stop word inside an answer", () => {
    for (const said of [
      "stop",
      "Stop.",
      "DONE!",
      "exit",
      "I'm done",
      "I’m done",
      "that's it",
      "back to Buddy",
      "go back to buddy",
      "Exit Fadi.",
      "okay stop",
      "stop please",
      "end the interview",
    ]) {
      expect(isEndCommand(said), said).toBe(true);
    }
    for (const said of [
      "yes",
      "no",
      "confirm",
      "I was done by Friday",
      "we had to stop the release",
      "I finished the migration",
      "done and dusted, we shipped it",
      "stop stop stop",
      "",
    ]) {
      expect(isEndCommand(said), said).toBe(false);
    }
  });

  it("an answer is meaningful in any script; punctuation and emoji alone are not", () => {
    expect(isMeaningfulAnswer("Lideré la migración")).toBe(true);
    expect(isMeaningfulAnswer("移行を主導しました")).toBe(true);
    expect(isMeaningfulAnswer("قدت عملية النقل")).toBe(true);
    expect(isMeaningfulAnswer("42")).toBe(true);
    expect(isMeaningfulAnswer(" … 🙂 ?! ")).toBe(false);
  });

  it("bounds coaching points, spoken and stored, and ends cleanly", async () => {
    const rambling = `Open with the situation ${"and then the detail ".repeat(20)}`;
    const text = describeCoaching(answerScore({ improvements: [rambling, "Name the metric."] }));
    expect(text.split(" ").length).toBeLessThan(70);
    expect(text).not.toContain("..");
    expect(text).toContain("name the metric.");

    gen.mockResolvedValue({ ok: true, questions: QUESTIONS });
    score.mockResolvedValue({ ok: true, score: answerScore({ improvements: [rambling] }) });
    await startPracticeSession("u5", { contextId: "c5", role: "SRE" });
    await answerPracticeSession("u5", { contextId: "c5", answer: "An answer." });
    const stored = JSON.parse((await getKv().get("interview:u5:c5"))!) as {
      coached: { improvements: string[] }[];
    };
    expect(stored.coached[0].improvements[0].split(" ").length).toBeLessThanOrEqual(24);
    const ended = await endPracticeSession("u5", "c5");
    expect(ended.ok && ended.summary).not.toMatch(/\d(\.\d)?\s*(\/|out of)\s*5/);
    expect(await getKv().get("interview:u5:c5")).toBeNull();
  });
});
