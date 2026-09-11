import "server-only";

import { execFile } from "node:child_process";
import { createConnection } from "node:net";
import { promisify } from "node:util";

import { createLabActionRequestsRepository, createProjectRunsRepository } from "@careeros/database";

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

async function containerState(name: string): Promise<{
  status: string;
  running: boolean;
  exitCode: number;
  error: string;
} | null> {
  try {
    const { stdout } = await run(
      "docker",
      ["inspect", "--format", "{{json .State}}", `fadi-${name}`],
      { timeout: 2500, maxBuffer: 64 * 1024 }
    );
    const state = JSON.parse(stdout.trim()) as Record<string, unknown>;
    return {
      status: typeof state.Status === "string" ? state.Status : "unknown",
      running: state.Running === true,
      exitCode: typeof state.ExitCode === "number" ? state.ExitCode : 0,
      error: typeof state.Error === "string" ? state.Error : "",
    };
  } catch {
    return null;
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
  if (!request || request.status === "denied") return null;

  if (request.recipe === "vmware.start") {
    const params = RECIPES["vmware.start"].validate((request.params ?? {}) as RecipeParams);
    const vmxPath = params?.vmxPath;
    if (!params || typeof vmxPath !== "string") return null;
    const base = {
      id: request.id,
      runId,
      resourceId: project.run.resourceId ?? String(params.resourceId),
      template: "vmware" as const,
      templateLabel: String(params.label ?? "VMware machine"),
      containerName: String(params.label ?? "VMware machine"),
      progress: null,
      updatedAt: request.updatedAt.toISOString(),
    };

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
        phaseDetail: "VMware is opening the approved machine.",
        endpoints: [],
        readinessChecks: [],
      };
    }
    if (request.status === "failed") {
      return {
        ...base,
        phase: "failed",
        phaseDetail: request.detail || "VMware could not start the machine.",
        endpoints: [],
        readinessChecks: [],
      };
    }
    if (request.status !== "executed") return null;

    if (
      suspendRequest?.status === "executed" &&
      suspendRequest.createdAt.getTime() > request.createdAt.getTime()
    ) {
      return {
        ...base,
        phase: "stopped",
        phaseDetail: "The VMware machine is suspended.",
        endpoints: [],
        readinessChecks: [],
      };
    }

    try {
      const { stdout } = await run("vmrun", ["list"], {
        timeout: 2500,
        maxBuffer: 128 * 1024,
      });
      const running = stdout
        .split("\n")
        .map((line) => line.trim())
        .includes(vmxPath);
      if (!running) {
        return {
          ...base,
          phase: "stopped",
          phaseDetail: "VMware does not report this machine as running.",
          endpoints: [],
          readinessChecks: [],
        };
      }
      return {
        ...base,
        phase: "booting",
        phaseDetail:
          "VMware reports the guest running and opened its native console. Guest readiness is not configured yet.",
        endpoints: [
          { id: "vmware-console", kind: "viewer", state: "reachable", sessionPath: null },
        ],
        readinessChecks: [
          {
            id: "guest-readiness",
            name: "Guest operating system answers",
            required: true,
            status: "unknown",
            observedAt: new Date().toISOString(),
            detail: "Add an SSH or RDP endpoint before Fadi can verify the guest is usable.",
          },
        ],
      };
    } catch {
      return {
        ...base,
        phase: "failed",
        phaseDetail:
          "The VM was started earlier, but VMware is unavailable for a current status check.",
        endpoints: [],
        readinessChecks: [],
      };
    }
  }

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
    return {
      ...base,
      phase: state.exitCode === 0 ? "stopped" : "failed",
      phaseDetail:
        state.error ||
        `The lab container ${state.status}${state.exitCode ? ` with exit code ${state.exitCode}` : ""}.`,
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
