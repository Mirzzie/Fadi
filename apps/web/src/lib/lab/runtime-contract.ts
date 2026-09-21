/**
 * Durable lab-runtime contract.
 *
 * A registered resource, a provisioning operation, a reachable endpoint and a ready lab
 * are four different records. Keeping them separate prevents the UI from interpreting a
 * browser that answered as an operating system that finished installing.
 */

export const RUNTIME_PHASES = [
  "queued",
  "pulling",
  "creating",
  "installing",
  "awaiting_input",
  "booting",
  "ready",
  "failed",
  "stopping",
  "stopped",
] as const;

export type RuntimePhase = (typeof RUNTIME_PHASES)[number];

export type RuntimeProgress = {
  /** Bytes, files, packages, or another observed unit. Never elapsed-time estimation. */
  unit: string;
  completed: number;
  total: number;
};

export type RuntimeEndpoint = {
  id: string;
  kind: "viewer" | "terminal" | "rdp" | "ssh" | "http" | "other";
  state: "unavailable" | "connecting" | "reachable";
  /** An opaque gateway path or session id. Raw host ports do not cross this contract. */
  sessionPath: string | null;
};

export type RuntimeReadinessCheck = {
  id: string;
  name: string;
  required: boolean;
  status: "pending" | "passed" | "failed" | "unknown";
  observedAt: string | null;
  detail: string | null;
};

export type LabRuntime = {
  id: string;
  runId: string;
  resourceId: string;
  phase: RuntimePhase;
  phaseDetail: string | null;
  progress: RuntimeProgress | null;
  endpoints: RuntimeEndpoint[];
  readinessChecks: RuntimeReadinessCheck[];
  updatedAt: string;
};

const TRANSITIONS: Record<RuntimePhase, RuntimePhase[]> = {
  queued: ["pulling", "creating", "failed", "stopping"],
  pulling: ["creating", "failed", "stopping"],
  creating: ["installing", "booting", "ready", "failed", "stopping"],
  installing: ["awaiting_input", "booting", "failed", "stopping"],
  awaiting_input: ["installing", "booting", "failed", "stopping"],
  booting: ["ready", "failed", "stopping"],
  ready: ["failed", "stopping"],
  failed: ["queued", "stopping", "stopped"],
  stopping: ["stopped", "failed"],
  stopped: ["queued"],
};

export function canTransitionRuntime(from: RuntimePhase, to: RuntimePhase): boolean {
  return TRANSITIONS[from].includes(to);
}

/** A viewer can be useful during installation without making the machine ready. */
export function reachableSurface(runtime: LabRuntime): RuntimeEndpoint | null {
  return (
    runtime.endpoints.find(
      (endpoint) =>
        endpoint.state === "reachable" &&
        endpoint.sessionPath !== null &&
        ["viewer", "terminal", "rdp", "ssh", "http"].includes(endpoint.kind)
    ) ?? null
  );
}

/** Readiness is an observed claim. A phase label without required checks is insufficient. */
export function runtimeIsReady(runtime: LabRuntime): boolean {
  const required = runtime.readinessChecks.filter((check) => check.required);
  return (
    runtime.phase === "ready" &&
    required.length > 0 &&
    required.every((check) => check.status === "passed")
  );
}

/** Only render a percentage supplied by the underlying operation. */
export function observedProgressPercent(progress: RuntimeProgress | null): number | null {
  if (!progress || progress.total <= 0 || progress.completed < 0) return null;
  return Math.max(0, Math.min(100, Math.round((progress.completed / progress.total) * 100)));
}

export function runtimeMessage(runtime: LabRuntime): string {
  if (runtime.phase === "awaiting_input") return "The lab is waiting for input in the console.";
  if (runtime.phase === "installing" && reachableSurface(runtime)) {
    return "Setup console connected · the operating system is still preparing.";
  }
  if (runtimeIsReady(runtime)) return "Lab ready · required checks passed.";
  if (runtime.phase === "failed") return runtime.phaseDetail ?? "Lab preparation failed.";
  if (runtime.phase === "stopped") return runtime.phaseDetail ?? "Lab stopped.";
  return runtime.phaseDetail ?? `Lab ${runtime.phase.replace("_", " ")}.`;
}
