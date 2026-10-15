import "server-only";

import { execFile } from "node:child_process";
import { createConnection } from "node:net";
import { promisify } from "node:util";

import {
  createLabActionRequestsRepository,
  createLabResourcesRepository,
  createProjectRunsRepository,
} from "@careeros/database";

import { RECIPES, type RecipeParams } from "./broker";
import type { LabRuntime, RuntimeEndpoint, RuntimeReadinessCheck } from "./runtime-contract";
import { LAB_TEMPLATES, type TemplateKey } from "./templates";

import { getDatabase } from "@/lib/database/client";

const run = promisify(execFile);

export type ProjectRuntime = LabRuntime & {
  template: TemplateKey | "vmware";
  templateLabel: string;
  containerName: string;
};

async function portAnswers(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const finish = (answer: boolean) => {
      socket.destroy();
      resolve(answer);
    };
    socket.setTimeout(700);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

export async function containerState(name: string): Promise<{
  status: string;
  running: boolean;
  exitCode: number;
  error: string;
  oomKilled: boolean;
  /** Volumes attached, named or anonymous. Both outlive `docker rm` without -v. */
  volumes: number;
  /** When it last started or stopped — how long a lab has been sitting idle. */
  lastActiveAt: Date | null;
} | null> {
  try {
    const { stdout } = await run(
      "docker",
      [
        "inspect",
        "--format",
        '{"State":{{json .State}},"Mounts":{{json .Mounts}}}',
        `fadi-${name}`,
      ],
      { timeout: 2500, maxBuffer: 64 * 1024 }
    );
    const parsed = JSON.parse(stdout.trim()) as {
      State?: Record<string, unknown>;
      Mounts?: Array<{ Type?: string }> | null;
    };
    const state = parsed.State ?? {};
    return {
      status: typeof state.Status === "string" ? state.Status : "unknown",
      running: state.Running === true,
      exitCode: typeof state.ExitCode === "number" ? state.ExitCode : 0,
      error: typeof state.Error === "string" ? state.Error : "",
      oomKilled: state.OOMKilled === true,
      volumes: (parsed.Mounts ?? []).filter((mount) => mount.Type === "volume").length,
      lastActiveAt: latest(state.StartedAt, state.FinishedAt),
    };
  } catch {
    return null;
  }
}

/**
 * WHY A CONTAINER ISN'T RUNNING, in words a person can act on.
 *
 * Every non-zero exit was "failed", and a failed lab offered no button. A Windows lab that
 * was simply stopped showed "The lab container exited with exit code 143" with no way to
 * start it again. 143 is SIGTERM — `docker stop`, a reboot, Docker Desktop quitting — and 137
 * without an out-of-memory kill is the same stop after its grace period ran out. Those are
 * stops. Only an out-of-memory kill or the program itself exiting with an error is a failure.
 */
export function classifyExit(state: { exitCode: number; oomKilled: boolean; error: string }): {
  phase: "stopped" | "failed";
  detail: string;
} {
  // Docker's own error first: a runtime that recorded one did not simply stop.
  if (state.error.trim()) return { phase: "failed", detail: state.error.trim() };
  if (state.oomKilled) {
    return {
      phase: "failed",
      detail:
        "The lab ran out of memory and was stopped. Close other apps or labs, then start it again.",
    };
  }
  if (state.exitCode === 0) {
    return {
      phase: "stopped",
      detail: "The lab is stopped. Its disk is kept — resume to carry on.",
    };
  }
  // A signal says how it ended, not who or what ended it — so the code is stated, not a cause.
  if (state.exitCode === 143 || state.exitCode === 137) {
    return {
      phase: "stopped",
      detail: `The lab was stopped by a signal (exit ${state.exitCode}). Its disk is kept — resume to carry on.`,
    };
  }
  return {
    phase: "failed",
    detail: `The lab stopped with an error (exit code ${state.exitCode}). Start it again, or check its logs.`,
  };
}

/** Whether a named Docker volume exists. Exact name only; nothing is listed or read from it. */
export async function volumeExists(name: string): Promise<boolean> {
  try {
    await run("docker", ["volume", "inspect", "--format", "{{.Name}}", name], {
      timeout: 2500,
      maxBuffer: 16 * 1024,
    });
    return true;
  } catch {
    return false;
  }
}

function endpoint(
  id: string,
  kind: RuntimeEndpoint["kind"],
  reachable: boolean,
  sessionPath: string | null
): RuntimeEndpoint {
  return { id, kind, state: reachable ? "reachable" : "unavailable", sessionPath };
}

function check(id: string, name: string, passed: boolean, detail: string): RuntimeReadinessCheck {
  return {
    id,
    name,
    required: true,
    status: passed ? "passed" : "pending",
    observedAt: new Date().toISOString(),
    detail,
  };
}

/**
 * Reconstruct the truthful current state of a locally provisioned project lab.
 *
 * The action request is durable provenance; Docker and the bound loopback ports are the
 * live observations. A responsive installer viewer is surfaced immediately, but only a
 * required service check can move the runtime to ready.
 */
export async function observeProjectRuntime(
  userId: string,
  runId: string
): Promise<ProjectRuntime | null> {
  const db = getDatabase();
  const project = await createProjectRunsRepository(db).getWithSteps(userId, runId);
  if (!project) return null;

  const requests = createLabActionRequestsRepository(db);
  const [dockerRequest, vmwareRequest, suspendRequest] = await Promise.all([
    requests.latestForRun(userId, runId, "lab.start"),
    requests.latestForRun(userId, runId, "vmware.start"),
    requests.latestForRun(userId, runId, "vmware.suspend"),
  ]);
  const request = [dockerRequest, vmwareRequest]
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  // A project placed on one of the person's VMware machines is observed from VMware itself —
  // including a machine they started on their own, which Fadi uses as it is.
  if (project.run.resourceId) {
    const resource = await createLabResourcesRepository(db).get(userId, project.run.resourceId);
    const { vmxPathOf } = await import("./vmware");
    const vmxPath = vmxPathOf(resource?.endpoint);
    if (resource && vmxPath) {
      return observeVmwareMachine({
        userId,
        runId,
        resource: { id: resource.id, label: resource.label },
        vmxPath,
        start: vmwareRequest ?? null,
        suspend: suspendRequest ?? null,
      });
    }
  }

  if (!request || request.status === "denied") return null;

  const params = RECIPES["lab.start"].validate((request.params ?? {}) as RecipeParams);
  if (!params) return null;
  const template = String(params.template) as TemplateKey;
  const name = String(params.name);
  const definition = LAB_TEMPLATES[template];
  const base = {
    id: request.id,
    runId,
    resourceId: project.run.resourceId ?? "local-docker",
    template,
    templateLabel: definition.label,
    containerName: `fadi-${name}`,
    progress: null,
    updatedAt: request.updatedAt.toISOString(),
  } as const;

  if (request.status === "pending") {
    return {
      ...base,
      phase: "queued",
      phaseDetail: "Waiting for your approval. Nothing has run.",
      endpoints: [],
      readinessChecks: [],
    };
  }
  if (request.status === "approved") {
    return {
      ...base,
      phase: "creating",
      phaseDetail: "The approved lab is being created.",
      endpoints: [],
      readinessChecks: [],
    };
  }
  if (request.status === "failed") {
    return {
      ...base,
      phase: "failed",
      phaseDetail: request.detail || "Lab creation failed.",
      endpoints: [],
      readinessChecks: [],
    };
  }
  if (request.status !== "executed") return null;

  const state = await containerState(name);
  if (!state) {
    return {
      ...base,
      phase: "stopped",
      phaseDetail: "The project lab is no longer running.",
      endpoints: [],
      readinessChecks: [],
    };
  }
  if (!state.running) {
    const exit = classifyExit(state);
    return {
      ...base,
      phase: exit.phase,
      phaseDetail: exit.detail,
      endpoints: [],
      readinessChecks: [],
    };
  }

  const windows = template === "windows-server-2025" || template === "windows-11";
  if (windows) {
    const [viewer, rdp] = await Promise.all([portAnswers(8006), portAnswers(3389)]);
    return {
      ...base,
      phase: rdp ? "ready" : viewer ? "installing" : "booting",
      phaseDetail: rdp
        ? "Windows is accepting Remote Desktop connections."
        : viewer
          ? "The setup console is reachable while Windows continues preparing."
          : "The container is running; its setup console has not answered yet.",
      endpoints: [
        endpoint("installer", "viewer", viewer, viewer ? "http://127.0.0.1:8006" : null),
        endpoint("desktop", "rdp", rdp, null),
      ],
      readinessChecks: [
        check(
          "rdp",
          "Remote Desktop accepts connections",
          rdp,
          rdp ? "Observed on loopback port 3389." : "Still waiting on loopback port 3389."
        ),
      ],
    };
  }

  const publishedPort =
    template === "linux-web" ? 8080 : template === "linux-postgres" ? 5432 : null;
  const serviceReady = publishedPort ? await portAnswers(publishedPort) : true;
  const surfaceKind: RuntimeEndpoint["kind"] = template === "linux-web" ? "http" : "terminal";
  return {
    ...base,
    phase: serviceReady ? "ready" : "booting",
    phaseDetail: serviceReady
      ? publishedPort
        ? `The required service answered on loopback port ${publishedPort}.`
        : "The lab container is running."
      : `The container is running; the service on port ${publishedPort} is not ready yet.`,
    endpoints:
      publishedPort === 8080
        ? [
            endpoint(
              "web",
              surfaceKind,
              serviceReady,
              serviceReady ? "http://127.0.0.1:8080" : null
            ),
          ]
        : [],
    readinessChecks: [
      check(
        publishedPort ? "service" : "container",
        publishedPort ? `Service answers on port ${publishedPort}` : "Container is running",
        serviceReady,
        publishedPort ? `Checked 127.0.0.1:${publishedPort}.` : "Observed through Docker."
      ),
    ],
  };
}

/** The later of Docker's two timestamps; its zero value ("0001-01-01…") means never. */
function latest(...values: unknown[]): Date | null {
  const times = values
    .filter((v): v is string => typeof v === "string" && !v.startsWith("0001"))
    .map((v) => new Date(v).getTime())
    .filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)) : null;
}

/**
 * Space a volume really takes on disk, in bytes — not its apparent size. A Windows lab's 64 GB
 * sparse disk reports 64 GB to `docker system df` while using 10–18 GB; `du` counts blocks.
 * Read-only, no network, one fixed argv. Null when it cannot be measured.
 */
export async function volumeUsageBytes(name: string): Promise<number | null> {
  const { DISK_HELPER_IMAGE } = await import("./templates");
  try {
    const { stdout } = await run(
      "docker",
      [
        "run",
        "--rm",
        "--network",
        "none",
        "-v",
        name + ":/v:ro",
        DISK_HELPER_IMAGE,
        "du",
        "-sk",
        "/v",
      ],
      { timeout: 30_000, maxBuffer: 16 * 1024 }
    );
    const kb = Number(stdout.trim().split(/\s+/)[0]);
    return Number.isFinite(kb) ? kb * 1024 : null;
  } catch {
    return null;
  }
}

/**
 * Has Windows finished installing in this lab? dockur writes `windows.boot` once Setup is done
 * and the machine has booted from its own disk; until then the disk is half an install and not
 * worth keeping as a base.
 */
export async function windowsInstalled(volume: string): Promise<boolean> {
  const { DISK_HELPER_IMAGE } = await import("./templates");
  try {
    await run(
      "docker",
      [
        "run",
        "--rm",
        "--network",
        "none",
        "-v",
        volume + ":/v:ro",
        DISK_HELPER_IMAGE,
        "test",
        "-f",
        "/v/windows.boot",
      ],
      { timeout: 30_000, maxBuffer: 16 * 1024 }
    );
    return true;
  } catch {
    return false;
  }
}

type RequestRow = {
  id: string;
  status: string;
  detail?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * A VMware machine's state for a project: VMware says whether it runs, VMware Tools inside the
 * guest says whether the operating system is up, and the screen is offered once it answers.
 */
async function observeVmwareMachine(input: {
  userId: string;
  runId: string;
  resource: { id: string; label: string };
  vmxPath: string;
  start: RequestRow | null;
  suspend: RequestRow | null;
}): Promise<ProjectRuntime | null> {
  const { start, suspend, resource, vmxPath } = input;
  const base = {
    id: start?.id ?? `vmware-${resource.id}`,
    runId: input.runId,
    resourceId: resource.id,
    template: "vmware" as const,
    templateLabel: resource.label,
    containerName: resource.label,
    progress: null,
    updatedAt: (start?.updatedAt ?? new Date()).toISOString(),
  };
  const quiet = (phase: ProjectRuntime["phase"], phaseDetail: string): ProjectRuntime => ({
    ...base,
    phase,
    phaseDetail,
    endpoints: [],
    readinessChecks: [],
  });

  if (start?.status === "pending")
    return quiet("queued", "Waiting for your approval. Nothing has run.");
  if (start?.status === "approved") return quiet("creating", `Starting ${resource.label}…`);

  const { guestToolsState, readVmxSummary, runningVmxPaths } = await import("./vmware");
  const running = await runningVmxPaths();
  if (running === null) {
    return quiet("failed", "VMware's vmrun isn't answering, so Fadi can't see this machine.");
  }

  if (!running.has(vmxPath)) {
    if (start?.status === "failed") {
      return quiet("failed", start.detail || `VMware could not start ${resource.label}.`);
    }
    // Never asked to start, and not running: nothing to show yet; the page offers to start it.
    if (!start || start.status !== "executed") return null;
    const suspended =
      suspend?.status === "executed" && suspend.createdAt.getTime() > start.createdAt.getTime();
    return quiet(
      "stopped",
      suspended
        ? `${resource.label} is suspended — VMware kept everything as it was.`
        : `${resource.label} isn't running. Start it to carry on.`
    );
  }

  const [summary, tools] = await Promise.all([readVmxSummary(vmxPath), guestToolsState(vmxPath)]);
  const endpoints: RuntimeEndpoint[] = [];
  if (summary?.screen && (await portAnswers(summary.screen.port))) {
    const { ensureScreenBridge, screenTicket, SCREEN_BRIDGE_PORT } = await import("./vnc-bridge");
    if (await ensureScreenBridge()) {
      const ticket = screenTicket(input.userId, summary.screen.port);
      endpoints.push(
        endpoint(
          "vmware-screen",
          "viewer",
          true,
          `/lab-screen.html#port=${SCREEN_BRIDGE_PORT}&t=${ticket}&p=${encodeURIComponent(summary.screen.password)}`
        )
      );
    }
  }

  const osUp = tools === "running";
  const readinessChecks = [
    check(
      "guest-os",
      "The operating system has started",
      osUp,
      osUp
        ? "VMware Tools in the guest answered."
        : tools === "not-installed"
          ? "VMware Tools isn't installed in this machine, so Fadi can't tell when it has started. Install it from VMware's VM menu."
          : "Waiting for the guest to finish starting."
    ),
  ];
  const screenNote = summary?.screen
    ? ""
    : " Its screen isn't on for Fadi yet: shut it down once, then start it from Fadi.";
  return {
    ...base,
    phase: osUp ? "ready" : "booting",
    phaseDetail:
      (osUp
        ? `${resource.label} is running in the background.`
        : `${resource.label} is starting…`) + screenNote,
    endpoints,
    readinessChecks,
  };
}
