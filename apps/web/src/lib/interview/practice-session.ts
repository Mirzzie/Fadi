import "server-only";

import { getKv } from "@/lib/kv/store";

import {
  generateMockQuestions,
  scoreInterviewAnswer,
  type AnswerScore,
  type InterviewStage,
  type MockQuestion,
} from "./mock";

/**
 * A SPOKEN MOCK-INTERVIEW SESSION, one question at a time.
 *
 * Buddy runs the interview by voice: Fadi asks a role-grounded question, the person answers
 * aloud, Fadi gives short coaching and asks the next one. The leaders this is modelled on
 * (Google Interview Warmup, interviewing.io) deliberately give DESCRIPTIVE coaching, not a
 * scary grade — so what we speak back is "what was strong / what to tighten", never a number.
 *
 * PRIVACY: the person's spoken answers are scored transiently and NEVER persisted. The session
 * stored in KV holds only the questions, a cursor, and a short coaching summary per answer
 * (strengths/improvements the coach produced, filler count) — not the answer text itself. Those
 * strengths/improvements are model output about the answer, so they can paraphrase or quote it;
 * they are clipped to a few words each to keep that small, not because they are guaranteed free of
 * anything the person said. Keyed by (userId, contextId) so one conversation's session is private
 * to its owner, and gone after 30 minutes or when the session ends.
 */

const TTL_S = 30 * 60;
const CLAIM_TTL_S = 3 * 60;
/** A spoken interview answer runs long; everything else by voice stays at 500 characters. */
export const INTERVIEW_ANSWER_MAX_CHARS = 4096;
/** A2A and voice callers use the same bounded conversation identifier. */
export const INTERVIEW_CONTEXT_MAX_CHARS = 100;
/** One coaching point, said or stored: long enough for a sentence, short enough to hold. */
const COACH_POINT_WORDS = 24;

/**
 * The person ending the interview: the WHOLE utterance is a short stop phrase. "Stop", "I'm done",
 * "back to Buddy" end it; "I was done with the migration by Friday" is an answer. Matching a word
 * anywhere in the sentence ended answers that merely mentioned finishing something.
 */
const END_PHRASES = new Set([
  "stop",
  "done",
  "end",
  "exit",
  "quit",
  "finish",
  "finished",
  "enough",
  "im done",
  "i am done",
  "im finished",
  "i am finished",
  "thats it",
  "thats all",
  "no more",
  "stop interview",
  "end interview",
  "exit interview",
  "finish interview",
  "stop the interview",
  "end the interview",
  "exit the interview",
  "finish the interview",
  "stop practice",
  "end practice",
  "stop practicing",
  "stop practising",
  "back to buddy",
  "go back to buddy",
  "exit fadi",
  "stop fadi",
  "leave fadi",
]);

export function isEndCommand(text: string): boolean {
  const said = text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:ok|okay|alright) /, "")
    .replace(/ (?:please|thanks|thank you)$/, "");
  return END_PHRASES.has(said);
}

/** Words a person actually said, in any script — not just punctuation or noise. */
export function isMeaningfulAnswer(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text);
}

/** A coaching point cut to a sayable length, at a sentence end where there is one. */
function clipPoint(point: string): string {
  const words = point.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (words.length <= COACH_POINT_WORDS) return words.join(" ");
  const head = words.slice(0, COACH_POINT_WORDS).join(" ");
  const end = Math.max(head.lastIndexOf(". "), head.lastIndexOf("? "), head.lastIndexOf("! "));
  return end > 0 ? head.slice(0, end) : head;
}

type Coached = {
  question: string;
  strengths: string[];
  improvements: string[];
  fillerCount: number;
};

export type PracticeSession = {
  role: string;
  stage: InterviewStage | null;
  country: string | null;
  seniority: string | null;
  questions: MockQuestion[];
  index: number;
  startedAt: string;
  coached: Coached[];
};

export type StartInput = {
  contextId: string;
  role: string;
  stage?: InterviewStage | null;
  country?: string | null;
  seniority?: string | null;
  jobDescription?: string | null;
  durationMinutes?: number | null;
};

function boundedContextId(contextId: string): string {
  return contextId.trim().slice(0, INTERVIEW_CONTEXT_MAX_CHARS);
}

function sessionKey(userId: string, contextId: string): string {
  return `interview:${userId}:${boundedContextId(contextId)}`;
}

function claimKey(userId: string, contextId: string): string {
  return `${sessionKey(userId, contextId)}:claim`;
}

async function claimSession(
  userId: string,
  contextId: string
): Promise<{ release: () => Promise<void> } | null> {
  const token = crypto.randomUUID();
  const key = claimKey(userId, contextId);
  if (!(await getKv().setNx(key, token, CLAIM_TTL_S))) return null;
  return {
    release: () =>
      getKv()
        .deleteIfValue(key, token)
        .then(() => undefined),
  };
}

async function read(userId: string, contextId: string): Promise<PracticeSession | null> {
  const raw = await getKv().get(sessionKey(userId, contextId));
  return raw ? (JSON.parse(raw) as PracticeSession) : null;
}

async function save(userId: string, contextId: string, s: PracticeSession): Promise<void> {
  await getKv().set(sessionKey(userId, contextId), JSON.stringify(s), TTL_S);
}

/** Short, spoken, non-judgmental coaching from a scored answer — no numeric grade. */
export function describeCoaching(score: AnswerScore): string {
  // Lower-cased to sit mid-sentence, clipped, and without its own end mark (one is added here).
  const lc = (s: string) => {
    const point = clipPoint(s).replace(/[.!?…]+$/, "");
    return point ? point[0].toLowerCase() + point.slice(1) : point;
  };
  const parts: string[] = [];
  if (score.strengths[0]) parts.push(`Nice — ${lc(score.strengths[0])}.`);
  const improvements = score.improvements.filter((s) => s?.trim()).slice(0, 2);
  if (improvements.length) parts.push(`To tighten it: ${improvements.map(lc).join("; ")}.`);
  if (score.transcript.fillerCount >= 3) {
    parts.push(`Watch filler like ${score.transcript.fillerWords.slice(0, 3).join(", ")}.`);
  }
  if (parts.length === 0) parts.push("Solid answer.");
  return parts.join(" ");
}

export type StartResult =
  | { ok: true; question: string; index: number; total: number }
  | { ok: false; message: string };

/** Begin a session: draft role-grounded questions and return the first. */
export async function startPracticeSession(
  userId: string,
  input: StartInput
): Promise<StartResult> {
  if (!input.contextId?.trim()) {
    return { ok: false, message: "Interview practice needs a conversation to run in." };
  }
  if (!input.role?.trim()) {
    return { ok: false, message: "Tell me which role to practice for, and I'll start." };
  }
  const claim = await claimSession(userId, input.contextId);
  if (!claim) {
    return { ok: false, message: "That interview is already changing. Give me a moment." };
  }
  try {
    const result = await generateMockQuestions(userId, {
      role: input.role,
      stage: input.stage ?? null,
      country: input.country ?? null,
      seniority: input.seniority ?? null,
      jobDescription: input.jobDescription ?? null,
      durationMinutes: input.durationMinutes ?? null,
    });
    if (!result.ok) return { ok: false, message: result.message };
    const first = result.questions[0];
    // The generator enforces this too. Keep the session boundary valid if it is ever replaced.
    if (!first) return { ok: false, message: "I couldn't draft an interview question. Try again." };

    const session: PracticeSession = {
      role: input.role.trim(),
      stage: input.stage ?? null,
      country: input.country ?? null,
      seniority: input.seniority ?? null,
      questions: result.questions,
      index: 0,
      startedAt: new Date().toISOString(),
      coached: [],
    };
    await save(userId, input.contextId, session);
    return {
      ok: true,
      question: first.question,
      index: 0,
      total: session.questions.length,
    };
  } finally {
    await claim.release();
  }
}

export type AnswerResult =
  | {
      ok: true;
      coaching: string;
      nextQuestion: string | null;
      done: boolean;
      index: number;
      total: number;
    }
  | { ok: false; message: string };

/** Score the spoken answer to the current question (transiently), coach, advance. */
export async function answerPracticeSession(
  userId: string,
  input: { contextId: string; answer: string }
): Promise<AnswerResult> {
  const answer = input.answer.trim();
  if (!isMeaningfulAnswer(answer)) return { ok: false, message: "I didn't catch an answer there." };
  if (answer.length > INTERVIEW_ANSWER_MAX_CHARS) {
    return { ok: false, message: "That answer is too long. Try it again a little shorter." };
  }
  const claim = await claimSession(userId, input.contextId);
  if (!claim) {
    return { ok: false, message: "I'm still reviewing your last answer. Give me a moment." };
  }
  try {
    const session = await read(userId, input.contextId);
    if (!session) {
      return {
        ok: false,
        message: "No interview is in progress. Say 'practice interview for' a role to start.",
      };
    }
    const current = session.questions[session.index];
    if (!current) {
      return { ok: false, message: "We've finished the questions. Say 'done' for your summary." };
    }
    const scored = await scoreInterviewAnswer(userId, {
      question: current.question,
      answer,
      role: session.role,
    });
    if (!scored.ok) return { ok: false, message: scored.message };

    const coaching = describeCoaching(scored.score);
    // Persist only descriptive coaching, never the spoken answer or a pseudo-objective grade.
    session.coached.push({
      question: current.question,
      strengths: scored.score.strengths.slice(0, 3).map(clipPoint),
      improvements: scored.score.improvements.slice(0, 3).map(clipPoint),
      fillerCount: scored.score.transcript.fillerCount,
    });
    session.index += 1;
    const next = session.questions[session.index] ?? null;
    await save(userId, input.contextId, session);

    return {
      ok: true,
      coaching,
      nextQuestion: next?.question ?? null,
      done: next === null,
      index: session.index,
      total: session.questions.length,
    };
  } finally {
    await claim.release();
  }
}

export type EndResult = { ok: true; summary: string } | { ok: false; message: string };

/** Close the session and give a short spoken wrap-up; clears all session state. */
export async function endPracticeSession(userId: string, contextId: string): Promise<EndResult> {
  const claim = await claimSession(userId, contextId);
  if (!claim)
    return { ok: false, message: "I'm still reviewing your last answer. Give me a moment." };
  try {
    const session = await read(userId, contextId);
    await getKv().del(sessionKey(userId, contextId));
    if (!session || session.coached.length === 0) {
      return { ok: true, summary: "No answers to review yet. Start an interview any time." };
    }
    const answered = session.coached.length;
    const commonImprovements = Array.from(
      new Set(session.coached.flatMap((c) => c.improvements.map((i) => i.replace(/[.!?…]+$/, ""))))
    ).slice(0, 2);
    const totalFiller = session.coached.reduce((n, c) => n + c.fillerCount, 0);
    const bits: string[] = [
      `That's ${answered} ${answered === 1 ? "answer" : "answers"} for the ${session.role} role.`,
    ];
    if (commonImprovements.length) {
      const lead =
        commonImprovements.length === 1 ? "One thing to work on" : "A couple of things to work on";
      bits.push(`${lead}: ${commonImprovements.join("; ")}.`);
    }
    if (totalFiller >= 6) bits.push("And trim the filler words a little.");
    bits.push("Nice work putting in the reps.");
    return { ok: true, summary: bits.join(" ") };
  } finally {
    await claim.release();
  }
}

/** The live session, if one is running for this conversation (for routing/markers). */
export async function getPracticeSession(
  userId: string,
  contextId: string
): Promise<PracticeSession | null> {
  return read(userId, contextId);
}
