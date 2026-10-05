/**
 * Fadi as an A2A 1.0 agent — the door a voice client (Buddy) uses to hand Fadi a piece of work.
 *
 * The protocol layer only, like lib/mcp/server.ts: the route injects the work kernel, so this
 * stays pure and testable. A task IS a plan (task id = plan id, context id = its goal), and the
 * kernel's rules are not relaxed for a caller that speaks instead of presses:
 *
 *  - One line in is an intent, resolved exactly as the intent bar resolves it. When Fadi cannot
 *    NAME what it would work on, it answers with a message and creates nothing.
 *  - A new plan starts `open` and is named back (TASK_STATE_AUTH_REQUIRED). Only "approve" lets it act.
 *  - One step per message. After every step the task waits on the person (TASK_STATE_INPUT_REQUIRED),
 *    because the fit check in the middle exists so that one honest answer can be "don't apply".
 *  - The person's own steps ("you submit") are theirs: Fadi only records that they said it is done.
 */

export const A2A_VERSION = "1.0";
export const A2A_VERSION_NOT_SUPPORTED = -32009;
const RPC_METHOD_NOT_FOUND = -32601;
const RPC_INVALID_PARAMS = -32602;

export type A2AState =
  | "TASK_STATE_SUBMITTED"
  | "TASK_STATE_WORKING"
  | "TASK_STATE_INPUT_REQUIRED"
  | "TASK_STATE_AUTH_REQUIRED"
  | "TASK_STATE_COMPLETED"
  | "TASK_STATE_FAILED"
  | "TASK_STATE_CANCELED"
  | "TASK_STATE_REJECTED";

export type A2APart = { text: string };
export type A2AMessage = {
  messageId: string;
  role: "ROLE_USER" | "ROLE_AGENT";
  parts: A2APart[];
  taskId?: string;
  contextId?: string;
};
export type A2ATask = {
  id: string;
  contextId?: string;
  status: { state: A2AState; message?: A2AMessage; timestamp: string };
  artifacts?: { artifactId: string; name: string; parts: A2APart[] }[];
};

/** What the protocol needs to know about a plan — ids and words, never career records. */
export type PlanView = {
  id: string;
  title: string;
  status: string; // open | active | blocked | done | dropped
  goalId: string | null;
  steps: { title: string; status: string; reason: string; detail: string; personal: boolean }[];
};

export type A2ADeps = {
  resolve: (
    text: string
  ) => Promise<
    | { kind: "plan"; template: string; label: string; refs: { type: string; id: string }[] }
    | { kind: "none" }
  >;
  open: (
    template: string,
    refs: { type: string; id: string }[]
  ) => Promise<{ ok: true; planId: string } | { ok: false; reason: string }>;
  plan: (id: string) => Promise<PlanView | null>;
  approve: (id: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
  advance: (id: string) => Promise<{ state: string; summary?: string; reason?: string }>;
  markPersonalDone: (id: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
  stop: (id: string) => Promise<void>;
  /**
   * Hold the plan while one action runs on it; null when another is still running. A step can
   * take tens of seconds (drafting), and a voice client that times out and retries must not
   * start the same step twice.
   */
  claim?: (id: string) => Promise<(() => Promise<void>) | null>;
  /**
   * True when this messageId was already acted on. A2A requires a messageId on every message,
   * so a retried "continue" is recognised as the same message instead of a second step.
   */
  seen?: (messageId: string) => Promise<boolean>;
  newId?: () => string;
  now?: () => Date;
};

export type JsonRpcId = string | number | null;
export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};
export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
  | { jsonrpc: "2.0"; id: JsonRpcId; error: { code: number; message: string } };

const APPROVE = /^(?:approve|approved|start|start it|yes|go ahead|confirm)$/;
const CONTINUE = /^(?:continue|next|next step|go on|carry on|keep going|try again)$/;
const DONE =
  /^(?:done|i did it|i've done it|it'?s done|finished|i finished|submitted|i submitted it)$/;
const STOP = /^(?:stop|cancel|stop it|drop it|not now)$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function agentMessage(
  text: string,
  deps: A2ADeps,
  task?: { id: string; contextId?: string }
): A2AMessage {
  return {
    messageId: deps.newId ? deps.newId() : crypto.randomUUID(),
    role: "ROLE_AGENT",
    parts: [{ text }],
    ...(task ? { taskId: task.id, ...(task.contextId ? { contextId: task.contextId } : {}) } : {}),
  };
}

/** The plan as an A2A task: its state and the sentence a voice client can say out loud. */
export function taskFor(
  plan: PlanView,
  deps: A2ADeps,
  note?: string,
  override?: { state: A2AState; text: string }
): A2ATask {
  const base = { id: plan.id, ...(plan.goalId ? { contextId: plan.goalId } : {}) };
  const next = plan.steps.find((step) => step.status !== "done" && step.status !== "dropped");
  let state: A2AState;
  let text: string;
  if (plan.status === "open") {
    state = "TASK_STATE_AUTH_REQUIRED";
    text = `Fadi will: ${plan.title}. Say approve to start, or stop.`;
  } else if (plan.status === "done" || (plan.status === "active" && !next)) {
    state = "TASK_STATE_COMPLETED";
    text = `${plan.title}: every step is done.`;
  } else if (plan.status === "dropped") {
    state = "TASK_STATE_CANCELED";
    text = `${plan.title} was stopped.`;
  } else if (next?.status === "blocked") {
    state = "TASK_STATE_INPUT_REQUIRED";
    text = `Stopped at ${next.title}: ${next.reason || "it needs you"}. Say continue to try again, or stop.`;
  } else if (next?.personal) {
    state = "TASK_STATE_INPUT_REQUIRED";
    text = `Your turn: ${next.title}. Say done when you have done it, or stop.`;
  } else {
    state = "TASK_STATE_INPUT_REQUIRED";
    text = `Next: ${next?.title ?? "the next step"}. Say continue to let Fadi do it, or stop.`;
  }
  if (override) {
    state = override.state;
    text = override.text;
  }
  const finished = plan.steps.filter((step) => step.status === "done" && step.detail);
  return {
    ...base,
    status: {
      state,
      message: agentMessage(note ? `${note} ${text}` : text, deps, base),
      timestamp: (deps.now ? deps.now() : new Date()).toISOString(),
    },
    ...(state === "TASK_STATE_COMPLETED" && finished.length
      ? {
          artifacts: [
            {
              artifactId: `${plan.id}-summary`,
              name: "What Fadi did",
              parts: [
                {
                  text: finished
                    .map((step) => `${step.title}: ${step.detail}`)
                    .join(" ")
                    .slice(0, 2000),
                },
              ],
            },
          ],
        }
      : {}),
  };
}

function textOf(message: unknown): string | null {
  if (!message || typeof message !== "object") return null;
  const parts = (message as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) return null;
  const text = parts
    .map((part) =>
      part && typeof part === "object" && typeof (part as A2APart).text === "string"
        ? (part as A2APart).text
        : ""
    )
    .join(" ")
    .trim();
  return text && text.length <= 500 ? text : null;
}

/** A message on an existing task: approve, continue, done or stop — one action per message. */
async function continueTask(plan: PlanView, command: string, deps: A2ADeps): Promise<A2ATask> {
  const acts =
    (plan.status === "open" && APPROVE.test(command)) ||
    (plan.status === "active" && (CONTINUE.test(command) || DONE.test(command)));
  // One action at a time on a plan; a second arrives while the first is still running.
  const release = acts && deps.claim ? await deps.claim(plan.id) : undefined;
  if (release === null) {
    return taskFor(plan, deps, undefined, {
      state: "TASK_STATE_WORKING",
      text: `Fadi is still working on ${plan.title}. Ask again in a moment.`,
    });
  }
  try {
    return await act(plan, command, deps);
  } finally {
    await release?.();
  }
}

async function act(plan: PlanView, command: string, deps: A2ADeps): Promise<A2ATask> {
  let note: string | undefined;
  if (STOP.test(command)) {
    await deps.stop(plan.id);
  } else if (plan.status === "open" && APPROVE.test(command)) {
    const approved = await deps.approve(plan.id);
    if (!approved.ok) note = approved.reason;
    else {
      const outcome = await deps.advance(plan.id);
      note = outcome.summary ?? outcome.reason;
    }
  } else if (plan.status === "active" && APPROVE.test(command)) {
    // Already approved. Treating a second "approve" as "continue" let a client's retry of its
    // approval run the next step as well; only "continue" moves the plan on.
    note = "Already started.";
  } else if (plan.status === "active" && CONTINUE.test(command)) {
    const outcome = await deps.advance(plan.id);
    note = outcome.summary ?? outcome.reason;
  } else if (plan.status === "active" && DONE.test(command)) {
    const marked = await deps.markPersonalDone(plan.id);
    note = marked.ok ? "Noted." : marked.reason;
  } else {
    note = "Say approve, continue, done or stop.";
  }
  const after = (await deps.plan(plan.id)) ?? plan;
  return taskFor(after, deps, note?.slice(0, 600));
}

/** Handle one JSON-RPC message. Returns null for a notification (no id). */
export async function handleA2AMessage(
  request: JsonRpcRequest,
  deps: A2ADeps
): Promise<JsonRpcResponse | null> {
  const { id, method, params } = request;
  if (id === undefined) return null;
  const ok = (result: unknown): JsonRpcResponse => ({ jsonrpc: "2.0", id, result });
  const fail = (code: number, message: string): JsonRpcResponse => ({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });

  if (method === "a2a.GetTask" || method === "a2a.CancelTask") {
    const taskId = typeof params?.id === "string" ? params.id : "";
    const plan = UUID.test(taskId) ? await deps.plan(taskId) : null;
    if (!plan) return fail(-32001, "Task not found");
    if (method === "a2a.CancelTask") {
      if (plan.status !== "done" && plan.status !== "dropped") await deps.stop(plan.id);
      return ok(taskFor((await deps.plan(plan.id)) ?? plan, deps));
    }
    return ok(taskFor(plan, deps));
  }

  if (method !== "a2a.SendMessage") return fail(RPC_METHOD_NOT_FOUND, `Unknown method: ${method}`);
  const message = params?.message as { role?: unknown; taskId?: unknown } | undefined;
  const text = textOf(message);
  if (!message || message.role !== "ROLE_USER" || !text) {
    return fail(
      RPC_INVALID_PARAMS,
      "message needs role ROLE_USER and one text part of at most 500 characters"
    );
  }

  if (typeof message.taskId === "string") {
    const plan = UUID.test(message.taskId) ? await deps.plan(message.taskId) : null;
    if (!plan) return fail(-32001, "Task not found");
    // The same message again (a retry): report where the task is, act on nothing.
    const messageId = (message as { messageId?: unknown }).messageId;
    if (typeof messageId === "string" && deps.seen && (await deps.seen(messageId))) {
      return ok(taskFor(plan, deps));
    }
    return ok(
      await continueTask(
        plan,
        text
          .toLowerCase()
          .replace(/[.!?]+$/, "")
          .trim(),
        deps
      )
    );
  }

  // A new line is an intent, resolved deterministically. No name, no task — and no guess.
  const intent = await deps.resolve(text);
  if (intent.kind === "none") {
    return ok(
      agentMessage(
        "Fadi does not have a plan for that yet. Right now it can apply to a role you have saved, for example: apply to the Deerfoot role.",
        deps
      )
    );
  }
  const opened = await deps.open(intent.template, intent.refs);
  if (!opened.ok) return ok(agentMessage(opened.reason, deps));
  const plan = await deps.plan(opened.planId);
  if (!plan) return fail(-32603, "Plan was not created");
  return ok(taskFor(plan, deps));
}
