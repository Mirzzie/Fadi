import "server-only";

import { randomUUID } from "node:crypto";

import { buildFadiContext } from "@/lib/ai/context/builder";
import { buildFadiMessages } from "@/lib/ai/prompts/system";
import { buildProviderChain } from "@/lib/ai/registry";
import { executeFadiTool, getToolsForUser } from "@/lib/ai/tools/registry";
import {
  getPracticeSession,
  endPracticeSession,
  INTERVIEW_ANSWER_MAX_CHARS,
  INTERVIEW_CONTEXT_MAX_CHARS,
  isEndCommand,
  isMeaningfulAnswer,
  type PracticeSession,
} from "@/lib/interview/practice-session";
import { toolsForTurn } from "@/lib/ai/tools/routing";
import { toToolSpec, type FadiToolContext } from "@/lib/ai/tools/types";
import { getUserDocGenerate } from "@/lib/ai/user-generate";
import { getUserProviderConfigs } from "@/lib/ai/user-settings";
import { getKv } from "@/lib/kv/store";
import { logger } from "@/lib/observability/logger";

import { readBack, toSpeech } from "./speech";
import { positionSaid, refsFrom, withPositionsResolved, type VoiceRef } from "./voice-refs";

/**
 * ONE SPOKEN TURN, ANSWERED BY FADI ITSELF.
 *
 * Buddy used to pick Fadi's tools with a small local model that knew nothing about the person —
 * not their direction, saved roles or last question — and its own measurements show the cost:
 * a project step completed with an invented id, requests routed to the wrong tool. Here the words
 * go to Fadi's own agent instead: the same context, prompt, tools and provider chain as Fadi's
 * chat, so "find remote junior security roles in Dublin that sponsor visas" is understood with
 * everything Fadi knows.
 *
 * What is different for a voice caller, and enforced here rather than trusted to the client:
 * - Read tools run. A tool that changes something does NOT run: it is held, and the model is told
 *   so, and the turn returns a pending action that only an explicit "confirm" executes. One held
 *   change per turn.
 * - Tools that touch a machine (risk "external") and UI-only tools are not offered at all.
 * - The answer is shaped for the ear (toSpeech) and conversation history is kept per caller
 *   context, briefly, so "save the second one" follows "find me roles" — but never a live
 *   interview answer (interviewTurn).
 */

const HISTORY_TTL_S = 30 * 60;
const PENDING_TTL_S = 5 * 60;
const HISTORY_TURNS = 8;
/** One spoken request. A live interview answer is the one exception (INTERVIEW_ANSWER_MAX_CHARS). */
export const VOICE_TEXT_MAX_CHARS = 500;
/**
 * Coaching plus the whole next question, said whole: Buddy plays a reply up to this length in
 * sentence-bounded chunks. Longer is refused out loud, never cut — a cut drops the question.
 */
export const INTERVIEW_SPOKEN_MAX_CHARS = 6000;
const NOT_BY_VOICE = new Set(["open_page"]);

const VOICE_STYLE = [
  "THIS ANSWER IS SPOKEN ALOUD by the person's voice assistant (Buddy), not read on a screen.",
  "Answer in at most three short sentences of plain speech: no markdown, lists, headings, URLs or emoji.",
  "Say numbers and job titles naturally. When you found several items, name the best one or two and say the rest are on their Opportunities page.",
  "When the person picks an item by position ('the second one', 'the last one'), pass exactly those words as the tool argument; Fadi knows the order it read them out in.",
  "If a tool result says it is waiting for the person's confirmation, say exactly what you will do and ask them to say confirm or cancel. Never claim it is done.",
].join(" ");

export type PendingAction = {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  readBack: string;
  contextId: string;
};

/** A live multi-turn flow (e.g. a spoken mock interview) tells the voice client what to do next. */
export type InterviewMarker = { state: string; index?: number; total?: number };

export type VoiceTurn = {
  speech: string;
  contextId: string;
  pending: PendingAction | null;
  tools: string[];
  /** Set when a session tool (interview_practice) is mid-flow, so Buddy can run its answer loop. */
  interview: InterviewMarker | null;
};

type Turn = { role: "user" | "assistant"; content: string };

const historyKey = (userId: string, contextId: string) => `voice:ctx:${userId}:${contextId}`;
const pendingKey = (userId: string, id: string) => `voice:pending:${userId}:${id}`;
const refsKey = (userId: string, contextId: string) => `voice:refs:${userId}:${contextId}`;

async function readRefs(userId: string, contextId: string): Promise<VoiceRef[]> {
  try {
    const raw = await getKv().get(refsKey(userId, contextId));
    return raw ? (JSON.parse(raw) as VoiceRef[]) : [];
  } catch {
    return [];
  }
}

async function readHistory(userId: string, contextId: string): Promise<Turn[]> {
  try {
    const raw = await getKv().get(historyKey(userId, contextId));
    return raw ? (JSON.parse(raw) as Turn[]) : [];
  } catch {
    return [];
  }
}

async function writeHistory(userId: string, contextId: string, turns: Turn[]): Promise<void> {
  await getKv().set(
    historyKey(userId, contextId),
    JSON.stringify(turns.slice(-HISTORY_TURNS * 2)),
    HISTORY_TTL_S
  );
}

export async function runVoiceTurn(
  userId: string,
  input: { text: string; contextId?: string | null }
): Promise<VoiceTurn> {
  const contextId = (input.contextId?.trim() || randomUUID()).slice(0, INTERVIEW_CONTEXT_MAX_CHARS);
  const said = input.text.trim();

  // A LIVE SESSION OWNS THE TURN. Live testing (12 Oct) showed that once a mock interview is
  // running, even a capable model does not reliably re-invoke interview_practice for the next
  // spoken answer — it just chats back a new question, so no coaching is produced and the session
  // never advances. While a session exists, route the whole utterance to it deterministically,
  // which also skips an unneeded provider round-trip.
  let liveSession: PracticeSession | null;
  try {
    liveSession = await getPracticeSession(userId, contextId);
  } catch (error) {
    // Do not reinterpret an interview answer as an ordinary command when the session store is
    // unavailable. That could turn words inside an answer into an unrelated tool or plan.
    logger.warn("voice.interview_state_unavailable", {
      userId,
      error: error instanceof Error ? error.name : "unknown",
    });
    return {
      speech:
        "I can't verify the interview state just now, so I haven't used those words for anything. Try that answer again in a moment.",
      contextId,
      pending: null,
      tools: [],
      interview: { state: "unavailable" },
    };
  }
  if (liveSession) return interviewTurn(userId, contextId, said, liveSession);

  // Said, not cut: a request trimmed to its first 500 characters is a different request.
  if (said.length > VOICE_TEXT_MAX_CHARS) {
    return {
      speech:
        "That was too long for me to take by voice. Say it more briefly, or write it in Fadi.",
      contextId,
      pending: null,
      tools: [],
      interview: null,
    };
  }
  const text = said;

  const context = await buildFadiContext(userId, { includeLiveMarket: true }).catch(() => null);
  if (!context) {
    return {
      speech:
        "Fadi needs your target role and career history first. Set them up in Fadi, then ask me again.",
      contextId,
      pending: null,
      tools: [],
      interview: null,
    };
  }

  const history = await readHistory(userId, contextId);
  // The last list Fadi read out in this conversation, so "the second one" can be counted.
  let refs = await readRefs(userId, contextId);
  let refsChanged = false;
  const messages = buildFadiMessages(context, history, text, VOICE_STYLE);

  const all = (await getToolsForUser(userId)).filter(
    (tool) => tool.risk !== "external" && !NOT_BY_VOICE.has(tool.name)
  );
  const tools = toolsForTurn(all, { pathname: null, message: text }).map(toToolSpec);
  const byName = new Map(all.map((tool) => [tool.name, tool]));

  const generate = (await getUserDocGenerate(userId)) ?? undefined;
  const ctx: FadiToolContext = { userId, surface: "agent", workItemId: null, generate, contextId };

  let pending: PendingAction | null = null;
  let interview: InterviewMarker | null = null;
  const used: string[] = [];
  // What the tools said, for when the model runs them and then says nothing itself.
  const summaries: string[] = [];
  const executor = async (name: string, said: Record<string, unknown>) => {
    used.push(name);
    const tool = byName.get(name);
    if (!tool) return { summary: `"${name}" is not available by voice.`, isError: true };
    const args = withPositionsResolved(said, refs);
    // "Save the second one": the person's own words decide which item, not the model's guess.
    const picked = tool.target ? positionSaid(text, refs) : null;
    if (picked && tool.target) args[tool.target] = picked;
    if (tool.risk === "read") {
      const result = await executeFadiTool(name, args, ctx);
      // Heard, not read: a tool's spoken version when it has one.
      summaries.push(result.spoken ?? result.summary);
      const marker = (result.data as { interview?: InterviewMarker } | undefined)?.interview;
      if (marker && typeof marker.state === "string") interview = marker;
      const listed = refsFrom(result.data);
      if (listed) {
        refs = listed;
        refsChanged = true;
      }
      return result;
    }
    // A change: hold it for the person's spoken confirmation instead of doing it.
    if (pending) {
      return { summary: "Only one change at a time by voice. Ask about the next one after this." };
    }
    // A tool that can say exactly what it will touch does so now, and its confirmation is pinned
    // to that record: "save the Deerfoot role" is read back as the role found, by its full name,
    // and a name that matches nothing (or two things) is asked about instead of held.
    const prepared =
      tool.risk === "write" && tool.prepare
        ? await tool.prepare(args, ctx).catch(() => ({
            ok: false as const,
            summary: "I couldn't look that up just now. Try again in a moment.",
          }))
        : null;
    if (prepared && !prepared.ok) {
      summaries.push(prepared.summary);
      return { summary: prepared.summary };
    }
    pending = prepared
      ? {
          id: randomUUID(),
          tool: name,
          args: prepared.args,
          readBack: prepared.readBack,
          contextId,
        }
      : { id: randomUUID(), tool: name, args, readBack: readBack(name, args), contextId };
    return {
      summary: `NOT DONE YET — waiting for the person's spoken confirmation. Planned: ${pending.readBack}.`,
    };
  };

  const chain = buildProviderChain(await getUserProviderConfigs(userId)).filter(
    (provider) => typeof provider.runWithTools === "function"
  );
  let answer = "";
  for (const provider of chain) {
    try {
      const result = await provider.runWithTools!(messages, tools, executor, { temperature: 0.4 });
      answer = result.text.trim() || summaries.join(" ");
      break;
    } catch (error) {
      logger.warn("voice.turn_provider_failed", {
        userId,
        provider: provider.id,
        // The class only: a provider's message can echo the prompt, which holds the person's words.
        error: error instanceof Error ? error.name : "unknown",
      });
    }
  }
  if (!answer) answer = "Fadi couldn't reach its AI provider just now. Try again in a moment.";

  const held = pending as PendingAction | null;
  // GROUNDED SPEECH. The first live turn (5 Oct 2026, llama3.2 3B) answered "find remote junior
  // security jobs in Dublin" with a job description no tool had returned — Buddy's own team
  // measured the same: small models narrating results add claims. So when a tool ran, what is
  // spoken is Fadi's own summary of the result, and a held change is read back exactly. The
  // model's own words are spoken only for a plain question no tool answered.
  if (held) answer = `I can ${held.readBack}. Shall I?`;
  else if (summaries.length > 0) answer = summaries.join(" ");
  if (held) {
    await getKv().set(pendingKey(userId, held.id), JSON.stringify(held), PENDING_TTL_S);
  }
  if (refsChanged) {
    await getKv().set(refsKey(userId, contextId), JSON.stringify(refs.slice(0, 12)), HISTORY_TTL_S);
  }
  const speech = toSpeech(answer);
  await writeHistory(userId, contextId, [
    ...history,
    { role: "user", content: text },
    { role: "assistant", content: speech },
  ]);
  logger.info("voice.turn", { userId, tools: used.join(","), held: held?.tool ?? null });
  return { speech, contextId, pending: held, tools: used, interview };
}

/**
 * One turn of a live spoken interview: the answer is coached and the next question asked, or a
 * stop phrase ends it. No model chooses anything here and nothing reaches a provider except the
 * answer's own scoring — ending is free.
 *
 * PRIVACY: an interview answer is NOT written to the conversation history. Answers carry the most
 * personal detail anyone tells Fadi; the scorer reads it once and practice-session stores only
 * the coaching. The coaching reply is left out too, since it is model output about the answer.
 */
async function interviewTurn(
  userId: string,
  contextId: string,
  said: string,
  session: PracticeSession
): Promise<VoiceTurn> {
  const reply = (speech: string, interview: InterviewMarker | null): VoiceTurn => ({
    speech,
    contextId,
    pending: null,
    tools: ["interview_practice"],
    interview,
  });
  // Still on the same question: Buddy keeps listening for the answer.
  const sameQuestion: InterviewMarker = {
    state: session.index < session.questions.length ? "awaiting_answer" : "awaiting_end",
    index: session.index,
    total: session.questions.length,
  };
  if (said.length > INTERVIEW_ANSWER_MAX_CHARS) {
    return reply(
      "That answer ran longer than I can take in one go. Try it again a little shorter — a few minutes at most.",
      sameQuestion
    );
  }
  const ending = isEndCommand(said);
  if (!ending && !isMeaningfulAnswer(said)) {
    return reply(
      "I didn't catch an answer there. Give it another go when you're ready.",
      sameQuestion
    );
  }

  const generate = ending ? undefined : ((await getUserDocGenerate(userId)) ?? undefined);
  const ctx: FadiToolContext = { userId, surface: "agent", workItemId: null, generate, contextId };
  const result = await executeFadiTool(
    "interview_practice",
    ending ? { action: "end" } : { answer: said },
    ctx
  ).catch(() => ({
    summary: "I couldn't score that answer just now. Try it again in a moment.",
    spoken: undefined,
    data: undefined,
  }));
  const line = result.spoken ?? result.summary ?? "Okay.";
  const marker = (result.data as { interview?: InterviewMarker } | undefined)?.interview ?? null;
  logger.info("voice.turn", { userId, tools: "interview_practice", held: null });

  // A turn that did not finish (the scorer unavailable, an end that didn't close) leaves the
  // session where it was. Say why, and keep Buddy on the same question rather than dropping out
  // of the interview while it is still live — or claiming it moved on or ended when it didn't.
  const finished = ending ? marker?.state === "done" : marker !== null;
  if (!finished) {
    const still = await getPracticeSession(userId, contextId).catch(() => null);
    return reply(toSpeech(line), still ? sameQuestion : null);
  }

  // The coaching AND the next question are said in full: no word cut. The general sixty-word cut
  // stopped at a sentence end inside the coaching and dropped the question the person has to
  // answer next. Too long to say is said plainly instead of cut; the session has moved on, so the
  // marker does too.
  const speech = toSpeech(line, Number.POSITIVE_INFINITY);
  if (speech.length > INTERVIEW_SPOKEN_MAX_CHARS) {
    try {
      await endPracticeSession(userId, contextId);
      return reply(
        "The next question was too long to say aloud, so I stopped this practice session rather than ask you to answer a question you haven't heard. Start a new interview with shorter questions.",
        { state: "done" }
      );
    } catch {
      return reply(
        "The next question is too long to speak, and I couldn't verify that the session ended. Say stop to retry ending it; don't answer an unheard question.",
        marker
      );
    }
  }
  return reply(speech, marker);
}

/** A held change, while it is still waiting (five minutes). */
export async function getPendingAction(userId: string, id: string): Promise<PendingAction | null> {
  try {
    const raw = await getKv().get(pendingKey(userId, id));
    return raw ? (JSON.parse(raw) as PendingAction) : null;
  } catch {
    return null;
  }
}

/**
 * Do the held change, once. The pending record is deleted before running, so a second confirm
 * (a retry) finds nothing to do rather than doing it twice.
 */
export async function confirmPendingAction(
  userId: string,
  id: string
): Promise<{ ok: true; speech: string } | { ok: false; speech: string }> {
  const kv = getKv();
  const raw = await kv.get(pendingKey(userId, id));
  if (!raw) return { ok: false, speech: "That request has expired. Ask Fadi again." };
  const action = JSON.parse(raw) as PendingAction;
  await kv.del(pendingKey(userId, id));
  const generate = (await getUserDocGenerate(userId)) ?? undefined;
  const result = await executeFadiTool(action.tool, action.args, {
    userId,
    surface: "agent",
    workItemId: null,
    generate,
  });
  const speech = toSpeech(result.spoken || result.summary || "Done.");
  const history = await readHistory(userId, action.contextId);
  await writeHistory(userId, action.contextId, [
    ...history,
    { role: "user", content: "confirm" },
    { role: "assistant", content: speech },
  ]);
  return result.isError ? { ok: false, speech } : { ok: true, speech };
}

export async function cancelPendingAction(userId: string, id: string): Promise<void> {
  await getKv().del(pendingKey(userId, id));
}
