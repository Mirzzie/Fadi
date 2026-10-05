import { describe, expect, it } from "vitest";

import { handleA2AMessage, type A2ADeps, type PlanView } from "./server";

const PLAN_ID = "11111111-1111-4111-8111-111111111111";
const GOAL_ID = "22222222-2222-4222-8222-222222222222";

/** An in-memory work kernel: one apply-to-role plan with a person's step at the end. */
function kernel() {
  const plans = new Map<string, PlanView>();
  const calls: string[] = [];
  const deps: A2ADeps = {
    newId: () => "msg-1",
    now: () => new Date("2026-10-03T21:00:00Z"),
    resolve: async (text) =>
      /apply to the deerfoot role/i.test(text)
        ? {
            kind: "plan",
            template: "apply-to-role",
            label: "Apply to Deerfoot — Backend Engineer",
            refs: [{ type: "job", id: "job-1" }],
          }
        : { kind: "none" },
    open: async () => {
      calls.push("open");
      plans.set(PLAN_ID, {
        id: PLAN_ID,
        title: "Apply to Deerfoot — Backend Engineer",
        status: "open",
        goalId: GOAL_ID,
        steps: [
          {
            title: "Check the posting is still open",
            status: "open",
            reason: "",
            detail: "",
            personal: false,
          },
          { title: "Check fit", status: "open", reason: "", detail: "", personal: false },
          {
            title: "You submit the application",
            status: "open",
            reason: "",
            detail: "",
            personal: true,
          },
        ],
      });
      return { ok: true, planId: PLAN_ID };
    },
    plan: async (id) => plans.get(id) ?? null,
    approve: async (id) => {
      calls.push("approve");
      plans.get(id)!.status = "active";
      return { ok: true };
    },
    advance: async (id) => {
      calls.push("advance");
      const plan = plans.get(id)!;
      const next = plan.steps.find((step) => step.status !== "done")!;
      next.status = "done";
      next.detail = `${next.title} — fine`;
      return { state: "ran", summary: `${next.title}: fine.` };
    },
    markPersonalDone: async (id) => {
      calls.push("done");
      const next = plans.get(id)!.steps.find((step) => step.status !== "done")!;
      if (!next.personal)
        return { ok: false, reason: "The next step is one Fadi does. Say continue instead." };
      next.status = "done";
      plans.get(id)!.status = "done";
      return { ok: true };
    },
    stop: async (id) => {
      calls.push("stop");
      plans.get(id)!.status = "dropped";
    },
  };
  return { deps, calls, plans };
}

function send(text: string, taskId?: string) {
  return {
    jsonrpc: "2.0" as const,
    id: 1,
    method: "a2a.SendMessage",
    params: {
      message: {
        messageId: "m",
        role: "ROLE_USER",
        parts: [{ text }],
        ...(taskId ? { taskId } : {}),
      },
    },
  };
}

function stateOf(response: unknown): string {
  return (response as { result: { status: { state: string } } }).result.status.state;
}

function said(response: unknown): string {
  return (response as { result: { status: { message: { parts: { text: string }[] } } } }).result
    .status.message.parts[0].text;
}

describe("Fadi A2A endpoint", () => {
  it("answers an intent it cannot name with a message and creates nothing", async () => {
    const { deps, calls } = kernel();
    const response = await handleA2AMessage(send("prepare me for the Stripe interview"), deps);
    expect((response as { result: { parts: { text: string }[] } }).result.parts[0].text).toMatch(
      /does not have a plan for that yet/
    );
    expect(calls).toEqual([]);
  });

  it("names a new plan back and waits for approval before anything runs", async () => {
    const { deps, calls } = kernel();
    const response = await handleA2AMessage(send("Apply to the Deerfoot role"), deps);
    expect(stateOf(response)).toBe("TASK_STATE_AUTH_REQUIRED");
    expect(said(response)).toBe(
      "Fadi will: Apply to Deerfoot — Backend Engineer. Say approve to start, or stop."
    );
    expect((response as { result: { id: string; contextId: string } }).result).toMatchObject({
      id: PLAN_ID,
      contextId: GOAL_ID,
    });
    expect(calls).toEqual(["open"]);
  });

  it("runs exactly one step per message and leaves the person's step to them", async () => {
    const { deps, calls } = kernel();
    await handleA2AMessage(send("Apply to the Deerfoot role"), deps);
    let response = await handleA2AMessage(send("approve", PLAN_ID), deps);
    expect(calls).toEqual(["open", "approve", "advance"]);
    expect(stateOf(response)).toBe("TASK_STATE_INPUT_REQUIRED");
    expect(said(response)).toBe(
      "Check the posting is still open: fine. Next: Check fit. Say continue to let Fadi do it, or stop."
    );
    response = await handleA2AMessage(send("Continue.", PLAN_ID), deps);
    expect(said(response)).toMatch(/Your turn: You submit the application\. Say done/);
    expect(calls.filter((call) => call === "advance")).toHaveLength(2);
    const { deps: fresh } = kernel();
    await handleA2AMessage(send("Apply to the Deerfoot role"), fresh);
    await handleA2AMessage(send("approve", PLAN_ID), fresh);
    await handleA2AMessage(send("continue", PLAN_ID), fresh);
    response = await handleA2AMessage(send("done", PLAN_ID), fresh);
    expect(stateOf(response)).toBe("TASK_STATE_COMPLETED");
    expect(
      (response as { result: { artifacts: { parts: { text: string }[] }[] } }).result.artifacts[0]
        .parts[0].text
    ).toContain("Check fit — fine");
  });

  it("does not let 'done' skip a step Fadi has to do", async () => {
    const { deps } = kernel();
    await handleA2AMessage(send("Apply to the Deerfoot role"), deps);
    await handleA2AMessage(send("approve", PLAN_ID), deps);
    const response = await handleA2AMessage(send("done", PLAN_ID), deps);
    expect(said(response)).toMatch(/^The next step is one Fadi does/);
  });

  it("gets, cancels and stops tasks", async () => {
    const { deps, calls } = kernel();
    await handleA2AMessage(send("Apply to the Deerfoot role"), deps);
    const got = await handleA2AMessage(
      { jsonrpc: "2.0", id: 2, method: "a2a.GetTask", params: { id: PLAN_ID } },
      deps
    );
    expect(stateOf(got)).toBe("TASK_STATE_AUTH_REQUIRED");
    const cancelled = await handleA2AMessage(
      { jsonrpc: "2.0", id: 3, method: "a2a.CancelTask", params: { id: PLAN_ID } },
      deps
    );
    expect(stateOf(cancelled)).toBe("TASK_STATE_CANCELED");
    expect(calls).toEqual(["open", "stop"]);
  });

  it("refuses malformed messages, unknown tasks and unknown methods", async () => {
    const { deps } = kernel();
    const bad = await handleA2AMessage(
      {
        jsonrpc: "2.0",
        id: 4,
        method: "a2a.SendMessage",
        params: { message: { role: "ROLE_AGENT", parts: [{ text: "hi" }] } },
      },
      deps
    );
    expect(bad).toMatchObject({ error: { code: -32602 } });
    const long = await handleA2AMessage(send("x".repeat(501)), deps);
    expect(long).toMatchObject({ error: { code: -32602 } });
    const missing = await handleA2AMessage(
      send("continue", "33333333-3333-4333-8333-333333333333"),
      deps
    );
    expect(missing).toMatchObject({ error: { code: -32001 } });
    const notUuid = await handleA2AMessage(
      { jsonrpc: "2.0", id: 5, method: "a2a.GetTask", params: { id: "../plans" } },
      deps
    );
    expect(notUuid).toMatchObject({ error: { code: -32001 } });
    const unknown = await handleA2AMessage(
      { jsonrpc: "2.0", id: 6, method: "tasks/send", params: {} },
      deps
    );
    expect(unknown).toMatchObject({ error: { code: -32601 } });
    expect(await handleA2AMessage({ jsonrpc: "2.0", method: "a2a.GetTask" }, deps)).toBeNull();
  });
});

describe("retries and overlapping requests", () => {
  const withId = (text: string, messageId: string, taskId = PLAN_ID) => {
    const message = send(text, taskId);
    message.params.message.messageId = messageId;
    return message;
  };

  it("does not run a step when a client retries its approval", async () => {
    const { deps, calls } = kernel();
    await handleA2AMessage(send("apply to the Deerfoot role"), deps);
    await handleA2AMessage(withId("approve", "a1"), deps);
    const retry = await handleA2AMessage(withId("approve", "a2"), deps);
    expect(calls.filter((call) => call === "advance")).toHaveLength(1);
    expect(said(retry)).toMatch(/^Already started\./);
  });

  it("acts once on the same message delivered twice", async () => {
    const { deps, calls } = kernel();
    const seen = new Set<string>();
    deps.seen = async (id) => (seen.has(id) ? true : (seen.add(id), false));
    await handleA2AMessage(send("apply to the Deerfoot role"), deps);
    await handleA2AMessage(withId("approve", "a1"), deps);
    await handleA2AMessage(withId("continue", "c1"), deps);
    await handleA2AMessage(withId("continue", "c1"), deps);
    expect(calls.filter((call) => call === "advance")).toHaveLength(2); // approve's step + one continue
  });

  it("answers 'still working' instead of starting the step again while one is running", async () => {
    const { deps, calls } = kernel();
    await handleA2AMessage(send("apply to the Deerfoot role"), deps);
    await handleA2AMessage(withId("approve", "a1"), deps);
    deps.claim = async () => null; // another request holds the plan
    const busy = await handleA2AMessage(withId("continue", "c2"), deps);
    expect(stateOf(busy)).toBe("TASK_STATE_WORKING");
    expect(said(busy)).toMatch(/still working/);
    expect(calls.filter((call) => call === "advance")).toHaveLength(1);
  });

  it("releases the plan after acting, even when the step throws", async () => {
    const { deps } = kernel();
    let released = 0;
    deps.claim = async () => async () => {
      released++;
    };
    await handleA2AMessage(send("apply to the Deerfoot role"), deps);
    deps.advance = async () => {
      throw new Error("provider down");
    };
    await expect(handleA2AMessage(withId("approve", "a1"), deps)).rejects.toThrow("provider down");
    expect(released).toBe(1);
  });
});

describe("talking to Fadi's agent", () => {
  const CHANGE = "33333333-3333-4333-8333-333333333333";

  function voice() {
    const k = kernel();
    const held = new Map<string, import("./server").HeldChange>();
    let confirmed = 0;
    k.deps.converse = async (text, contextId) => {
      if (/log|track|save/i.test(text)) {
        held.set(CHANGE, {
          id: CHANGE,
          contextId: contextId ?? "ctx-1",
          readBack: "track application — company: Stripe",
          state: "waiting",
          speech: "I'll log your Stripe application.",
          tool: "track_application",
        });
        return {
          speech: "I'll log your Stripe application.",
          contextId: contextId ?? "ctx-1",
          pending: {
            id: CHANGE,
            readBack: "track application — company: Stripe",
            tool: "track_application",
          },
        };
      }
      return {
        speech: "Two junior security roles in Dublin fit you best.",
        contextId: contextId ?? "ctx-1",
        pending: null,
      };
    };
    k.deps.heldChange = async (id) => held.get(id) ?? null;
    k.deps.confirmChange = async (id) => {
      confirmed++;
      held.set(id, { ...held.get(id)!, state: "done", speech: "Logged Stripe as applied." });
      return { ok: true, speech: "Logged Stripe as applied." };
    };
    k.deps.cancelChange = async (id) => {
      held.set(id, {
        ...held.get(id)!,
        state: "cancelled",
        speech: "Cancelled. Nothing was changed.",
      });
    };
    const seen = new Set<string>();
    k.deps.seen = async (id) => (seen.has(id) ? true : (seen.add(id), false));
    return { ...k, held, confirmedCount: () => confirmed };
  }

  const reply = (text: string, messageId: string) => {
    const message = send(text, CHANGE);
    message.params.message.messageId = messageId;
    return message;
  };

  it("answers a question as a message, keeping the conversation id", async () => {
    const { deps } = voice();
    const response = (await handleA2AMessage(
      send("find junior security jobs in Dublin"),
      deps
    )) as {
      result: { parts: { text: string }[]; contextId: string };
    };
    expect(response.result.parts[0]!.text).toMatch(/junior security roles/);
    expect(response.result.contextId).toBe("ctx-1");
  });

  it("holds a change as a task waiting for confirmation, with what it will do", async () => {
    const { deps, confirmedCount } = voice();
    const response = await handleA2AMessage(send("log my Stripe application"), deps);
    expect(stateOf(response)).toBe("TASK_STATE_INPUT_REQUIRED");
    expect(said(response)).toMatch(/Say confirm to do it, or cancel\.$/);
    expect(confirmedCount()).toBe(0);
  });

  it("marks a held change for machines, not only in words", async () => {
    const { deps } = voice();
    const held = (await handleA2AMessage(send("log my Stripe application"), deps)) as {
      result: { metadata: Record<string, Record<string, unknown>> };
    };
    expect(held.result.metadata["fadi.heldChange"]).toEqual({
      version: 1,
      state: "waiting",
      tool: "track_application",
      readBack: "track application — company: Stripe",
      replies: ["confirm", "cancel"],
    });
    const done = (await handleA2AMessage(reply("confirm", "m1"), deps)) as {
      result: { metadata: Record<string, Record<string, unknown>> };
    };
    expect(done.result.metadata["fadi.heldChange"]).toMatchObject({ state: "done", replies: [] });
  });

  it("does the change once on confirm, even when the confirm is retried", async () => {
    const { deps, confirmedCount } = voice();
    await handleA2AMessage(send("log my Stripe application"), deps);
    const done = await handleA2AMessage(reply("confirm", "k1"), deps);
    await handleA2AMessage(reply("confirm", "k1"), deps); // the same message again
    await handleA2AMessage(reply("confirm", "k2"), deps); // a new confirm after it is done
    expect(stateOf(done)).toBe("TASK_STATE_COMPLETED");
    expect(confirmedCount()).toBe(1);
  });

  it("cancels, and asks again on anything that is not confirm or cancel", async () => {
    const { deps, confirmedCount } = voice();
    await handleA2AMessage(send("log my Stripe application"), deps);
    const unclear = await handleA2AMessage(reply("maybe later on", "u1"), deps);
    expect(stateOf(unclear)).toBe("TASK_STATE_INPUT_REQUIRED");
    const cancelled = await handleA2AMessage(reply("cancel", "u2"), deps);
    expect(stateOf(cancelled)).toBe("TASK_STATE_CANCELED");
    expect(confirmedCount()).toBe(0);
  });

  it("reports a held change through GetTask, so a polling client hears the outcome", async () => {
    const { deps } = voice();
    await handleA2AMessage(send("log my Stripe application"), deps);
    await handleA2AMessage(reply("confirm", "k1"), deps);
    const polled = await handleA2AMessage(
      { jsonrpc: "2.0", id: 9, method: "a2a.GetTask", params: { id: CHANGE } },
      deps
    );
    expect(stateOf(polled)).toBe("TASK_STATE_COMPLETED");
    expect(said(polled)).toBe("Logged Stripe as applied.");
  });
});
