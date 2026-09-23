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
 *  - Answer scoring: deterministic transcript facts (word and possible filler
 *    counts) plus an AI qualitative score (structure / specificity / relevance /
 *    concision).
 *
 * Honesty: the "stronger answer" only reshapes what the candidate actually said —
 * it never invents an achievement, number, or experience. Pure helpers
 * (countryInterviewNorms / analyzeTranscript) are unit-testable; the AI loads
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

// ── Transcript analysis (pure, deterministic) ───────────────────────────────────
const FILLER_PATTERNS = [
  "um",
  "uh",
  "er",
  "like",
  "you know",
  "i mean",
  "basically",
  "actually",
  "literally",
  "kind of",
  "sort of",
  "i guess",
  "right",
  "okay so",
];
export type TranscriptStats = {
  wordCount: number;
  fillerCount: number;
  fillerWords: string[];
};

export function analyzeTranscript(transcript: string): TranscriptStats {
  const text = transcript.trim();
  const words = text ? text.split(/\s+/) : [];
  const wordCount = words.length;
  const lower = ` ${text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")} `;

  const fillerWords: string[] = [];
  let fillerCount = 0;
  for (const f of FILLER_PATTERNS) {
    const matches = lower.match(new RegExp(`\\s${f}\\s`, "g"));
    if (matches && matches.length > 0) {
      fillerCount += matches.length;
      fillerWords.push(f);
    }
  }

  return { wordCount, fillerCount, fillerWords };
}

export function transcriptNote(stats: TranscriptStats): string {
  const count = `${stats.wordCount} ${stats.wordCount === 1 ? "word" : "words"} in the transcript.`;
  if (stats.fillerCount < 3) return count;
  return `${count} It contains ${stats.fillerCount} possible filler phrases (${stats.fillerWords.slice(0, 4).join(", ")}); review the transcript to confirm them.`;
}

// Interviewer personas live in ./personas (pure) so client code can import the list
// without pulling this module's server-only AI imports into the browser bundle.
export { INTERVIEWER_PERSONAS, personaStyle, type InterviewerPersona } from "./personas";
import { logger } from "@/lib/observability/logger";

// ── Question generation (AI) ────────────────────────────────────────────────────
export type MockQuestion = {
  question: string;
  kind: "opener" | "behavioral" | "role" | "situational";
  competency?: string;
};

// `kind` is a plain string here (not a strict enum) on purpose: several providers'
// structured-output modes reject enum constraints and the whole call fails. We
// normalize it ourselves after.
const questionsSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string(),
        kind: z.string().nullable(),
        competency: z.string().nullable(),
      })
    )
    .max(10),
});

/** Accepts null as well as undefined — the extraction schema uses `.nullable()`. */
function toKind(s?: string | null): MockQuestion["kind"] {
  const k = (s ?? "").toLowerCase().trim();
  return k === "opener" || k === "role" || k === "situational" ? k : "behavioral";
}

export type InterviewStage = "recruiter" | "hiring_manager" | "technical" | "behavioral";

export function interviewStageGuide(stage?: string | null): string {
  switch (stage) {
    case "recruiter":
      return "Recruiter screen: focus on motivation, career narrative, communication, availability, and role fit. Keep technical depth light.";
    case "technical":
      return "Technical interview: focus on practical reasoning, troubleshooting, trade-offs, and role-specific scenarios. Ask for concrete steps, not trivia alone.";
    case "behavioral":
      return "Behavioral interview: focus on competencies and real examples. Ask questions that can be answered with a STAR story.";
    default:
      return "Hiring-manager interview: focus on ownership, impact, collaboration, judgment, and depth relevant to the role.";
  }
}

export function interviewQuestionCount(durationMinutes?: number | null): number {
  return durationMinutes === 20 ? 7 : 4;
}

export type MockConfig = {
  role: string;
  country?: string | null;
  seniority?: string | null;
  jobDescription?: string | null;
  stage?: InterviewStage | null;
  durationMinutes?: number | null;
};

export async function generateMockQuestions(
  userId: string,
  config: MockConfig
): Promise<{ ok: true; questions: MockQuestion[] } | { ok: false; message: string }> {
  if (!config.role?.trim()) return { ok: false, message: "Pick a role to interview for first." };

  const { getUserDocGenerate } = await import("@/lib/ai/user-generate");
  const generate = await getUserDocGenerate(userId);
  if (!generate)
    return { ok: false, message: "Connect an AI provider in Settings to run a mock interview." };

  const questionCount = interviewQuestionCount(config.durationMinutes);
  const system = `You are an experienced interviewer running a realistic MOCK INTERVIEW. Produce exactly ${questionCount} questions for this specific role, seniority, stage, and country's interview norms.
${countryInterviewNorms(config.country)}
${interviewStageGuide(config.stage)}
Rules:
- Start with one opener appropriate to the country's norms.
- Follow the selected stage. Include other question types only where a real interviewer at that stage would.
- Calibrate depth to the seniority. Be realistic — these should sound like a real interviewer for THIS role, not generic.
- Tag each question's kind, and a competency for behavioral ones.`;

  const user = [
    `Role: ${config.role}`,
    `Seniority: ${config.seniority ?? "not specified"}`,
    `Country/region: ${config.country ?? "not specified"}`,
    `Interview stage: ${config.stage ?? "hiring manager"}`,
    `Practice length: ${config.durationMinutes ?? 10} minutes`,
    config.jobDescription?.trim()
      ? `Job description:\n${config.jobDescription.slice(0, 4000)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await generate.structured(system, user, questionsSchema, "mock_questions");
    const questions: MockQuestion[] = (raw.questions ?? [])
      .filter((q) => q.question?.trim())
      .map((q) => ({
        question: q.question.trim(),
        kind: toKind(q.kind),
        competency: q.competency?.trim() || undefined,
      }))
      .slice(0, questionCount);
    if (questions.length === 0) {
      return {
        ok: false,
        message:
          "Your AI provider returned no questions. Try a simpler role, or check the model in Settings supports structured output.",
      };
    }
    return { ok: true, questions };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "the provider call failed";
    logger.warn("interview.mock_questions_failed", { userId, role: config.role, error: reason });
    return {
      ok: false,
      message: `Couldn't draft questions: ${reason.slice(0, 160)}. Check your AI provider in Settings, then try again.`,
    };
  }
}

// ── Answer scoring (transcript facts + AI qualitative review) ────────────────────
export type AnswerScore = {
  transcript: TranscriptStats;
  transcriptNote: string;
  scores: { structure: number; specificity: number; relevance: number; concision: number } | null;
  overall: number | null; // 0–5 when an AI content review ran
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
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  strongerVersion: z.string(),
});

const clamp5 = (n: number) => Math.max(0, Math.min(5, Number.isFinite(n) ? n : 0));

export function overallFromScores(s: {
  structure: number;
  specificity: number;
  relevance: number;
  concision: number;
}): number {
  // Structure and specificity matter most in behavioral answers.
  const weighted =
    s.structure * 0.3 + s.specificity * 0.3 + s.relevance * 0.25 + s.concision * 0.15;
  return Math.round(weighted * 10) / 10;
}

export async function scoreInterviewAnswer(
  userId: string,
  input: { question: string; answer: string; role?: string | null }
): Promise<{ ok: true; score: AnswerScore } | { ok: false; message: string }> {
  const answer = input.answer?.trim() ?? "";
  if (!answer) return { ok: false, message: "Give an answer to score." };
  const transcript = analyzeTranscript(answer);

  const { getUserDocGenerate } = await import("@/lib/ai/user-generate");
  const generate = await getUserDocGenerate(userId);
  if (!generate) {
    // Transcript-only fallback. Do not display zeroes as if the content was judged.
    return {
      ok: true,
      score: {
        transcript,
        transcriptNote: transcriptNote(transcript),
        scores: null,
        overall: null,
        strengths: [],
        improvements: [
          "Connect an AI provider for a content review. Fadi only counted words and possible filler phrases in this transcript.",
        ],
        strongerVersion: "",
      },
    };
  }

  const system = `You are an interview coach scoring ONE answer to ONE question. Score 0–5 on:
- structure: is it a clear STAR arc (situation→task→action→result)?
- specificity: real details, names, numbers, outcomes — not vague adjectives?
- relevance: does it actually answer THIS question for THIS role?
- concision: tight and on-point, not rambling or padded?
Use the same anchors for every dimension: 1 = unsupported or largely missing, 3 = credible but incomplete, 5 = specific, grounded, and strong. Use 0 only when there is no assessable content.
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
        transcript,
        transcriptNote: transcriptNote(transcript),
        scores,
        overall: overallFromScores(scores),
        strengths: raw.strengths.map((s) => s.trim()).filter(Boolean),
        improvements: raw.improvements.map((s) => s.trim()).filter(Boolean),
        strongerVersion: raw.strongerVersion.trim(),
      },
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "the provider call failed";
    logger.warn("interview.score_answer_failed", { userId, error: reason });
    return { ok: false, message: `Couldn't score that answer: ${reason.slice(0, 160)}.` };
  }
}
