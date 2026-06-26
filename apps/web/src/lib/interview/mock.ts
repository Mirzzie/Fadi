import { z } from "zod";

/**
 * Voice mock interviews — a practice round tailored to role × country × seniority,
 * with a scored autopsy of each answer.
 *
 * Two halves:
 *  - Question generation: country-aware interview questions (US "tell me about a
 *    time", UK competency evidence, German structured grids, Indian fundamentals-
 *    first, Japanese self-introduction, etc.) for the user's role/seniority and an
 *    optional job description.
 *  - Answer scoring: a deterministic delivery read (filler words, length, pacing)
 *    plus an AI qualitative score (structure / specificity / relevance / concision).
 *
 * Honesty: the "stronger answer" only reshapes what the candidate actually said —
 * it never invents an achievement, number, or experience. Pure helpers
 * (countryInterviewNorms / analyzeDelivery) are unit-testable; the AI loads
 * dynamically. The questions are spoken aloud and answers can be captured by voice
 * using the existing speech pipeline; this module is the brain behind that.
 */

// ── Country interview norms (pure) ──────────────────────────────────────────────
export function countryInterviewNorms(country?: string | null): string {
  const c = (country ?? "").toLowerCase();
  const has = (...keys: string[]) => keys.some((k) => c.includes(k));

  if (has("united states", "usa", "u.s", "america")) {
    return "United States style: behavioral 'tell me about a time…' questions expecting STAR answers; reward ownership, measurable impact, and confident enthusiasm.";
  }
  if (has("united kingdom", "uk", "britain", "england", "scotland", "wales", "ireland")) {
    return "UK/Ireland style: competency-based questions; reward concrete evidence over self-promotion; understatement is fine — back claims with specifics.";
  }
  if (has("germany", "austria", "switzerland", "deutsch")) {
    return "German-speaking style: structured competency grids; reward precision, qualifications, process, and factual specifics; less small talk.";
  }
  if (has("india")) {
    return "India style: often fundamentals/technical-heavy early rounds, then HR/fit; reward strong basics, clear reasoning, and real project specifics.";
  }
  if (has("japan")) {
    return "Japan style: a self-introduction (jikoshoukai) up front; reward humility, fit with the team/company, and signs of long-term commitment.";
  }
  if (has("canada", "australia", "new zealand")) {
    return "Canada/Australia style: a blend of behavioral and culture-fit; reward collaboration, adaptability, and specific outcomes.";
  }
  if (has("uae", "emirates", "saudi", "qatar", "gulf", "dubai", "abu dhabi")) {
    return "Gulf style: relationship- and credential-aware, multicultural teams; reward credibility, adaptability across cultures, and concrete results.";
  }
  return "General professional style: behavioral and role-specific questions; reward STAR structure, real specifics over adjectives, and relevance to the role.";
}

// ── Delivery analysis (pure, deterministic) ─────────────────────────────────────
const FILLER_PATTERNS = [
  "um", "uh", "er", "like", "you know", "i mean", "basically", "actually",
  "literally", "kind of", "sort of", "i guess", "right", "okay so",
];
const WORDS_PER_SECOND = 2.3; // ~140 wpm speaking pace

export type DeliveryStats = {
  wordCount: number;
  fillerCount: number;
  fillerWords: string[];
  estSeconds: number;
  pacing: "short" | "good" | "long";
};

export function analyzeDelivery(transcript: string): DeliveryStats {
  const text = transcript.trim();
  const words = text ? text.split(/\s+/) : [];
  const wordCount = words.length;
  const lower = ` ${text.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ")} `;

  const fillerWords: string[] = [];
  let fillerCount = 0;
  for (const f of FILLER_PATTERNS) {
    const matches = lower.match(new RegExp(`\\s${f}\\s`, "g"));
    if (matches && matches.length > 0) {
      fillerCount += matches.length;
      fillerWords.push(f);
    }
  }

  const estSeconds = Math.round(wordCount / WORDS_PER_SECOND);
  // A strong behavioral answer is roughly 60–220 words (~25–95 seconds).
  const pacing: DeliveryStats["pacing"] = wordCount < 60 ? "short" : wordCount > 220 ? "long" : "good";

  return { wordCount, fillerCount, fillerWords, estSeconds, pacing };
}

export function deliveryNote(d: DeliveryStats): string {
  const parts: string[] = [];
  parts.push(
    d.pacing === "short"
      ? `A bit short (~${d.wordCount} words, ~${d.estSeconds}s) — add one concrete example.`
      : d.pacing === "long"
        ? `A bit long (~${d.wordCount} words, ~${d.estSeconds}s) — tighten to the strongest details.`
        : `Good length (~${d.wordCount} words, ~${d.estSeconds}s).`,
  );
  if (d.fillerCount >= 3) parts.push(`${d.fillerCount} filler words (${d.fillerWords.slice(0, 4).join(", ")}) — slow down and pause instead.`);
  return parts.join(" ");
}

// Interviewer personas live in ./personas (pure) so client code can import the list
// without pulling this module's server-only AI imports into the browser bundle.
export { INTERVIEWER_PERSONAS, personaStyle, type InterviewerPersona } from "./personas";
import { personaStyle } from "./personas";

// ── Question generation (AI) ────────────────────────────────────────────────────
export type MockQuestion = { question: string; kind: "opener" | "behavioral" | "role" | "situational"; competency?: string };

// `kind` is a plain string here (not a strict enum) on purpose: several providers'
// structured-output modes reject enum constraints and the whole call fails. We
// normalize it ourselves after.
const questionsSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string(),
        kind: z.string().optional(),
        competency: z.string().optional(),
      }),
    )
    .max(10),
});

function toKind(s?: string): MockQuestion["kind"] {
  const k = (s ?? "").toLowerCase().trim();
  return k === "opener" || k === "role" || k === "situational" ? k : "behavioral";
}

export type MockConfig = { role: string; country?: string | null; seniority?: string | null; jobDescription?: string | null; persona?: string | null };

export async function generateMockQuestions(
  userId: string,
  config: MockConfig,
): Promise<{ ok: true; questions: MockQuestion[] } | { ok: false; message: string }> {
  if (!config.role?.trim()) return { ok: false, message: "Pick a role to interview for first." };

  const { getUserDocGenerate } = await import("@/lib/ai/user-generate");
  const generate = await getUserDocGenerate(userId);
  if (!generate) return { ok: false, message: "Connect an AI provider in Settings to run a mock interview." };

  const system = `You are an experienced interviewer running a realistic MOCK INTERVIEW. Produce 5–7 questions for this specific role, seniority, and country's interview norms.
${countryInterviewNorms(config.country)}${personaStyle(config.persona)}
Rules:
- Start with one opener appropriate to the country's norms.
- Mix behavioral ("tell me about a time…"), role-specific, and one situational question.
- Calibrate depth to the seniority. Be realistic — these should sound like a real interviewer for THIS role, not generic.
- Tag each question's kind, and a competency for behavioral ones.`;

  const user = [
    `Role: ${config.role}`,
    `Seniority: ${config.seniority ?? "not specified"}`,
    `Country/region: ${config.country ?? "not specified"}`,
    config.jobDescription?.trim() ? `Job description:\n${config.jobDescription.slice(0, 4000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await generate.structured(system, user, questionsSchema, "mock_questions");
    const questions: MockQuestion[] = (raw.questions ?? [])
      .filter((q) => q.question?.trim())
      .map((q) => ({ question: q.question.trim(), kind: toKind(q.kind), competency: q.competency?.trim() || undefined }));
    if (questions.length === 0) {
      return { ok: false, message: "Your AI provider returned no questions. Try a simpler role, or check the model in Settings supports structured output." };
    }
    return { ok: true, questions };
  } catch (err) {
    const { logger } = await import("@/lib/observability/logger");
    const reason = err instanceof Error ? err.message : "the provider call failed";
    logger.warn("interview.mock_questions_failed", { userId, role: config.role, error: reason });
    return { ok: false, message: `Couldn't draft questions: ${reason.slice(0, 160)}. Check your AI provider in Settings, then try again.` };
  }
}

// ── Answer scoring (deterministic delivery + AI qualitative) ─────────────────────
export type AnswerScore = {
  delivery: DeliveryStats;
  deliveryNote: string;
  scores: { structure: number; specificity: number; relevance: number; concision: number };
  overall: number; // 0–5
  strengths: string[];
  improvements: string[];
  strongerVersion: string; // reshapes ONLY what the candidate said; never invents
};

// Coerce + tolerate: providers sometimes return numbers as strings or omit arrays.
const scoreSchema = z.object({
  structure: z.coerce.number(),
  specificity: z.coerce.number(),
  relevance: z.coerce.number(),
  concision: z.coerce.number(),
  strengths: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
  strongerVersion: z.string().default(""),
});

const clamp5 = (n: number) => Math.max(0, Math.min(5, Number.isFinite(n) ? n : 0));

export function overallFromScores(s: { structure: number; specificity: number; relevance: number; concision: number }): number {
  // Structure and specificity matter most in behavioral answers.
  const weighted = s.structure * 0.3 + s.specificity * 0.3 + s.relevance * 0.25 + s.concision * 0.15;
  return Math.round(weighted * 10) / 10;
}

export async function scoreInterviewAnswer(
  userId: string,
  input: { question: string; answer: string; role?: string | null },
): Promise<{ ok: true; score: AnswerScore } | { ok: false; message: string }> {
  const answer = input.answer?.trim() ?? "";
  if (!answer) return { ok: false, message: "Give an answer to score." };
  const delivery = analyzeDelivery(answer);

  const { getUserDocGenerate } = await import("@/lib/ai/user-generate");
  const generate = await getUserDocGenerate(userId);
  if (!generate) {
    // Deterministic-only fallback so the user still gets a useful read with no provider.
    return {
      ok: true,
      score: {
        delivery,
        deliveryNote: deliveryNote(delivery),
        scores: { structure: 0, specificity: 0, relevance: 0, concision: delivery.pacing === "good" ? 4 : 2 },
        overall: 0,
        strengths: [],
        improvements: ["Connect an AI provider for a full content score; the delivery read above is from your answer length and filler words."],
        strongerVersion: "",
      },
    };
  }

  const system = `You are an interview coach scoring ONE answer to ONE question. Score 0–5 on:
- structure: is it a clear STAR arc (situation→task→action→result)?
- specificity: real details, names, numbers, outcomes — not vague adjectives?
- relevance: does it actually answer THIS question for THIS role?
- concision: tight and on-point, not rambling or padded?
Then give strengths, improvements, and a "strongerVersion".
HARD RULE: the strongerVersion must only reshape what the candidate actually said — clearer structure, tighter wording, surfacing the specifics they already gave. NEVER invent an achievement, number, company, or experience they didn't mention.`;

  const user = [
    input.role ? `Role: ${input.role}` : "",
    `Question: ${input.question}`,
    `Candidate's answer:\n${answer.slice(0, 4000)}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await generate.structured(system, user, scoreSchema, "answer_score");
    const scores = {
      structure: clamp5(raw.structure),
      specificity: clamp5(raw.specificity),
      relevance: clamp5(raw.relevance),
      concision: clamp5(raw.concision),
    };
    return {
      ok: true,
      score: {
        delivery,
        deliveryNote: deliveryNote(delivery),
        scores,
        overall: overallFromScores(scores),
        strengths: raw.strengths.map((s) => s.trim()).filter(Boolean),
        improvements: raw.improvements.map((s) => s.trim()).filter(Boolean),
        strongerVersion: raw.strongerVersion.trim(),
      },
    };
  } catch (err) {
    const { logger } = await import("@/lib/observability/logger");
    const reason = err instanceof Error ? err.message : "the provider call failed";
    logger.warn("interview.score_answer_failed", { userId, error: reason });
    return { ok: false, message: `Couldn't score that answer: ${reason.slice(0, 160)}.` };
  }
}
