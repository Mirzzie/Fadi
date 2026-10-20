import type { AgentMessage, WorkExecution, WorkItem, WorkOutput } from "@careeros/database";

/** Where an observation was made. The place is part of the claim, not display decoration. */
export type WorkPlace = "host" | "lab" | "browser" | "fadi" | "external";
export type WorkObserver = "person" | "fadi" | "tool" | "external_system";

export type WorkThreadEvent = {
  id: string;
  workItemId: string;
  kind: "work" | "message" | "execution" | "output";
  actor: "person" | "fadi" | "system";
  state:
    | "information"
    | "waiting"
    | "running"
    | "succeeded"
    | "failed"
    | "blocked"
    | "cancelled"
    | "unknown";
  title: string;
  detail: string;
  occurredAt: string;
  place: WorkPlace | null;
  observer: WorkObserver | null;
  ref: { type: string; id: string } | null;
};

export type LocatedExecution = WorkExecution & {
  /** Optional until every executor writes the shared location contract. */
  place?: WorkPlace | null;
  observer?: WorkObserver | null;
};

function executionState(status: WorkExecution["status"]): WorkThreadEvent["state"] {
  switch (status) {
    case "proposed":
    case "approved":
    case "needs_input":
      return "waiting";
    case "running":
      return "running";
    case "done":
      return "succeeded";
    case "failed":
    case "refused":
      return "failed";
    default:
      return "unknown";
  }
}

function workState(status: WorkItem["status"]): WorkThreadEvent["state"] {
  switch (status) {
    case "active":
      return "running";
    case "blocked":
      return "blocked";
    case "done":
      return "succeeded";
    case "dropped":
      return "cancelled";
    case "open":
      return "information";
    default:
      return "unknown";
  }
}

/**
 * One chronological narrative projected from the existing authorities. It stores nothing and
 * invents no second completion or activity state.
 */
export function projectWorkThread(input: {
  item: WorkItem;
  messages?: AgentMessage[];
  executions?: LocatedExecution[];
  outputs?: WorkOutput[];
}): WorkThreadEvent[] {
  const { item } = input;
  const events: WorkThreadEvent[] = [
    {
      id: `work:${item.id}`,
      workItemId: item.id,
      kind: "work",
      actor: "system",
      state: workState(item.status),
      title: item.title,
      detail: item.status === "blocked" ? item.reason : item.detail || item.reason,
      occurredAt: item.updatedAt.toISOString(),
      place: null,
      observer: null,
      ref: null,
    },
    ...(input.messages ?? []).map<WorkThreadEvent>((message) => ({
      id: `message:${message.id}`,
      workItemId: item.id,
      kind: "message",
      actor: message.role === "user" ? "person" : "fadi",
      state: "information",
      title: message.role === "user" ? "You" : "Fadi",
      detail: message.content,
      occurredAt: message.createdAt.toISOString(),
      place: "fadi",
      observer: message.role === "user" ? "person" : "fadi",
      ref: null,
    })),
    ...(input.executions ?? []).map<WorkThreadEvent>((execution) => ({
      id: `execution:${execution.id}`,
      workItemId: item.id,
      kind: "execution",
      actor: "fadi",
      state: executionState(execution.status),
      title: execution.action,
      detail: execution.error || execution.receipt,
      occurredAt: (execution.finishedAt ?? execution.startedAt).toISOString(),
      place: execution.place ?? null,
      observer: execution.observer ?? null,
      ref: null,
    })),
    ...(input.outputs ?? []).map<WorkThreadEvent>((output) => ({
      id: `output:${output.id}`,
      workItemId: item.id,
      kind: "output",
      actor: "fadi",
      state: "succeeded",
      title: output.label || `Created ${output.kind}`,
      detail: "",
      occurredAt: output.createdAt.toISOString(),
      place: "fadi",
      observer: "fadi",
      ref: { type: output.kind, id: output.refId },
    })),
  ];

  return events.sort(
    (left, right) =>
      Date.parse(left.occurredAt) - Date.parse(right.occurredAt) || left.id.localeCompare(right.id)
  );
}
