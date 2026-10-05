import "server-only";

import { randomUUID } from "node:crypto";

import { buildFadiContext } from "@/lib/ai/context/builder";
import { buildFadiMessages } from "@/lib/ai/prompts/system";
import { buildProviderChain } from "@/lib/ai/registry";
import { executeFadiTool, getToolsForUser } from "@/lib/ai/tools/registry";
import { toolsForTurn } from "@/lib/ai/tools/routing";
import { toToolSpec, type FadiToolContext } from "@/lib/ai/tools/types";
import { getUserDocGenerate } from "@/lib/ai/user-generate";
import { getUserProviderConfigs } from "@/lib/ai/user-settings";
import { getKv } from "@/lib/kv/store";
import { logger } from "@/lib/observability/logger";

import { readBack, toSpeech } from "./speech";

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
 *   context, briefly, so "save the second one" follows "find me roles".
 */

const HISTORY_TTL_S = 30 * 60;
const PENDING_TTL_S = 5 * 60;
const HISTORY_TURNS = 8;
const NOT_BY_VOICE = new Set(["open_page"]);

const VOICE_STYLE = [
  "THIS ANSWER IS SPOKEN ALOUD by the person's voice assistant (Buddy), not read on a screen.",
  "Answer in at most three short sentences of plain speech: no markdown, lists, headings, URLs or emoji.",
  "Say numbers and job titles naturally. When you found several items, name the best one or two and say the rest are on their Opportunities page.",
  "If a tool result says it is waiting for the person's confirmation, say exactly what you will do and ask them to say confirm or cancel. Never claim it is done.",
].join(" ");

export type PendingAction = {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  readBack: string;
  contextId: string;
};

export type VoiceTurn = {
  speech: string;
  contextId: string;
  pending: PendingAction | null;
  tools: string[];
};

type Turn = { role: "user" | "assistant"; content: string };

const historyKey = (userId: string, contextId: string) => `voice:ctx:${userId}:${contextId}`;
const pendingKey = (userId: string, id: string) => `voice:pending:${userId}:${id}`;

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
  const contextId = input.contextId?.trim() || randomUUID();
  const text = input.text.slice(0, 500);

  const context = await buildFadiContext(userId, { includeLiveMarket: true }).catch(() => null);
  if (!context) {
    return {
      speech:
        "Fadi needs your target role and career history first. Set them up in Fadi, then ask me again.",
      contextId,
      pending: null,
      tools: [],
    };
  }

  const history = await readHistory(userId, contextId);
  const messages = buildFadiMessages(context, history, text, VOICE_STYLE);

  const all = (await getToolsForUser(userId)).filter(
    (tool) => tool.risk !== "external" && !NOT_BY_VOICE.has(tool.name)
  );
  const tools = toolsForTurn(all, { pathname: null, message: text }).map(toToolSpec);
  const byName = new Map(all.map((tool) => [tool.name, tool]));

  const generate = (await getUserDocGenerate(userId)) ?? undefined;
  const ctx: FadiToolContext = { userId, surface: "agent", workItemId: null, generate };

  let pending: PendingAction | null = null;
  const used: string[] = [];
  // What the tools said, for when the model runs them and then says nothing itself.
  const summaries: string[] = [];
  const executor = async (name: string, args: Record<string, unknown>) => {
    used.push(name);
    const tool = byName.get(name);
    if (!tool) return { summary: `"${name}" is not available by voice.`, isError: true };
    if (tool.risk === "read") {
      const result = await executeFadiTool(name, args, ctx);
      summaries.push(result.summary);
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
        error: error instanceof Error ? error.message : "unknown",
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
  const speech = toSpeech(answer);
  await writeHistory(userId, contextId, [
    ...history,
    { role: "user", content: text },
    { role: "assistant", content: speech },
  ]);
  logger.info("voice.turn", { userId, tools: used.join(","), held: held?.tool ?? null });
  return { speech, contextId, pending: held, tools: used };
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
  const speech = toSpeech(result.summary || "Done.");
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
